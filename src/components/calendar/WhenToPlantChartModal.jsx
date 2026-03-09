import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ZoomIn, ZoomOut, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// ─── Design tokens (matching HTML reference) ───────────────────────────────
const FOREST    = '#1a3a2a';
const LEAF      = '#2d5a3d';
const MINT      = '#a8d5b5';
const CREAM     = '#faf7f0';
const PARCHMENT = '#f2ece0';

// ─── Bar type definitions ──────────────────────────────────────────────────
const BAR_TYPES = {
  start_indoors: { color: '#7c3aed', label: 'Start Indoors' },
  transplant:    { color: '#ea580c', label: 'Transplant Out' },
  direct_sow:    { color: '#16a34a', label: 'Direct Sow' },
  harvest:       { color: '#ca8a04', label: 'Harvest Window' },
};

// ─── Calendar constants ────────────────────────────────────────────────────
const MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MON_DAYS   = [31,28,31,30,31,30,31,31,30,31,30,31];
const TOTAL_DAYS = 365;
const MON_START  = MON_DAYS.reduce((a, d, i) => (a.push(i === 0 ? 0 : a[i-1] + MON_DAYS[i-1]), a), []);

// ─── Layout constants ──────────────────────────────────────────────────────
const NAME_W  = 170;   // px for plant name column
const CHART_W = 920;   // px for the 12-month timeline
const TOTAL_W = NAME_W + CHART_W;

// ─── Utilities ─────────────────────────────────────────────────────────────
function frostDOY(dateStr, year) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  const m = parseInt(parts[1]) - 1, d = parseInt(parts[2]);
  return Math.round((new Date(year, m, d) - new Date(year, 0, 1)) / 86400000);
}

function computeRows(plantTypes, lastFrostStr, firstFrostStr) {
  if (!lastFrostStr) return [];
  const yr = new Date().getFullYear();
  const lf = frostDOY(lastFrostStr, yr)  ?? 105;  // ~Apr 15 fallback
  const ff = frostDOY(firstFrostStr, yr) ?? 288;  // ~Oct 15 fallback

  const rows = [];
  for (const pt of plantTypes) {
    if (!['vegetable','fruit','herb','flower'].includes(pt.category)) continue;
    const bars = [];

    // ── Start Indoors ──
    if (pt.default_start_indoors_weeks && !pt.start_indoors_not_recommended) {
      const w = pt.default_start_indoors_weeks;
      const s = lf - (w + 1) * 7;
      const e = lf - (w - 1) * 7;
      if (e > 0 && s < TOTAL_DAYS)
        bars.push({ type: 'start_indoors', s: Math.max(0, s), e: Math.min(TOTAL_DAYS - 1, e) });
    }

    // ── Transplant ──
    if (pt.default_transplant_weeks != null) {
      const s = lf + pt.default_transplant_weeks * 7;
      const e = s + 14;
      if (s < TOTAL_DAYS && e > 0)
        bars.push({ type: 'transplant', s: Math.max(0, s), e: Math.min(TOTAL_DAYS - 1, e) });
    }

    // ── Direct Sow ──
    if (pt.default_direct_sow_weeks_min != null) {
      const maxW = pt.default_direct_sow_weeks_max ?? pt.default_direct_sow_weeks_min + 4;
      const s = lf + pt.default_direct_sow_weeks_min * 7;
      const e = lf + maxW * 7;
      if (s < TOTAL_DAYS && e > 0)
        bars.push({ type: 'direct_sow', s: Math.max(0, s), e: Math.min(TOTAL_DAYS - 1, e) });
    }

    // ── Harvest (transplant base preferred, else direct-sow base) ──
    if (pt.default_days_to_maturity) {
      const base = bars.find(b => b.type === 'transplant')?.s
                ?? bars.find(b => b.type === 'direct_sow')?.s;
      if (base != null) {
        const hs = base + pt.default_days_to_maturity;
        const he = Math.min(ff, hs + 45);
        if (hs < ff && hs < TOTAL_DAYS && hs >= 0)
          bars.push({ type: 'harvest', s: hs, e: Math.min(TOTAL_DAYS - 1, he) });
      }
    }

    if (bars.length) {
      rows.push({
        id: pt.id,
        name: pt.common_name,
        icon: pt.icon || '🌱',
        category: pt.category || 'vegetable',
        bars,
      });
    }
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Category display ──────────────────────────────────────────────────────
const CAT_ORDER = ['vegetable','fruit','herb','flower'];
const CAT_LABEL = {
  vegetable: '🥕 Vegetables',
  fruit:     '🍓 Fruits & Berries',
  herb:      '🌿 Herbs',
  flower:    '🌸 Flowers',
};

// ──────────────────────────────────────────────────────────────────────────
export default function WhenToPlantChartModal({ open, onOpenChange }) {
  const [phase, setPhase]         = useState('idle');   // idle|loading|generating|ready|no_settings
  const [settings, setSettings]   = useState(null);
  const [rows, setRows]           = useState([]);
  const [zoom, setZoom]           = useState(0.85);
  const [catFilter, setCatFilter] = useState('all');

  useEffect(() => { if (open) load(); }, [open]);

  const load = async (force = false) => {
    setPhase('loading');
    const user         = await base44.auth.me();
    const settingsList = await base44.entities.UserSettings.filter({ user_email: user.email });
    const s            = settingsList[0] || null;
    setSettings(s);

    if (!s?.last_frost_date) { setPhase('no_settings'); return; }

    const key = `${s.usda_zone || 'X'}|${s.last_frost_date}|${s.first_frost_date || ''}`;

    // ── Check cache ──
    if (!force) {
      const cached = await base44.entities.PlantingCalendarCache.filter({ zone_key: key, created_by: user.email });
      if (cached.length > 0) {
        const ageDays = (Date.now() - new Date(cached[0].generated_at).getTime()) / 86400000;
        if (ageDays < 30) {
          setRows(JSON.parse(cached[0].rows_json));
          setPhase('ready');
          return;
        }
      }
    }

    // ── Generate ──
    setPhase('generating');
    const plantTypes = await base44.entities.PlantType.list('common_name', 500);
    const computed   = computeRows(plantTypes, s.last_frost_date, s.first_frost_date);

    const payload = {
      zone_key:        key,
      usda_zone:       s.usda_zone || '',
      last_frost_date: s.last_frost_date,
      first_frost_date: s.first_frost_date || '',
      rows_json:       JSON.stringify(computed),
      plant_count:     computed.length,
      generated_at:    new Date().toISOString(),
    };

    const existing = await base44.entities.PlantingCalendarCache.filter({ zone_key: key, created_by: user.email });
    if (existing.length > 0) await base44.entities.PlantingCalendarCache.update(existing[0].id, payload);
    else                      await base44.entities.PlantingCalendarCache.create(payload);

    setRows(computed);
    setPhase('ready');
  };

  const visRows = useMemo(() =>
    catFilter === 'all' ? rows : rows.filter(r => r.category === catFilter),
    [rows, catFilter]
  );

  const grouped = useMemo(() => {
    const g = {};
    for (const r of visRows) { (g[r.category] = g[r.category] || []).push(r); }
    return g;
  }, [visRows]);

  const fmtFrost = (str) => {
    if (!str) return '';
    const parts = str.split('-');
    return `${MONTHS[parseInt(parts[1]) - 1]} ${parseInt(parts[2])}`;
  };

  const infoLine = [
    settings?.usda_zone       ? `Zone ${settings.usda_zone}` : null,
    settings?.last_frost_date ? `Last frost ~${fmtFrost(settings.last_frost_date)}` : null,
    settings?.first_frost_date ? `First frost ~${fmtFrost(settings.first_frost_date)}` : null,
  ].filter(Boolean).join('  ·  ');

  const busy = phase === 'loading' || phase === 'generating';

  // ── Frost marker lines ──
  const yr      = new Date().getFullYear();
  const lfDOY   = settings?.last_frost_date  ? frostDOY(settings.last_frost_date, yr)  : null;
  const ffDOY   = settings?.first_frost_date ? frostDOY(settings.first_frost_date, yr) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[99vw] max-h-[97vh] w-full h-full overflow-hidden flex flex-col p-0">

        {/* ═══════════════════════════════ HEADER ═══════════════════════════════ */}
        <div className="flex-shrink-0 px-4 pt-3 pb-3 border-b" style={{ background: FOREST }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">🌱 When To Plant Chart</h2>
              {infoLine && <p className="text-xs mt-0.5 font-medium" style={{ color: MINT }}>{infoLine}</p>}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger className="h-7 w-36 text-xs bg-white/10 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plants</SelectItem>
                  <SelectItem value="vegetable">Vegetables</SelectItem>
                  <SelectItem value="fruit">Fruits</SelectItem>
                  <SelectItem value="herb">Herbs</SelectItem>
                  <SelectItem value="flower">Flowers</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-white hover:bg-white/20"
                onClick={() => setZoom(z => Math.max(0.35, parseFloat((z - 0.15).toFixed(2))))}>
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs text-white/60 w-9 text-center">{Math.round(zoom * 100)}%</span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-white hover:bg-white/20"
                onClick={() => setZoom(z => Math.min(3, parseFloat((z + 0.15).toFixed(2))))}>
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-3 text-xs text-white hover:bg-white/20"
                onClick={() => load(true)} disabled={busy}>
                <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-5 mt-2.5 flex-wrap">
            {Object.entries(BAR_TYPES).map(([k, { color, label }]) => (
              <span key={k} className="flex items-center gap-1.5 text-xs text-white/85">
                <span className="inline-block w-7 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                {label}
              </span>
            ))}
            {lfDOY && (
              <span className="flex items-center gap-1.5 text-xs text-white/85">
                <span className="inline-block w-0.5 h-3 rounded-full flex-shrink-0 bg-blue-300" />
                Last Frost
              </span>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════ BODY ════════════════════════════════ */}
        {busy ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ background: CREAM }}>
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: LEAF }} />
            <p className="font-semibold text-gray-700">
              {phase === 'generating' ? 'Computing your planting calendar…' : 'Loading…'}
            </p>
            {phase === 'generating' && (
              <p className="text-sm text-gray-400">Analyzing plant types from your catalog</p>
            )}
          </div>

        ) : phase === 'no_settings' ? (
          <div className="flex-1 flex items-center justify-center" style={{ background: CREAM }}>
            <div className="text-center p-8 max-w-sm">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-800 mb-2">Frost Dates Required</h3>
              <p className="text-sm text-gray-500 mb-5">
                Set your <strong>last frost</strong> and <strong>first frost</strong> dates in{' '}
                <strong>Settings → Growing Profile</strong> to generate a personalized planting calendar.
              </p>
              <Button onClick={() => onOpenChange(false)} className="text-white" style={{ background: LEAF }}>
                Got It
              </Button>
            </div>
          </div>

        ) : rows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400" style={{ background: CREAM }}>
            No plant data available.
          </div>

        ) : (
          <div className="flex-1 overflow-auto" style={{ background: PARCHMENT }}>
            {/* ── Zoom wrapper (same pattern as CompanionChartModal) ── */}
            <div style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              display: 'inline-block',
              minWidth: 'max-content',
            }}>
              <div style={{ width: TOTAL_W }}>

                {/* ── Month header ── */}
                <div className="flex border-b" style={{ background: LEAF, height: 34 }}>
                  <div
                    className="flex-shrink-0 border-r border-white/20 flex items-center px-3"
                    style={{ width: NAME_W, minWidth: NAME_W }}
                  >
                    <span className="text-xs font-bold text-white">Plant</span>
                  </div>
                  <div className="relative flex" style={{ width: CHART_W }}>
                    {MONTHS.map((m, mi) => (
                      <div
                        key={m}
                        className="border-r border-white/20 flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ width: `${(MON_DAYS[mi] / TOTAL_DAYS) * CHART_W}px` }}
                      >
                        {m}
                      </div>
                    ))}
                    {/* Frost markers in header */}
                    {lfDOY != null && (
                      <div className="absolute top-0 bottom-0 pointer-events-none"
                        style={{ left: `${(lfDOY / TOTAL_DAYS) * CHART_W}px`, width: 2, background: 'rgba(147,197,253,0.7)' }} />
                    )}
                    {ffDOY != null && (
                      <div className="absolute top-0 bottom-0 pointer-events-none"
                        style={{ left: `${(ffDOY / TOTAL_DAYS) * CHART_W}px`, width: 2, background: 'rgba(147,197,253,0.7)' }} />
                    )}
                  </div>
                </div>

                {/* ── Category groups ── */}
                {CAT_ORDER.filter(c => grouped[c]?.length).map(cat => (
                  <div key={cat}>
                    {/* Category header */}
                    <div
                      className="flex items-center px-3 border-b font-bold text-xs tracking-wide sticky top-0 z-10"
                      style={{ height: 26, background: MINT, color: FOREST }}
                    >
                      {CAT_LABEL[cat]}
                      <span className="ml-1.5 font-normal opacity-70">({grouped[cat].length})</span>
                    </div>

                    {/* Plant rows */}
                    {grouped[cat].map((row, idx) => {
                      const rowBg = idx % 2 === 0 ? CREAM : PARCHMENT;
                      return (
                        <div key={row.id} className="flex border-b group" style={{ height: 30, background: rowBg }}>

                          {/* Name cell */}
                          <div
                            className="flex-shrink-0 border-r flex items-center gap-2 px-3 sticky left-0 z-10"
                            style={{ width: NAME_W, minWidth: NAME_W, background: rowBg }}
                          >
                            <span style={{ fontSize: 13 }}>{row.icon}</span>
                            <span
                              className="text-xs font-semibold truncate"
                              style={{ color: FOREST }}
                              title={row.name}
                            >
                              {row.name}
                            </span>
                          </div>

                          {/* Timeline area */}
                          <div className="relative overflow-hidden" style={{ width: CHART_W }}>
                            {/* Alternating month bands */}
                            {MON_START.map((doy, mi) => (
                              <div key={mi} className="absolute top-0 bottom-0" style={{
                                left:  `${(doy / TOTAL_DAYS) * CHART_W}px`,
                                width: `${(MON_DAYS[mi] / TOTAL_DAYS) * CHART_W}px`,
                                background: mi % 2 === 1 ? 'rgba(0,0,0,0.028)' : 'transparent',
                                borderRight: '1px solid rgba(0,0,0,0.055)',
                              }} />
                            ))}

                            {/* Frost lines */}
                            {lfDOY != null && (
                              <div className="absolute top-0 bottom-0 pointer-events-none"
                                style={{ left: `${(lfDOY / TOTAL_DAYS) * CHART_W}px`, width: 1, background: 'rgba(59,130,246,0.35)', zIndex: 2 }} />
                            )}
                            {ffDOY != null && (
                              <div className="absolute top-0 bottom-0 pointer-events-none"
                                style={{ left: `${(ffDOY / TOTAL_DAYS) * CHART_W}px`, width: 1, background: 'rgba(59,130,246,0.35)', zIndex: 2 }} />
                            )}

                            {/* Activity bars */}
                            {row.bars.map((bar, bi) => {
                              const { color, label } = BAR_TYPES[bar.type] || { color: '#888', label: '' };
                              const left  = (bar.s / TOTAL_DAYS) * CHART_W;
                              const width = Math.max(3, ((bar.e - bar.s) / TOTAL_DAYS) * CHART_W);
                              return (
                                <div
                                  key={bi}
                                  title={`${row.name}: ${label}`}
                                  className="absolute rounded-sm flex items-center justify-center overflow-hidden cursor-default"
                                  style={{
                                    left,
                                    width,
                                    top: 5,
                                    bottom: 5,
                                    background: color,
                                    opacity: 0.88,
                                    zIndex: 3,
                                  }}
                                >
                                  {width > 44 && (
                                    <span className="text-white font-bold truncate px-0.5 leading-none"
                                      style={{ fontSize: 9 }}>
                                      {label}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                ))}

              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════ FOOTER ══════════════════════════════ */}
        {phase === 'ready' && (
          <div
            className="flex-shrink-0 border-t px-4 py-1.5 flex justify-between items-center text-xs text-gray-400"
            style={{ background: CREAM }}
          >
            <span>{visRows.length} plant types shown · calculated from AwesomeGardener catalog</span>
            <button className="text-emerald-600 hover:underline" onClick={() => load(true)}>
              Force recalculate
            </button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}