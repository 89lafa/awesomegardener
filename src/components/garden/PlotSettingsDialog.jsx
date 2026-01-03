import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function PlotSettingsDialog({ plot, open, onOpenChange, onSave }) {
  const [settings, setSettings] = useState({
    width: plot.width / 12, // Convert inches to feet for display
    height: plot.height / 12,
    units: plot.units || 'ft',
    grid_size: plot.grid_size || 12,
    grid_enabled: plot.grid_enabled !== false,
    background_color: plot.background_color || '#ffffff'
  });

  const handleSave = () => {
    // Convert to inches for storage
    const widthInches = settings.units === 'ft' ? settings.width * 12 : settings.width;
    const heightInches = settings.units === 'ft' ? settings.height * 12 : settings.height;

    onSave({
      width: widthInches,
      height: heightInches,
      units: settings.units,
      grid_size: settings.grid_size,
      grid_enabled: settings.grid_enabled,
      background_color: settings.background_color
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plot Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="width">Width</Label>
              <Input
                id="width"
                type="number"
                value={settings.width}
                onChange={(e) => setSettings({ ...settings, width: parseFloat(e.target.value) })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="height">Height</Label>
              <Input
                id="height"
                type="number"
                value={settings.height}
                onChange={(e) => setSettings({ ...settings, height: parseFloat(e.target.value) })}
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label>Units</Label>
            <Select value={settings.units} onValueChange={(v) => setSettings({ ...settings, units: v })}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ft">Feet</SelectItem>
                <SelectItem value="in">Inches</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="gridSize">Grid Size (inches)</Label>
            <Input
              id="gridSize"
              type="number"
              value={settings.grid_size}
              onChange={(e) => setSettings({ ...settings, grid_size: parseInt(e.target.value) })}
              className="mt-2"
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.grid_enabled}
              onChange={(e) => setSettings({ ...settings, grid_enabled: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">Show Grid</span>
          </label>

          <div>
            <Label htmlFor="bgColor">Background Color</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="bgColor"
                type="color"
                value={settings.background_color}
                onChange={(e) => setSettings({ ...settings, background_color: e.target.value })}
                className="w-20 h-10"
              />
              <Input
                value={settings.background_color}
                onChange={(e) => setSettings({ ...settings, background_color: e.target.value })}
                placeholder="#ffffff"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}