import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EditSpaceModal({ open, onClose, space, onSuccess }) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location_type: 'tiered_rack',
    room_name: '',
    description: '',
    tier_count: '',
    width_inches: '',
    depth_inches: '',
    height_inches: '',
    has_grow_lights: false,
    light_type: 'natural',
    light_hours_per_day: '',
    avg_temperature_f: '',
    avg_humidity_percent: ''
  });

  useEffect(() => {
    if (open && space) {
      setFormData({
        name: space.name || '',
        location_type: space.location_type || 'tiered_rack',
        room_name: space.room_name || '',
        description: space.description || '',
        tier_count: space.tier_count || '',
        width_inches: space.width_inches || '',
        depth_inches: space.depth_inches || '',
        height_inches: space.height_inches || '',
        has_grow_lights: space.has_grow_lights || false,
        light_type: space.light_type || 'natural',
        light_hours_per_day: space.light_hours_per_day || '',
        avg_temperature_f: space.avg_temperature_f || '',
        avg_humidity_percent: space.avg_humidity_percent || ''
      });
    }
  }, [open, space]);

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Space name is required');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        ...formData,
        tier_count: formData.tier_count ? parseInt(formData.tier_count) : null,
        width_inches: formData.width_inches ? parseFloat(formData.width_inches) : null,
        depth_inches: formData.depth_inches ? parseFloat(formData.depth_inches) : null,
        height_inches: formData.height_inches ? parseFloat(formData.height_inches) : null,
        light_hours_per_day: formData.light_hours_per_day ? parseInt(formData.light_hours_per_day) : null,
        avg_temperature_f: formData.avg_temperature_f ? parseFloat(formData.avg_temperature_f) : null,
        avg_humidity_percent: formData.avg_humidity_percent ? parseFloat(formData.avg_humidity_percent) : null
      };

      await base44.entities.IndoorSpace.update(space.id, updateData);
      toast.success('Space updated!');
      onSuccess();
    } catch (error) {
      console.error('Error updating space:', error);
      toast.error('Failed to update space');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {space?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Space Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Living Room Rack"
              className="mt-2"
            />
          </div>

          <div>
            <Label>Location Type</Label>
            <Select value={formData.location_type} onValueChange={(v) => setFormData({ ...formData, location_type: v })}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tiered_rack">Multi-Tier Rack</SelectItem>
                <SelectItem value="bookshelf">Bookshelf</SelectItem>
                <SelectItem value="floating_shelf">Floating Shelf</SelectItem>
                <SelectItem value="window_sill">Window Sill</SelectItem>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="floor_standing">Floor Standing</SelectItem>
                <SelectItem value="hanging">Hanging</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Room Name</Label>
            <Input
              value={formData.room_name}
              onChange={(e) => setFormData({ ...formData, room_name: e.target.value })}
              placeholder="e.g., Living Room, Office"
              className="mt-2"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional notes about this space"
              rows={2}
              className="mt-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Width (inches)</Label>
              <Input
                type="number"
                value={formData.width_inches}
                onChange={(e) => setFormData({ ...formData, width_inches: e.target.value })}
                placeholder="48"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Depth (inches)</Label>
              <Input
                type="number"
                value={formData.depth_inches}
                onChange={(e) => setFormData({ ...formData, depth_inches: e.target.value })}
                placeholder="18"
                className="mt-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Temperature (°F)</Label>
              <Input
                type="number"
                value={formData.avg_temperature_f}
                onChange={(e) => setFormData({ ...formData, avg_temperature_f: e.target.value })}
                placeholder="70"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Humidity (%)</Label>
              <Input
                type="number"
                value={formData.avg_humidity_percent}
                onChange={(e) => setFormData({ ...formData, avg_humidity_percent: e.target.value })}
                placeholder="50"
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label>Light Hours per Day</Label>
            <Input
              type="number"
              value={formData.light_hours_per_day}
              onChange={(e) => setFormData({ ...formData, light_hours_per_day: e.target.value })}
              placeholder="12"
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || !formData.name}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}