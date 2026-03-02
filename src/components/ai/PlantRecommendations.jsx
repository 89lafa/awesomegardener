import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, ExternalLink, Plus, Package, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AddToStashButton, AddToGrowListButton } from '@/components/catalog/QuickAddButtons';

export default function PlantRecommendations({ open, onOpenChange, context = 'catalog' }) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [affiliateVarieties, setAffiliateVarieties] = useState([]);
  const [formData, setFormData] = useState({
    harvest_months: '',
    container_only: false,
    sun_exposure: 'full_sun',
    difficulty: 'any'
  });

  // Pre-load varieties that have affiliate links so AI can prioritize them
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const vars = await base44.entities.Variety.filter(
          { status: 'active', affiliate_url: { $ne: null } },
          'variety_name', 200
        );
        setAffiliateVarieties(vars.filter(v => v.affiliate_url));
      } catch (e) {
        // Non-critical — just won't have affiliate data
      }
    })();
  }, [open]);

  const handleGenerate = async () => {
    setLoading(true);

    try {
      const user = await base44.auth.me();
      const randomSeed = Math.random().toString(36).substring(7);

      // Build a concise list of varieties with affiliate links for the AI to reference
      const affiliateList = affiliateVarieties.slice(0, 80).map(v =>
        `${v.variety_name} (${v.plant_type_name || ''})`
      ).join(', ');

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a gardening expert. Recommend 6-8 plant varieties based on the criteria below.

PRIORITY RULE: If any variety in the "Available for purchase" list below matches the user's criteria, prefer those — they are available to buy seeds directly. Flag them with has_affiliate_link=true.

Available for purchase (prioritize these if suitable):
${affiliateList || 'None loaded yet'}

IMPORTANT: Also include diverse, interesting recommendations beyond the list above. Mix heirlooms, rare finds, and beginner-friendly picks. [Random seed: ${randomSeed}]

User Profile:
- USDA Zone: ${user.usda_zone || 'unknown'}
- Last Frost: ${user.last_frost_date || 'unknown'}
- First Frost: ${user.first_frost_date || 'unknown'}

Preferences:
- Harvest target: ${formData.harvest_months || 'any'}
- Container only: ${formData.container_only ? 'yes' : 'no'}
- Sun: ${formData.sun_exposure}
- Difficulty: ${formData.difficulty}

Return structured data for each recommendation.`,
        add_context_from_internet: false,
        response_json_schema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  common_name: { type: "string" },
                  variety_name: { type: "string" },
                  reason: { type: "string" },
                  difficulty: { type: "string" },
                  start_timing: { type: "string" },
                  harvest_timing: { type: "string" },
                  has_affiliate_link: { type: "boolean" }
                }
              }
            }
          }
        }
      });

      // Enrich each recommendation with the actual affiliate URL if we have it
      const enriched = (response.recommendations || []).map(rec => {
        if (!rec.has_affiliate_link) return rec;
        const match = affiliateVarieties.find(v =>
          v.variety_name?.toLowerCase() === rec.variety_name?.toLowerCase() ||
          v.variety_name?.toLowerCase().includes(rec.variety_name?.toLowerCase())
        );
        return { ...rec, affiliate_url: match?.affiliate_url || null };
      });

      setRecommendations({ recommendations: enriched });
    } catch (error) {
      console.error('[AI_RECOMMEND] Error:', error);
      toast.error('Failed to generate recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRecommendations(null);
    onOpenChange(false);
  };

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
            Recommendations are based on your USDA zone, frost dates, and preferences. Always verify varieties are available in your area.
          </AlertDescription>
        </Alert>

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
                <Select value={formData.sun_exposure} onValueChange={(v) => setFormData({ ...formData, sun_exposure: v })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_sun">Full Sun</SelectItem>
                    <SelectItem value="partial_sun">Partial Sun</SelectItem>
                    <SelectItem value="partial_shade">Partial Shade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Difficulty</Label>
                <Select value={formData.difficulty} onValueChange={(v) => setFormData({ ...formData, difficulty: v })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Level</SelectItem>
                    <SelectItem value="beginner">Beginner Friendly</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 pb-2">
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Get Recommendations
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Recommended for You:</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const growLists = await base44.entities.GrowList.filter({ created_by: user.email });
                  if (growLists.length === 0) {
                    toast.error('Create a grow list first');
                    return;
                  }
                  
                  const targetList = growLists[0];
                  const existingItems = targetList.items || [];
                  const newItems = recommendations.recommendations.map(rec => ({
                    variety_name: rec.variety_name || rec.common_name,
                    plant_type_name: rec.common_name,
                    quantity: 1,
                    added_date: new Date().toISOString()
                  }));
                  
                  await base44.entities.GrowList.update(targetList.id, {
                    items: [...existingItems, ...newItems]
                  });
                  
                  toast.success(`Added ${newItems.length} varieties to ${targetList.name}`);
                }}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add All to Grow List
              </Button>
            </div>
            {recommendations.recommendations?.map((rec, idx) => (
              <Card key={idx} className={`border-l-4 ${rec.has_affiliate_link ? 'border-l-emerald-500' : 'border-l-purple-400'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-semibold text-base">{rec.common_name}</h4>
                        {rec.variety_name && (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-xs">{rec.variety_name}</Badge>
                        )}
                        {rec.has_affiliate_link && (
                          <Badge className="bg-emerald-100 text-emerald-800 text-xs">🛒 Seeds Available</Badge>
                        )}
                        {rec.difficulty && <Badge className="bg-gray-100 text-gray-600 text-xs">{rec.difficulty}</Badge>}
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{rec.reason}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        {rec.start_timing && <span>🌱 {rec.start_timing}</span>}
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
                        <Link to={createPageUrl('PlantCatalog') + `?search=${encodeURIComponent(rec.variety_name || rec.common_name)}`}>
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View Catalog
                        </Link>
                      </Button>
                      <AddToStashButton variety={{ variety_name: rec.variety_name || rec.common_name, plant_type_name: rec.common_name }} size="sm" />
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
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
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