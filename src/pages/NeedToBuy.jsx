import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, ExternalLink, Download, Search } from 'lucide-react';
import { toast } from 'sonner';

function normalizeUrlString(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  return '';
}

function toUrlList({ affiliate_url, sources }) {
  const urls = [];

  const a = normalizeUrlString(affiliate_url);
  if (a) urls.push(a);

  if (Array.isArray(sources)) {
    for (const s of sources) {
      const u = normalizeUrlString(s);
      if (u) urls.push(u);
    }
  }

  // de-dupe
  const seen = new Set();
  return urls.filter(u => {
    const key = u.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickBestLink(urls) {
  if (!urls?.length) return '';

  const lower = urls.map(u => u.toLowerCase());
  const pepperIdx = lower.findIndex(u => u.includes('pepperseeds.net'));
  if (pepperIdx >= 0) return urls[pepperIdx];

  return urls[0];
}

function linkTier(urls) {
  if (!urls?.length) return 2;
  const hasPepper = urls.some(u => u.toLowerCase().includes('pepperseeds.net'));
  if (hasPepper) return 0;
  return 1;
}

function downloadCsv(filename, rows) {
  const escape = (v) => {
    const s = (v ?? '').toString();
    // wrap in quotes and escape quotes
    return `"${s.replaceAll('"', '""')}"`;
  };

  const csv = rows
    .map(r => r.map(escape).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

export default function NeedToBuy() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [search, setSearch] = useState('');

  // Final list rows
  const [needRows, setNeedRows] = useState([]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      setUser(me);

      // 1) Pull grow lists (for planned quantities)
      // Keep this simple: active + draft lists owned by user
      const growLists = await base44.entities.GrowList.filter({
        created_by: me.email,
        status: { $in: ['active', 'draft'] }
      });

      const allGrowItems = (growLists || [])
        .flatMap(gl => gl.items || [])
        .filter(it => it && (it.variety_id || it.variety_name));

      // Desired qty by variety_id (best case), fallback by (plant_type_name + variety_name)
      const desiredByVarietyId = new Map();
      const desiredByNameKey = new Map();

      for (const it of allGrowItems) {
        const qty = Number(it.quantity || 0) || 0;
        if (qty <= 0) continue;

        if (it.variety_id) {
          desiredByVarietyId.set(
            it.variety_id,
            (desiredByVarietyId.get(it.variety_id) || 0) + qty
          );
        } else {
          const key = `${(it.plant_type_name || '').toLowerCase()}__${(it.variety_name || '').toLowerCase()}`;
          desiredByNameKey.set(key, (desiredByNameKey.get(key) || 0) + qty);
        }
      }

      // 2) Pull seed lots (for owned quantities + wishlist items)
      const [stashLots, wishLots] = await Promise.all([
        base44.entities.SeedLot.filter({ created_by: me.email, is_wishlist: false }),
        base44.entities.SeedLot.filter({ created_by: me.email, is_wishlist: true })
      ]);

      // Load PlantProfiles for all seed lots (bulk)
      const allProfileIds = Array.from(
        new Set([...(stashLots || []), ...(wishLots || [])]
          .map(l => l.plant_profile_id)
          .filter(Boolean))
      );

      let profiles = [];
      if (allProfileIds.length > 0) {
        profiles = await base44.entities.PlantProfile.filter({
          id: { $in: allProfileIds }
        });
      }

      const profileById = new Map(profiles.map(p => [p.id, p]));

      // Owned quantity aggregated by variety_id (from stash)
      const ownedByVarietyId = new Map();
      // Also track owned by name-key fallback
      const ownedByNameKey = new Map();

      for (const lot of (stashLots || [])) {
        const qty = Number(lot.quantity || 0) || 0;
        const profile = profileById.get(lot.plant_profile_id);

        const varietyId = profile?.variety_id || null;
        if (varietyId) {
          ownedByVarietyId.set(varietyId, (ownedByVarietyId.get(varietyId) || 0) + qty);
        } else {
          const key = `${(profile?.common_name || '').toLowerCase()}__${(profile?.variety_name || '').toLowerCase()}`;
          if (key !== '__') {
            ownedByNameKey.set(key, (ownedByNameKey.get(key) || 0) + qty);
          }
        }
      }

      // 3) Pull Variety records in bulk for anything we might display
      const varietyIdsToFetch = Array.from(desiredByVarietyId.keys());

      // Also include wish list variety_ids (if profile has it)
      for (const lot of (wishLots || [])) {
        const profile = profileById.get(lot.plant_profile_id);
        if (profile?.variety_id) {
          if (!varietyIdsToFetch.includes(profile.variety_id)) varietyIdsToFetch.push(profile.variety_id);
        }
      }

      let varieties = [];
      if (varietyIdsToFetch.length > 0) {
        // Big but still single call
        varieties = await base44.entities.Variety.filter(
          { id: { $in: varietyIdsToFetch } },
          'variety_name',
          5000
        );
      }

      const varietyById = new Map(varieties.map(v => [v.id, v]));

      // 4) Build “needed to buy” rows:
      // A) Missing quantities from grow lists (desired - owned)
      const rows = [];

      for (const [varietyId, desiredQty] of desiredByVarietyId.entries()) {
        const owned = ownedByVarietyId.get(varietyId) || 0;
        const need = Math.max(0, desiredQty - owned);
        if (need <= 0) continue;

        const v = varietyById.get(varietyId);
        const urls = toUrlList({ affiliate_url: v?.affiliate_url, sources: v?.sources });
        const bestLink = pickBestLink(urls);

        rows.push({
          source: 'growlist',
          plant_type_name: v?.plant_type_name || '',
          variety_name: v?.variety_name || '',
          quantity_needed: need,
          urls,
          bestLink
        });
      }

      // B) Fallback rows when grow list items don’t have variety_id (still show)
      for (const [key, desiredQty] of desiredByNameKey.entries()) {
        const owned = ownedByNameKey.get(key) || 0;
        const need = Math.max(0, desiredQty - owned);
        if (need <= 0) continue;

        const [typeNameLower, varietyNameLower] = key.split('__');
        rows.push({
          source: 'growlist',
          plant_type_name: typeNameLower ? typeNameLower.replace(/\b\w/g, c => c.toUpperCase()) : '',
          variety_name: varietyNameLower ? varietyNameLower.replace(/\b\w/g, c => c.toUpperCase()) : '',
          quantity_needed: need,
          urls: [],
          bestLink: ''
        });
      }

      // C) Wishlist items (always show as “need to buy”)
      for (const lot of (wishLots || [])) {
        const profile = profileById.get(lot.plant_profile_id);
        const desiredQty = Number(lot.quantity || 0) || 1;

        const v = profile?.variety_id ? varietyById.get(profile.variety_id) : null;
        const urls = toUrlList({ affiliate_url: v?.affiliate_url, sources: v?.sources });
        const bestLink = pickBestLink(urls);

        rows.push({
          source: 'wishlist',
          plant_type_name: v?.plant_type_name || profile?.common_name || '',
          variety_name: v?.variety_name || profile?.variety_name || '',
          quantity_needed: desiredQty,
          urls,
          bestLink
        });
      }

      // Sort with your tier rules:
      // pepperseeds.net first, then any link, then none
      rows.sort((a, b) => {
        const ta = linkTier(a.urls);
        const tb = linkTier(b.urls);
        if (ta !== tb) return ta - tb;

        // secondary: Type then Variety
        const tcmp = (a.plant_type_name || '').localeCompare(b.plant_type_name || '');
        if (tcmp !== 0) return tcmp;
        return (a.variety_name || '').localeCompare(b.variety_name || '');
      });

      setNeedRows(rows);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load Need To Buy');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return needRows;
    return needRows.filter(r =>
      (r.plant_type_name || '').toLowerCase().includes(q) ||
      (r.variety_name || '').toLowerCase().includes(q)
    );
  }, [needRows, search]);

  const handleExport = () => {
    const rows = [
      ['Type', 'Variety', 'Qty Needed', 'Best Buy Link'],
      ...filtered.map(r => [
        r.plant_type_name || '',
        r.variety_name || '',
        r.quantity_needed || 0,
        r.bestLink || ''
      ])
    ];
    downloadCsv('need_to_buy.csv', rows);
    toast.success('Exported CSV');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Need to Buy</h1>
          <p className="text-sm text-gray-500">
            Items you’re planning to plant but don’t have enough seeds for (plus wishlist items).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search type or variety..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items ({filtered.length})</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nothing needed right now.
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((r, idx) => {
                const tier = linkTier(r.urls);
                const tierLabel =
                  tier === 0 ? 'PepperSeeds.net' : tier === 1 ? 'Has Link' : 'No Link';

                return (
                  <div key={`${r.source}-${idx}`} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-[260px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">
                          {r.variety_name || '(Unnamed Variety)'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {r.plant_type_name || 'Unknown Type'}
                        </Badge>
                        <Badge
                          className={
                            tier === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : tier === 1
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-700'
                          }
                        >
                          {tierLabel}
                        </Badge>
                        {r.source === 'wishlist' && (
                          <Badge className="bg-amber-100 text-amber-800">Wishlist</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Qty needed: <span className="font-semibold">{r.quantity_needed}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {r.bestLink ? (
                        <a href={r.bestLink} target="_blank" rel="noopener noreferrer">
                          <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                            <ExternalLink className="w-4 h-4" />
                            Buy Now
                          </Button>
                        </a>
                      ) : (
                        <Button variant="outline" disabled>
                          No buy link yet
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}