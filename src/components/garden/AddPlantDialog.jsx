import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AddPlantDialog({ 
  open, 
  onOpenChange, 
  space, 
  cellCoords, 
  onPlantAdded 
}) {
  const [plantTypes, setPlantTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    plant_type_id: '',
    variety_id: '',
    quantity: 1,
    planted_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (open) {
      loadPlantTypes();
    }
  }, [open]);

  useEffect(() => {
    if (formData.plant_type_id) {
      loadVarieties(formData.plant_type_id);
    } else {
      setVarieties([]);
    }
  }, [formData.plant_type_id]);

  const loadPlantTypes = async () => {
    try {
      setLoading(true);
      const types = await base44.entities.PlantType.list('common_name');
      setPlantTypes(types);
    } catch (error) {
      console.error('Error loading plant types:', error);
      toast.error('Failed to load plant types');
    } finally {
      setLoading(false);
    }
  };

  const loadVarieties = async (typeId) => {
    try {
      const vars = await base44.entities.Variety.filter({ 
        plant_type_id: typeId,
        status: 'active'
      }, 'variety_name');
      setVarieties(vars);
    } catch (error) {
      console.error('Error loading varieties:', error);
    }
  };

  const handleSave = async () => {
    if (!formData.variety_id) {
      toast.error('Please select a variety');
      return;
    }

    setSaving(true);
    try {
      const variety = varieties.find(v => v.id === formData.variety_id);
      const plantType = plantTypes.find(t => t.id === formData.plant_type_id);

      const plantData = {
        garden_id: space.garden_id,
        space_id: space.id,
        plant_type_id: formData.plant_type_id,
        plant_type_name: plantType?.common_name,
        variety_id: formData.variety_id,
        variety_name: variety?.variety_name,
        plant_display_name: `${plantType?.common_name} - ${variety?.variety_name}`,
        quantity: parseInt(formData.quantity),
        planted_date: formData.planted_date,
        notes: formData.notes,
        status: 'planted'
      };

      // Add cell coordinates if grid space
      if (cellCoords && space.layout_schema?.type === 'grid') {
        plantData.cell_x = cellCoords.x;
        plantData.cell_y = cellCoords.y;
      }

      await base44.entities.PlantInstance.create(plantData);
      
      toast.success('Plant added!');
      onPlantAdded?.();
      handleClose();
    } catch (error) {
      console.error('Error adding plant:', error);
      toast.error('Failed to add plant');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFormData({
      plant_type_id: '',
      variety_id: '',
      quantity: 1,
      planted_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setVarieties([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Add Plant {cellCoords ? `(Cell ${cellCoords.x}, ${cellCoords.y})` : ''}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Plant Type *</Label>
            <Select 
              value={formData.plant_type_id} 
              onValueChange={(v) => setFormData({ ...formData, plant_type_id: v, variety_id: '' })}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select plant type" />
              </SelectTrigger>
              <SelectContent>
                {plantTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.common_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.plant_type_id && (
            <div>
              <Label>Variety *</Label>
              <Select 
                value={formData.variety_id} 
                onValueChange={(v) => setFormData({ ...formData, variety_id: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select variety" />
                </SelectTrigger>
                <SelectContent>
                  {varieties.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">No varieties available</div>
                  ) : (
                    varieties.map((variety) => (
                      <SelectItem key={variety.id} value={variety.id}>
                        {variety.variety_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="planted_date">Planted Date</Label>
              <Input
                id="planted_date"
                type="date"
                value={formData.planted_date}
                onChange={(e) => setFormData({ ...formData, planted_date: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add notes about this planting..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="mt-2"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={!formData.variety_id || saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Add Plant'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}