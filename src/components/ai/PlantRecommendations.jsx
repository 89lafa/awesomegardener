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
import { smartQuery } from '@/components/utils/smartQuery';

function ViewVarietyButton({ rec }) {
  const [searching, setSearching] = useState(false);

  const handleView = async () => {
    setSearching(true);
    try {
      // First search by exact variety name
      if (rec.variety_name) {
        const varieties = await base44.entities.Variety.filter({ 
          variety_name: rec.variety_name,
          status: 'active'
        });
        if (varieties.length > 0) {
          window.location.href = createPageUrl('ViewVariety') + `?id=${varieties[0].id}`;
          return;
        }
        
        // Try partial match
        const allVarieties = await smartQuery(base44, 'Variety', { status: 'active' }, 'variety_name', 500);
        const match = allVarieties.find(v => 
          v.variety_name.toLowerCase() === rec.variety_name.toLowerCase() ||
          v.variety_name.toLowerCase().includes(rec.variety_name.toLowerCase())
        );
        if (match) {
          window.location.href = createPageUrl('ViewVariety') + `?id=${match.id}`;
          return;
        }
      }

      // Fallback: search by plant type
      const plantTypes = await base44.entities.PlantType.list('common_name');
      const type = plantTypes.find(pt => 
        pt.common_name && pt.common_name.toLowerCase() === rec.common_name.toLowerCase()
      );
      
      if (type) {
        window.location.href = createPageUrl('PlantCatalog') + `?type=${type.id}`;
      } else {
        window.location.href = createPageUrl('PlantCatalog') + `?search=${encodeURIComponent(rec.common_name)}`;
      }
    } catch (error) {
      console.error('View variety error:', error);
      toast.error('Failed to find variety');
    } finally {
      setSearching(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleView} disabled={searching}>
      {searching ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ExternalLink className="w-3 h-3 mr-1" />}
      View
    </Button>
  );
}

function AddToStashButton({ rec, onAdded }) {
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    try {
      // Find plant type
      const plantTypes = await base44.entities.PlantType.list('common_name');
      const plantType = plantTypes.find(pt => 
        pt.common_name && pt.common_name.toLowerCase() === rec.common_name.toLowerCase()
      );
      
      if (!plantType) {
        toast.error('Plant type not found in catalog');
        return;
      }

      // Find or create PlantProfile
      let profile = null;
      if (rec.variety_name) {
        const profiles = await base44.entities.PlantProfile.filter({
          plant_type_id: plantType.id,
          variety_name: rec.variety_name
        });
        profile = profiles[0];
      }

      if (!profile) {
        // Create new profile
        profile = await base44.entities.PlantProfile.create({
          plant_type_id: plantType.id,
          common_name: plantType.common_name,
          variety_name: rec.variety_name || plantType.common_name,
          source_type: 'user_private'
        });
      }

      // Create seed lot with is_wishlist=true
      await base44.entities.SeedLot.create({
        plant_profile_id: profile.id,
        is_wishlist: true,
        lot_notes: `AI Recommended: ${rec.reason}`
      });

      toast.success(`Added ${rec.variety_name || rec.common_name} to wishlist!`);
      if (onAdded) onAdded();
    } catch (error) {
      console.error('Add to stash error:', error);
      toast.error('Failed to add to stash');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleAdd} disabled={adding} className="gap-1">
      {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
      Add to Stash
    </Button>
  );
}

function AddToGrowListButton({ rec, onAdded }) {
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    try {
      // Find active grow list or create one
      const user = await base44.auth.me();
      let growLists = await base44.entities.GrowList.filter({
        created_by: user.email,
        status: 'active'
      });
      
      let growList = growLists[0];
      if (!growList) {
        growList = await base44.entities.GrowList.create({
          name: `${new Date().getFullYear()} Grow List`,
          status: 'active',
          year: new Date().getFullYear(),
          items: []
        });
      }

      // Find plant type and variety
      const plantTypes = await base44.entities.PlantType.list('common_name');
      const plantType = plantTypes.find(pt => 
        pt.common_name && pt.common_name.toLowerCase() === rec.common_name.toLowerCase()
      );

      if (!plantType) {
        toast.error('Plant type not found');
        return;
      }

      // Find variety if specified
      let varietyId = null;
      if (rec.variety_name) {
        const varieties = await base44.entities.Variety.filter({
          plant_type_id: plantType.id,
          variety_name: rec.variety_name,
          status: 'active'
        });
        if (varieties.length > 0) varietyId = varieties[0].id;
      }

      // Add to grow list
      const items = growList.items || [];
      items.push({
        plant_type_id: plantType.id,
        plant_type_name: plantType.common_name,
        variety_id: varietyId,
        variety_name: rec.variety_name || null,
        quantity: 1,
        added_date: new Date().toISOString()
      });

      await base44.entities.GrowList.update(growList.id, { items });
      toast.success(`Added to ${growList.name}!`);
      if (onAdded) onAdded();
    } catch (error) {
      console.error('Add to grow list error:', error);
      toast.error('Failed to add to grow list');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleAdd} disabled={adding} className="gap-1">
      {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <ListChecks className="w-3 h-3" />}
      Grow List
    </Button>
  );
}

export default function PlantRecommendations({ open, onOpenChange, context = 'catalog' }) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [formData, setFormData] = useState({
    harvest_months: '',
    container_only: false,
    sun_exposure: 'full_sun',
    difficulty: 'any'
  });

  const handleGenerate = async () => {
    setLoading(true);
    console.debug('[AI_RECOMMEND] Request sent', formData);

    try {
      const user = await base44.auth.me();
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a gardening expert. Recommend 5-8 plant varieties based on these criteria:

Location Profile:
- USDA Zone: ${user.usda_zone || 'unknown'}
- Last Frost: ${user.last_frost_date || 'unknown'}
- First Frost: ${user.first_frost_date || 'unknown'}

User Preferences:
- Desired harvest months: ${formData.harvest_months || 'any'}
- Container gardening only: ${formData.container_only ? 'yes' : 'no'}
- Sun exposure: ${formData.sun_exposure}
- Difficulty preference: ${formData.difficulty}

For each recommendation, provide:
1. Common name (e.g., "Tomato")
2. Specific variety name if you have a good suggestion
3. Brief reason why it's a good fit (1-2 sentences)
4. Difficulty level (beginner/intermediate/advanced)
5. When to start (weeks before/after last frost)
6. When to harvest (approximate month range)

Return structured data.`,
        add_context_from_internet: true,
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
                  harvest_timing: { type: "string" }
                }
              }
            }
          }
        }
      });

      console.debug('[AI_RECOMMEND] Response received', response);
      setRecommendations(response);
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
          <div className="space-y-3">
            <h3 className="font-semibold">Recommended for You:</h3>
            {recommendations.recommendations?.map((rec, idx) => (
              <Card key={idx} className="border-l-4 border-l-purple-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-lg">{rec.common_name}</h4>
                        {rec.variety_name && (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300">{rec.variety_name}</Badge>
                        )}
                        <Badge className="bg-gray-100 text-gray-700 text-xs">{rec.difficulty}</Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-3">{rec.reason}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                        <span>🌱 Start: {rec.start_timing}</span>
                        <span>🍅 Harvest: {rec.harvest_timing}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 min-w-[120px]">
                      <ViewVarietyButton rec={rec} />
                      <AddToStashButton rec={rec} onAdded={() => {}} />
                      <AddToGrowListButton rec={rec} onAdded={() => {}} />
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
            <Button onClick={() => setRecommendations(null)} variant="outline">
              New Search
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}