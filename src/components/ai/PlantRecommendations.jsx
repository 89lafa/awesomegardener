import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, ExternalLink, Plus, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AddToStashButton } from '@/components/catalog/QuickAddButtons';

// ─── Affiliate URL matching ───────────────────────────────────
// Called AFTER the AI returns recommendations.
// Tries to find a real affiliate_url from our database for each rec.
// Never uses array position — always matches by variety name.
function findAffiliateMatch(rec, affiliateVarieties) {
  const recName = rec.variety_name?.toLowerCase().trim();
  if (!recName) return null;

  // 1. Exact match (most reliable)
  let match = affiliateVarieties.find(
    v => v.variety_name?.toLowerCase().trim() === recName
  );

  // 2. Substring match — only when name is meaningful (5+ chars)
  //    to avoid empty-string matching every entry
  if (!match && recName.length >= 5) {
    match = affiliateVarieties.find(v => {
      const vName = v.variety_name?.toLowerCase().trim() || '';
      return vName.includes(recName) || recName.includes(vName);
    });
  }

  return match?.affiliate_url || null;
}

// ─────────────────────────────────────────────────────────────
export default function PlantRecommendations({ open, onOpenChange, context = 'catalog' }) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [affiliateVarieties, setAffiliateVarieties] = useState([]);
  const [formData, setFormData] = useState({
    harvest_months: '',
    container_only: false,
    sun_exposure: 'full_sun',
    difficulty: 'any',
  });

  // Pre-load ALL varieties that have affiliate links.
  // This is used purely for post-recommendation URL lookup — NOT
  // passed to the AI, so the AI recommends on merit alone.
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const vars = await base44.entities.Variety.filter(
          { status: 'active', affiliate_url: { $ne: null } },
          'variety_name',
          500
        );
        setAffiliateVarieties(vars.filter(v => v.affiliate_url));
      } catch (e) {
        console.warn('[PlantRecommendations] Could not load affiliate varieties:', e);
        // Non-critical — Buy Seeds buttons just won't appear
      }
    })();
  }, [open]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const randomSeed = Math.random().toString(36).substring(7);

      // ── Step 1: Ask AI for best recommendations on merit ──
      // No affiliate list is sent — the AI should recommend freely
      // based on the user's zone/preferences. Affiliate URLs are
      // attached afterward using real database lookups.
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a gardening expert. Recommend 6-8 plant varieties for this gardener.

Focus on giving genuinely great suggestions — a mix of beginner-friendly picks,
interesting heirlooms, and reliable producers suited to their zone and goals.
Be diverse and specific: recommend actual named varieties, not just plant types.

[Random seed for variety: ${randomSeed}]

User Profile:
- USDA Zone: ${user.usda_zone || 'unknown'}
- Last Frost: ${user.last_frost_date || 'unknown'}
- First Frost: ${user.first_frost_date || 'unknown'}

Preferences:
- Desired harvest months: ${formData.harvest_months || 'any time'}
- Container only: ${formData.container_only ? 'yes' : 'no'}
- Sun exposure: ${formData.sun_exposure}
- Difficulty level: ${formData.difficulty}

Return structured data for each recommendation.`,
        add_context_from_internet: false,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  common_name:    { type: 'string' },
                  variety_name:   { type: 'string' },
                  reason:         { type: 'string' },
                  difficulty:     { type: 'string' },
                  start_timing:   { type: 'string' },
                  harvest_timing: { type: 'string' },
                },
              },
            },
          },
        },
      });

      // ── Step 2: Enrich with affiliate URLs from real DB data ──
      // For every recommendation the AI returned, look up whether
      // we actually have an affiliate URL for that variety name.
      // This is the only source of truth — NOT the AI's opinion.
      const enriched = (response.recommendations || []).map(rec => {
        const affiliateUrl = findAffiliateMatch(rec, affiliateVarieties);
        return {
          ...rec,
          affiliate_url: affiliateUrl,
          has_affiliate_link: !!affiliateUrl,
        };
      });

      setRecommendations({ recommendations: enriched });
    } catch (error) {
      console.error('[PlantRecommendations] Error generating recommendations:', error);
      toast.error('Failed to generate recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllToGrowList = async () => {
    try {
      const user = await base44.auth.me();
      const growLists = await base44.entities.GrowList.filter({ created_by: user.email });
      if (!growLists.length) {
        toast.error('Create a grow list first');
        return;
      }
      const targetList = growLists[0];
      const existingItems = targetList.items || [];
      const newItems = recommendations.recommendations.map(rec => ({
        variety_name: rec.variety_name || rec.common_name,
        plant_type_name: rec.common_name,
        quantity: 1,
        added_date: new Date().toISOString(),
      }));
      await base44.entities.GrowList.update(targetList.id, {
        items: [...existingItems, ...newItems],
      });
      toast.success(`Added ${newItems.length} varieties to ${targetList.name}`);
    } catch (e) {
      console.error('[PlantRecommendations] Add all to grow list error:', e);
      toast.error('Failed to add to grow list');
    }
  };

  const handleClose = () => {
    setRecommendations(null);
    onOpenChange(false);
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>✨ AI Plant Recommendations</DialogTitle>
          <DialogDescription>
            Get personalized variety suggestions based on your location and preferences
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-purple-50 border-purple-200">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <AlertDescription className="text-sm text-purple-800">
            Recommendations are based on your USDA zone, frost dates, and preferences.
            Always verify varieties are available in your area.
          </AlertDescription>
        </Alert>

        {/* ── Form ── */}
        {!recommendations ? (
          <div className="space-y-4">
            <div>
              <Label>Desired Harvest Months (optional)</Label>
              <Input
                placeholder="e.g., July-September"
                value={formData.harvest_months}
                onChange={(e) => setFormData({ ...formData, harvest_months: e.target.value })}
                className="mt-2"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label>Sun Exposure</Label>
                <Select
                  value={formData.sun_exposure}
                  onValueChange={(v) => setFormData({ ...formData, sun_exposure: v })}
                >
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_sun">Full Sun</SelectItem>
                    <SelectItem value="partial_sun">Partial Sun</SelectItem>
                    <SelectItem value="partial_shade">Partial Shade</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Difficulty</Label>
                <Select
                  value={formData.difficulty}
                  onValueChange={(v) => setFormData({ ...formData, difficulty: v })}
                >
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Level</SelectItem>
                    <SelectItem value="beginner">Beginner Friendly</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 pb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.container_only}
                    onChange={(e) => setFormData({ ...formData, container_only: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Container only</span>
                </label>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <Sparkles className="w-4 h-4 mr-2" />}
              Get Recommendations
            </Button>
          </div>

        ) : (
          /* ── Results ── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Recommended for You:</h3>
              <Button size="sm" variant="outline" onClick={handleAddAllToGrowList} className="gap-2">
                <Plus className="w-4 h-4" />
                Add All to Grow List
              </Button>
            </div>

            {recommendations.recommendations?.map((rec, idx) => (
              <Card
                key={idx}
                className={`border-l-4 ${rec.has_affiliate_link ? 'border-l-emerald-500 bg-emerald-50/30' : 'border-l-purple-400'}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-semibold text-base">
                          {rec.variety_name
                            ? `${rec.variety_name}`
                            : rec.common_name}
                        </h4>
                        {rec.variety_name && rec.common_name && (
                          <span className="text-xs text-gray-500">({rec.common_name})</span>
                        )}
                        {rec.has_affiliate_link && (
                          <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                            🛒 Seeds Available
                          </Badge>
                        )}
                        {rec.difficulty && (
                          <Badge className="bg-gray-100 text-gray-600 text-xs">
                            {rec.difficulty}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{rec.reason}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        {rec.start_timing   && <span>🌱 {rec.start_timing}</span>}
                        {rec.harvest_timing && <span>🍅 {rec.harvest_timing}</span>}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {rec.affiliate_url && (
                        <a href={rec.affiliate_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1 w-full">
                            <Package className="w-3 h-3" />
                            Buy Seeds
                          </Button>
                        </a>
                      )}
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          to={
                            createPageUrl('PlantCatalog') +
                            `?search=${encodeURIComponent(rec.variety_name || rec.common_name)}`
                          }
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View Catalog
                        </Link>
                      </Button>
                      <AddToStashButton
                        variety={{
                          variety_name: rec.variety_name || rec.common_name,
                          plant_type_name: rec.common_name,
                        }}
                        size="sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {recommendations ? 'Done' : 'Cancel'}
          </Button>
          {recommendations && (
            <>
              <Button
                onClick={handleGenerate}
                disabled={loading}
                variant="outline"
                className="gap-2"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Sparkles className="w-4 h-4" />}
                More Suggestions
              </Button>
              <Button onClick={() => setRecommendations(null)} variant="outline">
                New Search
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
