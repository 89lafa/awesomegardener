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
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={createPageUrl('PlantCatalog') + `?search=${encodeURIComponent(rec.common_name)}`}>
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View
                        </Link>
                      </Button>
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