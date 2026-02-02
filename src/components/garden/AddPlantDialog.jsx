import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Loader2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Combobox } from '@/components/ui/combobox';

export default function AddPlantDialog({ 
  open, 
  onOpenChange, 
  space, 
  cellCoords, 
  onPlantAdded,
  seasonId
}) {
  const [plantTypes, setPlantTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [cropPlans, setCropPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    source: 'catalog', // 'catalog' or 'crop_plan'
    plant_type_id: '',
    variety_id: '',
    crop_plan_id: '',
    quantity: 1,
    planted_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (open) {
      loadPlantTypes();
      if (seasonId) {
        loadCropPlans();
      }
    }
  }, [open, seasonId]);

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

  const loadCropPlans = async () => {
    try {
      const plans = await base44.entities.CropPlan.filter({ 
        garden_season_id: seasonId 
      });
      setCropPlans(plans.filter(p => (p.quantity_planted || 0) < (p.quantity_planned || 0)));
    } catch (error) {
      console.error('Error loading crop plans:', error);
    }
  };

  const handleSave = async () => {
    if (formData.source === 'crop_plan' && !formData.crop_plan_id) {
      toast.error('Please select a crop from your calendar');
      return;
    }
    if (formData.source === 'catalog' && !formData.variety_id) {
      toast.error('Please select a variety');
      return;
    }

    setSaving(true);
    try {
      let plantTypeId, varietyId, plantTypeName, varietyName, cropPlanId;

      if (formData.source === 'crop_plan') {
        const cropPlan = cropPlans.find(c => c.id === formData.crop_plan_id);
        plantTypeId = cropPlan.plant_type_id;
        varietyId = cropPlan.variety_id;
        cropPlanId = cropPlan.id;
        
        // Load plant type and variety for names
        const [type, variety] = await Promise.all([
          plantTypeId ? base44.entities.PlantType.filter({ id: plantTypeId }) : Promise.resolve([]),
          varietyId ? base44.entities.Variety.filter({ id: varietyId }) : Promise.resolve([])
        ]);
        plantTypeName = type[0]?.common_name || cropPlan.label;
        varietyName = variety[0]?.variety_name || '';
      } else {
        const variety = varieties.find(v => v.id === formData.variety_id);
        const plantType = plantTypes.find(t => t.id === formData.plant_type_id);
        plantTypeId = formData.plant_type_id;
        varietyId = formData.variety_id;
        plantTypeName = plantType?.common_name;
        varietyName = variety?.variety_name;
      }

      const plantingData = {
        garden_id: space.garden_id,
        garden_season_id: seasonId || null,
        plot_item_id: space.id,
        crop_plan_id: cropPlanId || null,
        space_type: space.type,
        name: space.name,
        plant_type_id: plantTypeId,
        variety_id: varietyId,
        plant_display_name: varietyName ? `${plantTypeName} - ${varietyName}` : plantTypeName,
        quantity: parseInt(formData.quantity) || 1,
        planted_date: formData.planted_date,
        notes: formData.notes,
        status: 'planted'
      };

      // Add cell coordinates if grid space
      if (cellCoords && space.layout_schema?.type === 'grid') {
        plantingData.cell_x = cellCoords.x;
        plantingData.cell_y = cellCoords.y;
      }

      await base44.entities.PlantingSpace.create(plantingData);

      // If from crop plan, update quantities
      if (cropPlanId) {
        await base44.functions.invoke('updatePlantingQuantities', { crop_plan_id: cropPlanId });
      }
      
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
      source: 'catalog',
      plant_type_id: '',
      variety_id: '',
      crop_plan_id: '',
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
          {seasonId && cropPlans.length > 0 ? (
            <Tabs value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
              <TabsList className="w-full">
                <TabsTrigger value="crop_plan" className="flex-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  From Calendar
                </TabsTrigger>
                <TabsTrigger value="catalog" className="flex-1">From Catalog</TabsTrigger>
              </TabsList>

              <TabsContent value="crop_plan" className="space-y-4 mt-4">
                <div>
                  <Label>Select Crop from Calendar</Label>
                  <Select 
                    value={formData.crop_plan_id} 
                    onValueChange={(v) => {
                      const plan = cropPlans.find(p => p.id === v);
                      setFormData({ 
                        ...formData, 
                        crop_plan_id: v,
                        plant_type_id: plan?.plant_type_id || '',
                        variety_id: plan?.variety_id || '',
                        quantity: Math.min(1, (plan?.quantity_planned || 1) - (plan?.quantity_planted || 0))
                      });
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose a crop" />
                    </SelectTrigger>
                    <SelectContent>
                      {cropPlans.map(plan => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.label} ({(plan.quantity_planted || 0)}/{plan.quantity_planned || 1} planted)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="catalog" className="space-y-4 mt-4">
                <div>
                  <Label>Plant Type *</Label>
                  <Combobox
                    options={plantTypes.map(type => ({
                      value: type.id,
                      label: `${type.icon || '🌱'} ${type.common_name}`,
                      searchValue: type.common_name.toLowerCase()
                    }))}
                    value={formData.plant_type_id}
                    onChange={(v) => setFormData({ ...formData, plant_type_id: v, variety_id: '' })}
                    placeholder="Select plant type"
                    searchPlaceholder="Type to search..."
                    className="mt-2"
                  />
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
              </TabsContent>
            </Tabs>
          ) : (
            <>
              <div>
                <Label>Plant Type *</Label>
                <Combobox
                  options={plantTypes.map(type => ({
                    value: type.id,
                    label: `${type.icon || '🌱'} ${type.common_name}`,
                    searchValue: type.common_name.toLowerCase()
                  }))}
                  value={formData.plant_type_id}
                  onChange={(v) => setFormData({ ...formData, plant_type_id: v, variety_id: '' })}
                  placeholder="Select plant type"
                  searchPlaceholder="Type to search..."
                  className="mt-2"
                />
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
            </>
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
            disabled={(formData.source === 'catalog' && !formData.variety_id) || (formData.source === 'crop_plan' && !formData.crop_plan_id) || saving}
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