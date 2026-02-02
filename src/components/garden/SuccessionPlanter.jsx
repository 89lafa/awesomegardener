import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, Zap } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';

export function SuccessionPlanter({ varieties, gardenSeasonId, onComplete }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    variety_id: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    interval_days: 14,
    num_successions: 3,
    quantity_per_planting: 1
  });

  const handleGenerate = async () => {
    if (!formData.variety_id) {
      toast.error('Please select a variety');
      return;
    }

    try {
      const variety = varieties.find(v => v.id === formData.variety_id);
      
      const plan = await base44.entities.SuccessionPlan.create({
        garden_season_id: gardenSeasonId,
        variety_id: formData.variety_id,
        variety_name: variety.variety_name,
        plant_type_id: variety.plant_type_id,
        start_date: formData.start_date,
        interval_days: parseInt(formData.interval_days),
        num_successions: parseInt(formData.num_successions),
        quantity_per_planting: parseInt(formData.quantity_per_planting),
        generated_crop_plans: []
      });

      // Create individual crop plans
      const cropPlanIds = [];
      for (let i = 0; i < parseInt(formData.num_successions); i++) {
        const plantDate = addDays(
          new Date(formData.start_date),
          i * parseInt(formData.interval_days)
        );

        const cropPlan = await base44.entities.CropPlan.create({
          garden_season_id: gardenSeasonId,
          variety_id: formData.variety_id,
          plant_type_id: variety.plant_type_id,
          sow_date: format(plantDate, 'yyyy-MM-dd'),
          succession_index: i,
          succession_plan_id: plan.id,
          quantity: parseInt(formData.quantity_per_planting)
        });

        cropPlanIds.push(cropPlan.id);
      }

      // Update plan with generated crop plan IDs
      await base44.entities.SuccessionPlan.update(plan.id, {
        generated_crop_plans: cropPlanIds
      });

      toast.success(`Created ${formData.num_successions} succession plantings!`);
      setShowForm(false);
      setFormData({
        variety_id: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        interval_days: 14,
        num_successions: 3,
        quantity_per_planting: 1
      });
      onComplete?.();
    } catch (error) {
      console.error('Error generating succession plan:', error);
      toast.error('Failed to create succession plan');
    }
  };

  const selectedVariety = varieties.find(v => v.id === formData.variety_id);
  const daysToMaturity = selectedVariety?.days_to_maturity || 60;

  // Preview succession dates
  const previewDates = Array.from({ length: parseInt(formData.num_successions) }).map((_, i) =>
    addDays(new Date(formData.start_date), i * parseInt(formData.interval_days))
  );

  return (
    <div className="space-y-4">
      {showForm && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Succession Planting Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Variety</label>
              <select
                value={formData.variety_id}
                onChange={(e) => setFormData({ ...formData, variety_id: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select a variety...</option>
                {varieties.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.variety_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Days Between Plantings</label>
                <Input
                  type="number"
                  min="7"
                  step="7"
                  value={formData.interval_days}
                  onChange={(e) => setFormData({ ...formData, interval_days: e.target.value })}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Number of Successions</label>
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={formData.num_successions}
                  onChange={(e) => setFormData({ ...formData, num_successions: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Quantity per Planting</label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantity_per_planting}
                  onChange={(e) => setFormData({ ...formData, quantity_per_planting: e.target.value })}
                />
              </div>
            </div>

            {/* Preview */}
            {selectedVariety && (
              <div className="bg-white rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm text-gray-900">Planting Schedule</h4>
                <div className="space-y-1 text-sm">
                  {previewDates.map((date, i) => (
                    <div key={i} className="flex justify-between text-gray-700">
                      <span>Planting {i + 1}:</span>
                      <span className="font-medium">{format(date, 'MMM d, yyyy')}</span>
                    </div>
                  ))}
                </div>
                {daysToMaturity && (
                  <div className="text-xs text-gray-600 mt-3 pt-3 border-t">
                    First harvest ~{daysToMaturity} days after first planting
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Generate Succession Plan
              </Button>
              <Button
                onClick={() => setShowForm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!showForm && (
        <Button
          onClick={() => setShowForm(true)}
          className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Succession Plan
        </Button>
      )}
    </div>
  );
}