import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, CheckCircle2, Calendar, Users, Sprout } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function BuildCalendarWizard({ open, onOpenChange, onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [gardens, setGardens] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [proposedPlan, setProposedPlan] = useState(null);
  
  const [formData, setFormData] = useState({
    garden_id: '',
    garden_season_id: '',
    harvest_months: '',
    desired_crops: '',
    household_size: 2,
    container_mode: false,
    sun_exposure: 'full_sun',
    time_commitment: 'moderate'
  });

  useEffect(() => {
    if (open) {
      loadGardens();
    }
  }, [open]);

  const loadGardens = async () => {
    try {
      const user = await base44.auth.me();
      const gardensData = await base44.entities.Garden.filter({ created_by: user.email, archived: false });
      setGardens(gardensData);
      if (gardensData.length > 0) {
        setFormData({ ...formData, garden_id: gardensData[0].id });
        loadSeasons(gardensData[0].id);
      }
    } catch (error) {
      console.error('[AI_CALENDAR] Error loading gardens:', error);
    }
  };

  const loadSeasons = async (gardenId) => {
    try {
      const seasonsData = await base44.entities.GardenSeason.filter({ garden_id: gardenId });
      setSeasons(seasonsData);
      if (seasonsData.length > 0) {
        setFormData({ ...formData, garden_season_id: seasonsData[0].id });
      }
    } catch (error) {
      console.error('[AI_CALENDAR] Error loading seasons:', error);
    }
  };

  const handleGenerate = async () => {
    if (!formData.garden_season_id) {
      toast.error('Please select a garden and season');
      return;
    }

    setLoading(true);
    console.debug('[AI_CALENDAR] Request sent', formData);

    try {
      const user = await base44.auth.me();
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert garden planner. Create a seasonal crop plan.

User Profile:
- USDA Zone: ${user.usda_zone || 'unknown'}
- Last Frost: ${user.last_frost_date || 'unknown'}
- First Frost: ${user.first_frost_date || 'unknown'}

Goals:
- Harvest months: ${formData.harvest_months || 'any'}
- Desired crops: ${formData.desired_crops || 'surprise me with variety'}
- Household size: ${formData.household_size} people
- Container gardening: ${formData.container_mode ? 'yes' : 'no'}
- Sun exposure available: ${formData.sun_exposure}
- Time commitment: ${formData.time_commitment}

Generate a realistic crop plan with 5-10 crop suggestions. For each crop provide:
1. Common name (e.g., "Tomato", "Lettuce")
2. Suggested variety name if you know a good one
3. Quantity recommended
4. Why it fits (timing, space, goals)
5. Approximate planting window (weeks relative to last frost)

Return structured data.`,
        response_json_schema: {
          type: "object",
          properties: {
            crops: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  common_name: { type: "string" },
                  variety_suggestion: { type: "string" },
                  quantity: { type: "number" },
                  reason: { type: "string" },
                  plant_weeks_before_after_frost: { type: "number" }
                }
              }
            },
            plan_notes: { type: "string" }
          }
        }
      });

      console.debug('[AI_CALENDAR] Response received', response);
      setProposedPlan(response);
      setStep(2);
    } catch (error) {
      console.error('[AI_CALENDAR] Error:', error);
      toast.error('Failed to generate plan: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setLoading(true);
    try {
      // Create CropPlans from AI suggestions
      const created = [];
      for (const crop of proposedPlan.crops || []) {
        // Find matching PlantType
        const plantTypes = await base44.entities.PlantType.filter({ common_name: crop.common_name });
        if (plantTypes.length === 0) continue;
        
        const cropPlan = await base44.entities.CropPlan.create({
          garden_season_id: formData.garden_season_id,
          garden_id: formData.garden_id,
          plant_type_id: plantTypes[0].id,
          label: crop.variety_suggestion || crop.common_name,
          quantity_planned: crop.quantity || 1,
          planting_method: 'transplant',
          notes: crop.reason
        });
        created.push(cropPlan);
      }

      toast.success(`Created ${created.length} crop plans! Generate tasks in Calendar.`);
      onComplete?.();
      handleClose();
    } catch (error) {
      console.error('[AI_CALENDAR] Error creating plans:', error);
      toast.error('Failed to create plans');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setProposedPlan(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>✨ AI Build My Calendar</DialogTitle>
          <DialogDescription>
            Let AI suggest a crop plan based on your location, goals, and available space
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-blue-50 border-blue-200">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            AI will suggest crops based on your frost dates and goals. You can review and modify before creating plans.
          </AlertDescription>
        </Alert>

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Garden *</Label>
                <Select value={formData.garden_id} onValueChange={(v) => {
                  setFormData({ ...formData, garden_id: v });
                  loadSeasons(v);
                }}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select garden" />
                  </SelectTrigger>
                  <SelectContent>
                    {gardens.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Season *</Label>
                <Select value={formData.garden_season_id} onValueChange={(v) => setFormData({ ...formData, garden_season_id: v })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select season" />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.season_name || s.year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Desired Harvest Months (optional)</Label>
              <Input
                placeholder="e.g., June-September"
                value={formData.harvest_months}
                onChange={(e) => setFormData({ ...formData, harvest_months: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label>What do you want to grow? (optional)</Label>
              <Textarea
                placeholder="e.g., Tomatoes, peppers, lettuce, herbs... or leave blank to let AI surprise you"
                value={formData.desired_crops}
                onChange={(e) => setFormData({ ...formData, desired_crops: e.target.value })}
                className="mt-2"
                rows={3}
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label>Household Size</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.household_size}
                  onChange={(e) => setFormData({ ...formData, household_size: parseInt(e.target.value) || 1 })}
                  className="mt-2"
                />
              </div>
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
                <Label>Time Commitment</Label>
                <Select value={formData.time_commitment} onValueChange={(v) => setFormData({ ...formData, time_commitment: v })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (less than 3 hrs/week)</SelectItem>
                    <SelectItem value="moderate">Moderate (3-7 hrs/week)</SelectItem>
                    <SelectItem value="high">High (7+ hrs/week)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && proposedPlan && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Proposed Crop Plan</h3>
            
            {proposedPlan.plan_notes && (
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{proposedPlan.plan_notes}</p>
            )}

            <div className="space-y-2">
              {proposedPlan.crops?.map((crop, idx) => (
                <Card key={idx}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Sprout className="w-4 h-4 text-emerald-600" />
                          <span className="font-semibold">{crop.common_name}</span>
                          {crop.variety_suggestion && (
                            <Badge variant="outline" className="text-xs">{crop.variety_suggestion}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{crop.reason}</p>
                        <div className="flex gap-3 text-xs text-gray-500">
                          <span>Qty: {crop.quantity}</span>
                          <span>Plant: {crop.plant_weeks_before_after_frost > 0 ? '+' : ''}{crop.plant_weeks_before_after_frost} weeks from last frost</span>
                        </div>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Alert className="bg-amber-50 border-amber-200">
              <AlertDescription className="text-sm text-amber-800">
                This will create {proposedPlan.crops?.length || 0} crop plans. You can edit them and generate tasks in the Calendar afterwards.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={handleGenerate}
                disabled={!formData.garden_season_id || loading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Generate Plan
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button 
                onClick={handleApply}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Crop Plans
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}