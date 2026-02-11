import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EditPlantLocationModal({ open, onClose, plant, onSuccess }) {
  const [spaces, setSpaces] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    indoor_space_id: '',
    tier_id: '',
    grid_position_x: '',
    grid_position_y: ''
  });

  useEffect(() => {
    if (open && plant) {
      loadData();
      setFormData({
        indoor_space_id: plant.indoor_space_id || '',
        tier_id: plant.tier_id || '',
        grid_position_x: plant.grid_position_x !== null && plant.grid_position_x !== undefined ? plant.grid_position_x : '',
        grid_position_y: plant.grid_position_y !== null && plant.grid_position_y !== undefined ? plant.grid_position_y : ''
      });
    }
  }, [open, plant]);

  useEffect(() => {
    if (formData.indoor_space_id) {
      loadTiers(formData.indoor_space_id);
    }
  }, [formData.indoor_space_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const spacesData = await base44.entities.IndoorSpace.filter({ is_active: true });
      setSpaces(spacesData);
    } catch (error) {
      console.error('Error loading spaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTiers = async (spaceId) => {
    try {
      const tiersData = await base44.entities.IndoorSpaceTier.filter(
        { indoor_space_id: spaceId },
        'tier_number'
      );
      setTiers(tiersData);
    } catch (error) {
      console.error('Error loading tiers:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Check for duplicate placement - prevent same plant in multiple locations
      const existingPlantsInSpace = await base44.entities.IndoorPlant.filter({
        indoor_space_id: formData.indoor_space_id,
        is_active: true
      });

      // Check if any OTHER plant has same grid position
      if (formData.tier_id && formData.grid_position_x !== '' && formData.grid_position_y !== '') {
        const collision = existingPlantsInSpace.find(p => 
          p.id !== plant.id && 
          p.tier_id === formData.tier_id &&
          p.grid_position_x === parseInt(formData.grid_position_x) &&
          p.grid_position_y === parseInt(formData.grid_position_y)
        );

        if (collision) {
          toast.error('Another plant is already in that grid position!');
          setSaving(false);
          return;
        }
      }

      await base44.entities.IndoorPlant.update(plant.id, {
        indoor_space_id: formData.indoor_space_id || null,
        tier_id: formData.tier_id || null,
        grid_position_x: formData.grid_position_x !== '' ? parseInt(formData.grid_position_x) : null,
        grid_position_y: formData.grid_position_y !== '' ? parseInt(formData.grid_position_y) : null
      });
      
      toast.success('Plant location updated!');
      onSuccess();
    } catch (error) {
      console.error('Error updating plant location:', error);
      toast.error('Failed to update location');
    } finally {
      setSaving(false);
    }
  };

  const selectedTier = tiers.find(t => t.id === formData.tier_id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {plant?.nickname || 'Plant'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Space *</Label>
              <Select 
                value={formData.indoor_space_id} 
                onValueChange={(v) => {
                  setFormData({ ...formData, indoor_space_id: v, tier_id: '', grid_position_x: '', grid_position_y: '' });
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select space" />
                </SelectTrigger>
                <SelectContent>
                  {spaces.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tiers.length > 0 && (
              <div>
                <Label>Tier/Shelf (optional)</Label>
                <Select 
                  value={formData.tier_id} 
                  onValueChange={(v) => {
                    setFormData({ ...formData, tier_id: v, grid_position_x: '', grid_position_y: '' });
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="No specific tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiers.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label || `Tier ${t.tier_number}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.tier_id && selectedTier && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Grid Position X</Label>
                  <Input
                    type="number"
                    min="0"
                    max={(selectedTier.grid_columns || 4) - 1}
                    placeholder="0"
                    value={formData.grid_position_x}
                    onChange={(e) => setFormData({ ...formData, grid_position_x: e.target.value })}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">0-{(selectedTier.grid_columns || 4) - 1}</p>
                </div>
                <div>
                  <Label>Grid Position Y</Label>
                  <Input
                    type="number"
                    min="0"
                    max={(selectedTier.grid_rows || 2) - 1}
                    placeholder="0"
                    value={formData.grid_position_y}
                    onChange={(e) => setFormData({ ...formData, grid_position_y: e.target.value })}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">0-{(selectedTier.grid_rows || 2) - 1}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || !formData.indoor_space_id}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Update Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}