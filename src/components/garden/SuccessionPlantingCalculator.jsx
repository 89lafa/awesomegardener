import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';

export function SuccessionPlantingCalculator({ varietyId, varietyName, gardenSeasonId, onGenerate }) {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [intervalDays, setIntervalDays] = useState(14);
  const [numSuccessions, setNumSuccessions] = useState(4);
  const [quantityPerPlanting, setQuantityPerPlanting] = useState(12);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState([]);

  const generatePreview = () => {
    const dates = [];
    for (let i = 0; i < numSuccessions; i++) {
      dates.push(addDays(new Date(startDate), i * intervalDays));
    }
    setPreview(dates);
  };

  const handleGenerate = async () => {
    if (!varietyId || !startDate || !intervalDays || !numSuccessions) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // Create SuccessionPlan record
      const successionPlan = await base44.entities.SuccessionPlan.create({
        garden_season_id: gardenSeasonId,
        variety_id: varietyId,
        variety_name: varietyName,
        start_date: startDate,
        interval_days: parseInt(intervalDays),
        num_successions: parseInt(numSuccessions),
        quantity_per_planting: parseInt(quantityPerPlanting)
      });

      // Generate CropPlans
      const cropPlanIds = [];
      for (let i = 0; i < numSuccessions; i++) {
        const sowDate = addDays(new Date(startDate), i * intervalDays);
        const cropPlan = await base44.entities.CropPlan.create({
          garden_season_id: gardenSeasonId,
          variety_id: varietyId,
          variety_name: varietyName,
          quantity: parseInt(quantityPerPlanting),
          planned_sow_date: format(sowDate, 'yyyy-MM-dd'),
          succession_number: i + 1,
          notes: `Part of succession planting (${i + 1}/${numSuccessions})`
        });
        cropPlanIds.push(cropPlan.id);
      }

      // Update succession plan with generated IDs
      await base44.entities.SuccessionPlan.update(successionPlan.id, {
        generated_crop_plans: cropPlanIds
      });

      toast.success(`Created ${numSuccessions} plantings!`);
      onGenerate?.();
    } catch (error) {
      console.error('Error generating succession plan:', error);
      toast.error('Failed to generate succession plantings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Succession Planting: {varietyName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Interval (days)</label>
            <Input
              type="number"
              value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value)}
              min="7"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Number of Plantings</label>
            <Input
              type="number"
              value={numSuccessions}
              onChange={(e) => setNumSuccessions(e.target.value)}
              min="1"
              max="12"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Quantity per Planting</label>
            <Input
              type="number"
              value={quantityPerPlanting}
              onChange={(e) => setQuantityPerPlanting(e.target.value)}
              min="1"
            />
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Planting Schedule</h4>
            <Button
              onClick={generatePreview}
              variant="outline"
              size="sm"
              className="gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Preview
            </Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            {preview.length === 0 ? (
              <p className="text-sm text-gray-600">Click "Preview" to see planting dates</p>
            ) : (
              preview.map((date, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    Planting {idx + 1}: {format(date, 'MMM d, yyyy')}
                  </span>
                  <span className="text-gray-600">{quantityPerPlanting} plants</span>
                </div>
              ))
            )}
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          {loading ? 'Generating...' : 'Generate Succession Plantings'}
        </Button>
      </CardContent>
    </Card>
  );
}