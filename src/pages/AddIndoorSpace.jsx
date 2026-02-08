import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const LOCATION_TYPES = [
  { value: 'tiered_rack', label: 'Multi-Tier Rack', icon: '🗄️' },
  { value: 'bookshelf', label: 'Bookshelf', icon: '📚' },
  { value: 'floating_shelf', label: 'Floating Shelf', icon: '📐' },
  { value: 'window_sill', label: 'Window Sill', icon: '🪟' },
  { value: 'table', label: 'Table/Desk', icon: '🪑' },
  { value: 'floor_standing', label: 'Floor', icon: '🏠' },
  { value: 'hanging', label: 'Hanging', icon: '🪝' },
  { value: 'greenhouse_mini', label: 'Mini Greenhouse', icon: '🏡' },
  { value: 'custom', label: 'Custom', icon: '✏️' }
];

const STRUCTURE_TYPES = [
  { value: 'wire_rack_4tier', label: '4-Tier Wire Rack' },
  { value: 'wire_rack_5tier', label: '5-Tier Wire Rack' },
  { value: 'wire_rack_6tier', label: '6-Tier Wire Rack' },
  { value: 'wood_shelf_3tier', label: '3-Tier Wood Shelf' },
  { value: 'metal_shelf_4tier', label: '4-Tier Metal Shelf' },
  { value: 'custom_rack', label: 'Custom Rack' }
];

export default function AddIndoorSpace() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location_type: '',
    room_name: '',
    description: '',
    structure_type: '',
    tier_count: 4,
    width_inches: 48,
    depth_inches: 18,
    height_inches: 72,
    has_grow_lights: false,
    light_type: 'natural',
    light_hours_per_day: 12,
    avg_temperature_f: 70,
    avg_humidity_percent: 50
  });

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.location_type) {
      toast.error('Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      // Generate share token
      const shareToken = Math.random().toString(36).substring(2, 18);
      
      // Create space
      const space = await base44.entities.IndoorSpace.create({
        ...formData,
        share_token: shareToken
      });

      // Auto-create tiers if tiered structure
      if (formData.location_type === 'tiered_rack' && formData.tier_count > 0) {
        await createTiersForSpace(space.id, formData.tier_count, formData);
      }

      toast.success('Indoor space created!');
      navigate(createPageUrl('IndoorPlants'));
    } catch (error) {
      console.error('Error creating space:', error);
      toast.error('Failed to create space');
    } finally {
      setLoading(false);
    }
  };

  const createTiersForSpace = async (spaceId, tierCount, spaceData) => {
    const tierLabels = {
      1: 'Bottom',
      2: 'Lower',
      3: 'Middle-Lower',
      4: 'Middle',
      5: 'Upper',
      6: 'Top'
    };

    for (let i = 1; i <= tierCount; i++) {
      await base44.entities.IndoorSpaceTier.create({
        indoor_space_id: spaceId,
        tier_number: i,
        label: tierLabels[i] || `Tier ${i}`,
        width_inches: spaceData.width_inches,
        depth_inches: spaceData.depth_inches,
        height_clearance_inches: Math.floor(spaceData.height_inches / tierCount),
        has_grow_light: spaceData.has_grow_lights,
        light_hours_per_day: spaceData.light_hours_per_day,
        avg_temperature_f: spaceData.avg_temperature_f,
        avg_humidity_percent: spaceData.avg_humidity_percent
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => step > 1 ? setStep(step - 1) : navigate(createPageUrl('IndoorPlants'))}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Add Indoor Space</h1>
          <p className="text-sm text-gray-500">Step {step} of 3</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-emerald-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div>
              <Label htmlFor="name">Space Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Living Room Rack"
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Location Type *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                {LOCATION_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => updateFormData({ location_type: type.value })}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      formData.location_type === type.value
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">{type.icon}</div>
                    <div className="text-sm font-medium">{type.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {formData.location_type === 'tiered_rack' && (
              <>
                <div>
                  <Label>Rack Type</Label>
                  <Select
                    value={formData.structure_type}
                    onValueChange={(value) => updateFormData({ structure_type: value })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select rack type" />
                    </SelectTrigger>
                    <SelectContent>
                      {STRUCTURE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Number of Tiers: {formData.tier_count}</Label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formData.tier_count}
                    onChange={(e) => updateFormData({ tier_count: parseInt(e.target.value) })}
                    className="w-full mt-2"
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="room">Room</Label>
              <Input
                id="room"
                placeholder="e.g., Living Room"
                value={formData.room_name}
                onChange={(e) => updateFormData({ room_name: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Any notes about this space..."
                value={formData.description}
                onChange={(e) => updateFormData({ description: e.target.value })}
                className="mt-2"
              />
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!formData.name || !formData.location_type}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              Next: Dimensions
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Dimensions */}
      {step === 2 && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="width">Width (inches)</Label>
                <Input
                  id="width"
                  type="number"
                  value={formData.width_inches}
                  onChange={(e) => updateFormData({ width_inches: parseFloat(e.target.value) })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="depth">Depth (inches)</Label>
                <Input
                  id="depth"
                  type="number"
                  value={formData.depth_inches}
                  onChange={(e) => updateFormData({ depth_inches: parseFloat(e.target.value) })}
                  className="mt-2"
                />
              </div>
            </div>

            {formData.location_type === 'tiered_rack' && (
              <div>
                <Label htmlFor="height">Total Height (inches)</Label>
                <Input
                  id="height"
                  type="number"
                  value={formData.height_inches}
                  onChange={(e) => updateFormData({ height_inches: parseFloat(e.target.value) })}
                  className="mt-2"
                />
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Dimensions help:</strong> Measure your actual space. Common sizes:
                <br />• Small rack: 36" W × 14" D
                <br />• Standard rack: 48" W × 18" D
                <br />• Large rack: 72" W × 24" D
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                Next: Environment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Environment */}
      {step === 3 && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="growLights"
                checked={formData.has_grow_lights}
                onChange={(e) => updateFormData({ has_grow_lights: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600"
              />
              <Label htmlFor="growLights">This space has grow lights</Label>
            </div>

            <div>
              <Label>Light Type</Label>
              <Select
                value={formData.light_type}
                onValueChange={(value) => updateFormData({ light_type: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural">Natural Light</SelectItem>
                  <SelectItem value="led_full_spectrum">LED Full Spectrum</SelectItem>
                  <SelectItem value="fluorescent">Fluorescent</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="lightHours">Light Hours per Day: {formData.light_hours_per_day}</Label>
              <input
                type="range"
                id="lightHours"
                min="0"
                max="24"
                value={formData.light_hours_per_day}
                onChange={(e) => updateFormData({ light_hours_per_day: parseInt(e.target.value) })}
                className="w-full mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="temp">Avg Temperature (°F)</Label>
                <Input
                  id="temp"
                  type="number"
                  value={formData.avg_temperature_f}
                  onChange={(e) => updateFormData({ avg_temperature_f: parseFloat(e.target.value) })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="humidity">Avg Humidity (%)</Label>
                <Input
                  id="humidity"
                  type="number"
                  value={formData.avg_humidity_percent}
                  onChange={(e) => updateFormData({ avg_humidity_percent: parseFloat(e.target.value) })}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-900">
                <strong>Environmental settings</strong> can be refined later. These are just estimates to help you track conditions.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Space'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}