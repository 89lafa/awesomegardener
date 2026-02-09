import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function EnvironmentTab({ plant, plantId, onUpdate }) {
  const [envData, setEnvData] = useState({
    window_direction: plant.window_direction || '',
    distance_from_window: plant.distance_from_window || '',
    daily_light_hours: plant.daily_light_hours || '',
    has_grow_light: plant.has_grow_light || false,
    grow_light_hours: plant.grow_light_hours || '',
    grow_light_type: plant.grow_light_type || '',
    watering_method: plant.watering_method || '',
    watering_frequency_days: plant.watering_frequency_days || '',
    soil_dryness_preference: plant.soil_dryness_preference || '',
    draft_exposure: plant.draft_exposure || false,
    humidity_support_method: plant.humidity_support_method || '',
    fertilizer_type_used: plant.fertilizer_type_used || '',
    fertilizer_brand: plant.fertilizer_brand || '',
    fertilizing_frequency_weeks: plant.fertilizing_frequency_weeks || '',
    current_pot_material: plant.current_pot_material || plant.pot_type || '',
    pot_size_inches: plant.pot_size_inches || '',
    pot_has_drainage: plant.pot_has_drainage !== undefined ? plant.pot_has_drainage : plant.has_drainage !== undefined ? plant.has_drainage : true,
    soil_type: plant.soil_type || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.IndoorPlant.update(plantId, {
        ...envData,
        watering_frequency_days: envData.watering_frequency_days ? parseFloat(envData.watering_frequency_days) : null,
        daily_light_hours: envData.daily_light_hours ? parseFloat(envData.daily_light_hours) : null,
        grow_light_hours: envData.grow_light_hours ? parseFloat(envData.grow_light_hours) : null,
        fertilizing_frequency_weeks: envData.fertilizing_frequency_weeks ? parseFloat(envData.fertilizing_frequency_weeks) : null,
        pot_size_inches: envData.pot_size_inches ? parseFloat(envData.pot_size_inches) : null
      });
      toast.success('Environment settings saved!');
      onUpdate();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">☀️ Light Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Window Direction</Label>
              <Select value={envData.window_direction} onValueChange={(v) => setEnvData({...envData, window_direction: v})}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="north">North</SelectItem>
                  <SelectItem value="east">East</SelectItem>
                  <SelectItem value="south">South</SelectItem>
                  <SelectItem value="west">West</SelectItem>
                  <SelectItem value="none">No window</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Distance from Window</Label>
              <Select value={envData.distance_from_window} onValueChange={(v) => setEnvData({...envData, distance_from_window: v})}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select distance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_sill">On windowsill</SelectItem>
                  <SelectItem value="1-3ft">1-3 feet away</SelectItem>
                  <SelectItem value="3-6ft">3-6 feet away</SelectItem>
                  <SelectItem value="6ft_plus">6+ feet away</SelectItem>
                  <SelectItem value="no_window">No window nearby</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Estimated Light Hours per Day</Label>
            <Input
              type="number"
              value={envData.daily_light_hours}
              onChange={(e) => setEnvData({...envData, daily_light_hours: e.target.value})}
              placeholder="e.g., 6"
              className="mt-2"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={envData.has_grow_light}
              onCheckedChange={(checked) => setEnvData({...envData, has_grow_light: checked})}
            />
            <Label>Using grow light</Label>
          </div>

          {envData.has_grow_light && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
              <div>
                <Label>Grow Light Hours</Label>
                <Input
                  type="number"
                  value={envData.grow_light_hours}
                  onChange={(e) => setEnvData({...envData, grow_light_hours: e.target.value})}
                  placeholder="e.g., 12"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Grow Light Type</Label>
                <Select value={envData.grow_light_type} onValueChange={(v) => setEnvData({...envData, grow_light_type: v})}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="led_full_spectrum">LED Full Spectrum</SelectItem>
                    <SelectItem value="led_red_blue">LED Red/Blue</SelectItem>
                    <SelectItem value="fluorescent">Fluorescent</SelectItem>
                    <SelectItem value="t5">T5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">💧 Watering Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Watering Method</Label>
              <Select value={envData.watering_method} onValueChange={(v) => setEnvData({...envData, watering_method: v})}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="How do you water?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top water</SelectItem>
                  <SelectItem value="bottom">Bottom water</SelectItem>
                  <SelectItem value="ice_cube">Ice cube method</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Watering Frequency (days)</Label>
              <Input
                type="number"
                value={envData.watering_frequency_days}
                onChange={(e) => setEnvData({...envData, watering_frequency_days: e.target.value})}
                placeholder="e.g., 7"
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label>Soil Dryness Rule</Label>
            <Select value={envData.soil_dryness_preference} onValueChange={(v) => setEnvData({...envData, soil_dryness_preference: v})}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="When to water?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep_moist">Keep soil moist</SelectItem>
                <SelectItem value="top_inch_dry">Let top inch dry</SelectItem>
                <SelectItem value="top_half_dry">Let top half dry</SelectItem>
                <SelectItem value="fully_dry">Let fully dry</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">💨 Humidity & Environment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Humidity Support Method</Label>
            <Select value={envData.humidity_support_method} onValueChange={(v) => setEnvData({...envData, humidity_support_method: v})}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="pebble_tray">Pebble tray</SelectItem>
                <SelectItem value="grouping">Grouping with other plants</SelectItem>
                <SelectItem value="misting">Misting</SelectItem>
                <SelectItem value="humidifier">Humidifier</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={envData.draft_exposure}
              onCheckedChange={(checked) => setEnvData({...envData, draft_exposure: checked})}
            />
            <Label>Near vent, door, or drafty window</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">🌱 Fertilizer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Fertilizer Type Used</Label>
            <Input
              value={envData.fertilizer_type_used}
              onChange={(e) => setEnvData({...envData, fertilizer_type_used: e.target.value})}
              placeholder="e.g., Balanced 10-10-10"
              className="mt-2"
            />
          </div>
          <div>
            <Label>Brand</Label>
            <Input
              value={envData.fertilizer_brand}
              onChange={(e) => setEnvData({...envData, fertilizer_brand: e.target.value})}
              placeholder="e.g., Schultz, Miracle-Gro"
              className="mt-2"
            />
          </div>
          <div>
            <Label>Fertilizing Frequency (weeks)</Label>
            <Input
              type="number"
              value={envData.fertilizing_frequency_weeks}
              onChange={(e) => setEnvData({...envData, fertilizing_frequency_weeks: e.target.value})}
              placeholder="e.g., 4"
              className="mt-2"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">🪴 Pot & Soil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Pot Material</Label>
              <Select value={envData.current_pot_material} onValueChange={(v) => setEnvData({...envData, current_pot_material: v})}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plastic">Plastic</SelectItem>
                  <SelectItem value="ceramic">Ceramic</SelectItem>
                  <SelectItem value="terracotta">Terracotta</SelectItem>
                  <SelectItem value="fabric">Fabric</SelectItem>
                  <SelectItem value="self_watering">Self-watering</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pot Size (inches)</Label>
              <Input
                type="number"
                value={envData.pot_size_inches}
                onChange={(e) => setEnvData({...envData, pot_size_inches: e.target.value})}
                placeholder="e.g., 8"
                className="mt-2"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={envData.pot_has_drainage}
              onCheckedChange={(checked) => setEnvData({...envData, pot_has_drainage: checked})}
            />
            <Label>Pot has drainage holes</Label>
          </div>

          <div>
            <Label>Soil Mix</Label>
            <Select value={envData.soil_type} onValueChange={(v) => setEnvData({...envData, soil_type: v})}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select soil type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="potting_soil_general">General potting soil</SelectItem>
                <SelectItem value="chunky_aroid">Chunky aroid mix</SelectItem>
                <SelectItem value="cactus_mix">Cactus/succulent mix</SelectItem>
                <SelectItem value="orchid_bark">Orchid bark</SelectItem>
                <SelectItem value="tropical_mix">Tropical mix</SelectItem>
                <SelectItem value="peat_based">Peat based</SelectItem>
                <SelectItem value="coco_coir">Coco coir</SelectItem>
                <SelectItem value="carnivorous_mix">Carnivorous mix</SelectItem>
                <SelectItem value="custom_mix">Custom mix</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
        {saving ? 'Saving...' : '💾 Save Environment Settings'}
      </Button>
    </div>
  );
}