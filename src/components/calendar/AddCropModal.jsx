import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { addDays, addWeeks } from 'date-fns';

export default function AddCropModal({ open, onOpenChange, seasonId, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [plantTypes, setPlantTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [stashSeeds, setStashSeeds] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [season, setSeason] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [formData, setFormData] = useState({
    source: 'stash', // 'stash' or 'catalog'
    plant_type_id: '',
    variety_id: '',
    seed_lot_id: '',
    label: '',
    color_hex: '#10b981',
    planting_method: 'transplant',
    date_mode: 'relative_to_frost',
    seed_offset_days: -42,
    transplant_offset_days: 0,
    direct_seed_offset_days: 0,
    dtm_days: 75,
    harvest_window_days: 14,
    succession_count: 0,
    succession_interval_days: 14
  });
  
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, seasonId]);
  
  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const [typesData, stashData, profilesData, seasonData] = await Promise.all([
        base44.entities.PlantType.list('common_name'),
        base44.entities.SeedLot.filter({ is_wishlist: false, created_by: user.email }),
        base44.entities.PlantProfile.list('variety_name', 500),
        base44.entities.GardenSeason.filter({ id: seasonId })
      ]);
      
      setPlantTypes(typesData);
      setStashSeeds(stashData);
      
      const profilesMap = {};
      profilesData.forEach(p => {
        profilesMap[p.id] = p;
      });
      setProfiles(profilesMap);
      
      if (seasonData.length > 0) {
        setSeason(seasonData[0]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };
  
  const handlePlantTypeChange = async (typeId) => {
    setFormData({ ...formData, plant_type_id: typeId, variety_id: '' });
    
    if (typeId) {
      try {
        const vars = await base44.entities.Variety.filter({ 
          plant_type_id: typeId 
        }, 'variety_name');
        setVarieties(vars);
      } catch (error) {
        console.error('Error loading varieties:', error);
      }
    }
  };
  
  const handleVarietyChange = async (varietyId) => {
    const variety = varieties.find(v => v.id === varietyId);
    if (!variety) return;
    
    setFormData({ 
      ...formData, 
      variety_id: varietyId,
      dtm_days: variety.days_to_maturity || 75,
      label: variety.variety_name
    });
  };
  
  const handleStashSelect = (lotId) => {
    const lot = stashSeeds.find(s => s.id === lotId);
    if (!lot) return;
    
    const profile = profiles[lot.plant_profile_id];
    if (!profile) return;
    
    setFormData({
      ...formData,
      seed_lot_id: lotId,
      plant_type_id: profile.plant_type_id || '',
      dtm_days: profile.days_to_maturity_seed || 75,
      label: profile.variety_name || 'Crop'
    });
  };
  
  const generateTasks = async (cropPlan) => {
    const tasks = [];
    const anchorDate = season?.last_frost_date ? new Date(season.last_frost_date) : new Date();
    
    const color = cropPlan.color_hex;
    
    if (cropPlan.planting_method === 'transplant') {
      // Bed Prep
      const bedPrepDate = addDays(anchorDate, cropPlan.transplant_offset_days - 7);
      tasks.push({
        garden_season_id: seasonId,
        crop_plan_id: cropPlan.id,
        task_type: 'bed_prep',
        title: `Bed Prep ${cropPlan.label}`,
        start_date: bedPrepDate.toISOString().split('T')[0],
        end_date: addDays(bedPrepDate, 1).toISOString().split('T')[0],
        color_hex: color,
        how_to_content: '# Bed Preparation\n\nPrepare the bed by:\n- Removing weeds\n- Adding compost\n- Loosening soil'
      });
      
      // Seeding (indoors)
      const seedDate = addDays(anchorDate, cropPlan.seed_offset_days);
      tasks.push({
        garden_season_id: seasonId,
        crop_plan_id: cropPlan.id,
        task_type: 'seed',
        title: `Seed ${cropPlan.label} (indoors)`,
        start_date: seedDate.toISOString().split('T')[0],
        end_date: seedDate.toISOString().split('T')[0],
        color_hex: color,
        how_to_content: '# Indoor Seeding\n\nStart seeds indoors:\n- Use seed starting mix\n- Keep warm and moist\n- Provide light once germinated'
      });
      
      // Transplant
      const transplantDate = addDays(anchorDate, cropPlan.transplant_offset_days);
      tasks.push({
        garden_season_id: seasonId,
        crop_plan_id: cropPlan.id,
        task_type: 'transplant',
        title: `Transplant ${cropPlan.label}`,
        start_date: transplantDate.toISOString().split('T')[0],
        end_date: transplantDate.toISOString().split('T')[0],
        color_hex: color,
        how_to_content: '# Transplanting\n\nTransplant seedlings:\n- Harden off for 7-10 days\n- Plant on overcast day\n- Water well after planting'
      });
      
      // Harvest
      const harvestStart = addDays(transplantDate, cropPlan.dtm_days);
      const harvestEnd = addDays(harvestStart, cropPlan.harvest_window_days);
      tasks.push({
        garden_season_id: seasonId,
        crop_plan_id: cropPlan.id,
        task_type: 'harvest',
        title: `Harvest ${cropPlan.label}`,
        start_date: harvestStart.toISOString().split('T')[0],
        end_date: harvestEnd.toISOString().split('T')[0],
        color_hex: color,
        how_to_content: '# Harvesting\n\nHarvest when ready:\n- Check maturity indicators\n- Harvest in morning\n- Handle gently'
      });
    } else {
      // Direct Seed
      const directSeedDate = addDays(anchorDate, cropPlan.direct_seed_offset_days);
      
      // Bed Prep
      const bedPrepDate = addDays(directSeedDate, -7);
      tasks.push({
        garden_season_id: seasonId,
        crop_plan_id: cropPlan.id,
        task_type: 'bed_prep',
        title: `Bed Prep ${cropPlan.label}`,
        start_date: bedPrepDate.toISOString().split('T')[0],
        end_date: addDays(bedPrepDate, 1).toISOString().split('T')[0],
        color_hex: color,
        how_to_content: '# Bed Preparation\n\nPrepare the bed'
      });
      
      tasks.push({
        garden_season_id: seasonId,
        crop_plan_id: cropPlan.id,
        task_type: 'direct_seed',
        title: `Direct Seed ${cropPlan.label}`,
        start_date: directSeedDate.toISOString().split('T')[0],
        end_date: directSeedDate.toISOString().split('T')[0],
        color_hex: color,
        how_to_content: '# Direct Seeding\n\nSow seeds directly:\n- Check soil temperature\n- Follow spacing guidelines\n- Water gently'
      });
      
      // Harvest
      const harvestStart = addDays(directSeedDate, cropPlan.dtm_days);
      const harvestEnd = addDays(harvestStart, cropPlan.harvest_window_days);
      tasks.push({
        garden_season_id: seasonId,
        crop_plan_id: cropPlan.id,
        task_type: 'harvest',
        title: `Harvest ${cropPlan.label}`,
        start_date: harvestStart.toISOString().split('T')[0],
        end_date: harvestEnd.toISOString().split('T')[0],
        color_hex: color,
        how_to_content: '# Harvesting\n\nHarvest when ready'
      });
    }
    
    for (const task of tasks) {
      await base44.entities.CropTask.create(task);
    }
  };
  
  const handleSubmit = async () => {
    if (!formData.label) {
      toast.error('Please enter a crop label');
      return;
    }
    
    setLoading(true);
    try {
      // Create CropPlan
      const cropPlan = await base44.entities.CropPlan.create({
        garden_season_id: seasonId,
        plant_type_id: formData.plant_type_id || null,
        variety_id: formData.variety_id || null,
        label: formData.label,
        color_hex: formData.color_hex,
        planting_method: formData.planting_method,
        date_mode: formData.date_mode,
        relative_anchor: 'last_frost',
        seed_offset_days: formData.seed_offset_days,
        transplant_offset_days: formData.transplant_offset_days,
        direct_seed_offset_days: formData.direct_seed_offset_days,
        dtm_days: formData.dtm_days,
        harvest_window_days: formData.harvest_window_days,
        succession_interval_days: formData.succession_interval_days,
        succession_count: formData.succession_count
      });
      
      // Generate tasks
      await generateTasks(cropPlan);
      
      // Create succession plantings if requested
      if (formData.succession_count > 0) {
        for (let i = 1; i <= formData.succession_count; i++) {
          const successionPlan = await base44.entities.CropPlan.create({
            garden_season_id: seasonId,
            plant_type_id: formData.plant_type_id || null,
            variety_id: formData.variety_id || null,
            label: `${formData.label} (S${i})`,
            color_hex: formData.color_hex,
            planting_method: formData.planting_method,
            date_mode: formData.date_mode,
            relative_anchor: 'last_frost',
            seed_offset_days: formData.seed_offset_days + (i * formData.succession_interval_days),
            transplant_offset_days: formData.transplant_offset_days + (i * formData.succession_interval_days),
            direct_seed_offset_days: formData.direct_seed_offset_days + (i * formData.succession_interval_days),
            dtm_days: formData.dtm_days,
            harvest_window_days: formData.harvest_window_days,
            succession_parent_id: cropPlan.id
          });
          
          await generateTasks(successionPlan);
        }
      }
      
      toast.success('Crop scheduled!');
      onOpenChange(false);
      if (onSuccess) onSuccess();
      
      // Reset form
      setFormData({
        source: 'stash',
        plant_type_id: '',
        variety_id: '',
        seed_lot_id: '',
        label: '',
        color_hex: '#10b981',
        planting_method: 'transplant',
        date_mode: 'relative_to_frost',
        seed_offset_days: -42,
        transplant_offset_days: 0,
        direct_seed_offset_days: 0,
        dtm_days: 75,
        harvest_window_days: 14,
        succession_count: 0,
        succession_interval_days: 14
      });
    } catch (error) {
      console.error('Error creating crop:', error);
      toast.error('Failed to schedule crop');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Crop to Calendar</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Tabs value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
            <TabsList className="w-full">
              <TabsTrigger value="stash" className="flex-1">From Seed Stash</TabsTrigger>
              <TabsTrigger value="catalog" className="flex-1">From Plant Catalog</TabsTrigger>
            </TabsList>
            
            <TabsContent value="stash" className="space-y-4 mt-4">
              <div>
                <Label>Select from Stash</Label>
                <Select value={formData.seed_lot_id} onValueChange={handleStashSelect}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Choose a seed" />
                  </SelectTrigger>
                  <SelectContent>
                    {stashSeeds.map(lot => {
                      const profile = profiles[lot.plant_profile_id];
                      return (
                        <SelectItem key={lot.id} value={lot.id}>
                          {profile?.variety_name || 'Unknown'} ({profile?.common_name || 'Unknown'})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            
            <TabsContent value="catalog" className="space-y-4 mt-4">
              <div>
                <Label>Plant Type</Label>
                <Select value={formData.plant_type_id} onValueChange={handlePlantTypeChange}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select plant type" />
                  </SelectTrigger>
                  <SelectContent>
                    {plantTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.common_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {formData.plant_type_id && varieties.length > 0 && (
                <div>
                  <Label>Variety (optional)</Label>
                  <Select value={formData.variety_id} onValueChange={handleVarietyChange}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select variety" />
                    </SelectTrigger>
                    <SelectContent>
                      {varieties.map(variety => (
                        <SelectItem key={variety.id} value={variety.id}>
                          {variety.variety_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <div>
            <Label>Label</Label>
            <Input
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="e.g., BED1, North Row"
              className="mt-2"
            />
          </div>
          
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-2">
              {['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'].map(color => (
                <button
                  key={color}
                  onClick={() => setFormData({ ...formData, color_hex: color })}
                  className={`w-8 h-8 rounded border-2 ${formData.color_hex === color ? 'border-gray-900' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          
          <div>
            <Label>Planting Method</Label>
            <Select value={formData.planting_method} onValueChange={(v) => setFormData({ ...formData, planting_method: v })}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transplant">Transplant (start indoors)</SelectItem>
                <SelectItem value="direct_seed">Direct Seed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Advanced Settings */}
          <div>
            <Button
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full justify-between"
            >
              Advanced Settings
              <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </Button>
            
            {showAdvanced && (
              <div className="mt-4 space-y-4 p-4 border rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Days to Maturity</Label>
                    <Input
                      type="number"
                      value={formData.dtm_days}
                      onChange={(e) => setFormData({ ...formData, dtm_days: parseInt(e.target.value) || 0 })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Harvest Window (days)</Label>
                    <Input
                      type="number"
                      value={formData.harvest_window_days}
                      onChange={(e) => setFormData({ ...formData, harvest_window_days: parseInt(e.target.value) || 0 })}
                      className="mt-2"
                    />
                  </div>
                </div>
                
                {formData.planting_method === 'transplant' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Indoors (days before last frost)</Label>
                      <Input
                        type="number"
                        value={Math.abs(formData.seed_offset_days)}
                        onChange={(e) => setFormData({ ...formData, seed_offset_days: -Math.abs(parseInt(e.target.value) || 0) })}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Transplant (days after last frost)</Label>
                      <Input
                        type="number"
                        value={formData.transplant_offset_days}
                        onChange={(e) => setFormData({ ...formData, transplant_offset_days: parseInt(e.target.value) || 0 })}
                        className="mt-2"
                      />
                    </div>
                  </div>
                )}
                
                {formData.planting_method === 'direct_seed' && (
                  <div>
                    <Label>Direct Seed (days after last frost)</Label>
                    <Input
                      type="number"
                      value={formData.direct_seed_offset_days}
                      onChange={(e) => setFormData({ ...formData, direct_seed_offset_days: parseInt(e.target.value) || 0 })}
                      className="mt-2"
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Succession Plantings</Label>
                    <Input
                      type="number"
                      value={formData.succession_count}
                      onChange={(e) => setFormData({ ...formData, succession_count: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Interval (days)</Label>
                    <Input
                      type="number"
                      value={formData.succession_interval_days}
                      onChange={(e) => setFormData({ ...formData, succession_interval_days: parseInt(e.target.value) || 0 })}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading || !formData.label}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Schedule Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}