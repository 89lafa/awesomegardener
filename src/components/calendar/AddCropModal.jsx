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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const COLOR_OPTIONS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
];

export default function AddCropModal({ open, onOpenChange, activeSeason, activeGarden, onSuccess }) {
  const [plantTypes, setPlantTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [stashPlants, setStashPlants] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [formData, setFormData] = useState({
    source: 'stash',
    plant_type_id: '',
    plant_profile_id: '',
    variety_id: '',
    label: '',
    color_hex: COLOR_OPTIONS[0],
    planting_method: 'transplant',
    date_mode: 'relative_to_frost',
    relative_anchor: 'last_frost',
    seed_offset_days: -42,
    transplant_offset_days: 0,
    direct_seed_offset_days: 0,
    dtm_days: 60,
    harvest_window_days: 14,
    succession_interval_days: 14,
    succession_count: 0
  });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const [types, stash, profs] = await Promise.all([
        base44.entities.PlantType.list('common_name', 200),
        base44.entities.SeedLot.filter({ created_by: user.email, is_wishlist: false }),
        base44.entities.PlantProfile.list('variety_name', 500)
      ]);

      setPlantTypes(types.filter(t => t.common_name));
      setStashPlants(stash);

      const profsMap = {};
      profs.forEach(p => { profsMap[p.id] = p; });
      setProfiles(profsMap);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handlePlantTypeChange = async (typeId) => {
    setFormData({ ...formData, plant_type_id: typeId, variety_id: '', plant_profile_id: '' });

    if (formData.source === 'catalog') {
      try {
        const vars = await base44.entities.Variety.filter({
          plant_type_id: typeId,
          status: 'active'
        }, 'variety_name');
        setVarieties(vars);
      } catch (error) {
        console.error('Error loading varieties:', error);
      }
    }
  };

  const handleVarietySelect = async (varietyId) => {
    const variety = varieties.find(v => v.id === varietyId);
    if (!variety) return;

    // Find or create PlantProfile
    const existingProfiles = await base44.entities.PlantProfile.filter({
      variety_name: variety.variety_name,
      plant_type_id: variety.plant_type_id
    });

    let profileId;
    if (existingProfiles.length > 0) {
      profileId = existingProfiles[0].id;
    } else {
      const plantType = plantTypes.find(t => t.id === variety.plant_type_id);
      const newProfile = await base44.entities.PlantProfile.create({
        plant_type_id: variety.plant_type_id,
        common_name: plantType?.common_name,
        variety_name: variety.variety_name,
        days_to_maturity_seed: variety.days_to_maturity,
        spacing_in_min: variety.spacing_recommended,
        spacing_in_max: variety.spacing_recommended,
        source_type: 'user_private'
      });
      profileId = newProfile.id;
      profiles[profileId] = newProfile;
    }

    // Create SeedLot if adding from catalog
    const user = await base44.auth.me();
    const existingLots = await base44.entities.SeedLot.filter({
      plant_profile_id: profileId,
      created_by: user.email,
      is_wishlist: false
    });

    if (existingLots.length === 0) {
      await base44.entities.SeedLot.create({
        plant_profile_id: profileId,
        is_wishlist: false
      });
    }

    setFormData({
      ...formData,
      variety_id: varietyId,
      plant_profile_id: profileId,
      dtm_days: variety.days_to_maturity || 60
    });
  };

  const handleSubmit = async () => {
    if (!formData.plant_profile_id) {
      toast.error('Please select a crop variety');
      return;
    }

    setLoading(true);
    try {
      const profile = profiles[formData.plant_profile_id];

      // Create CropPlan
      const cropPlan = await base44.entities.CropPlan.create({
        garden_season_id: activeSeason.id,
        plant_type_id: formData.plant_type_id,
        plant_profile_id: formData.plant_profile_id,
        variety_id: formData.variety_id || null,
        label: formData.label,
        color_hex: formData.color_hex,
        planting_method: formData.planting_method,
        date_mode: formData.date_mode,
        relative_anchor: formData.relative_anchor,
        seed_offset_days: formData.seed_offset_days,
        transplant_offset_days: formData.transplant_offset_days,
        direct_seed_offset_days: formData.direct_seed_offset_days,
        dtm_days: formData.dtm_days,
        harvest_window_days: formData.harvest_window_days,
        succession_interval_days: formData.succession_interval_days,
        succession_count: formData.succession_count
      });

      // Generate tasks
      await generateTasks(cropPlan, profile);

      toast.success('Crop scheduled!');
      onOpenChange(false);
      onSuccess();
      resetForm();
    } catch (error) {
      console.error('Error creating crop plan:', error);
      toast.error('Failed to schedule crop');
    } finally {
      setLoading(false);
    }
  };

  const generateTasks = async (cropPlan, profile) => {
    const anchorDate = activeSeason.last_frost_date
      ? new Date(activeSeason.last_frost_date)
      : new Date(activeSeason.year, 4, 15); // Default May 15

    const tasks = [];

    if (cropPlan.planting_method === 'transplant') {
      // Seed indoors
      const seedDate = new Date(anchorDate);
      seedDate.setDate(seedDate.getDate() + cropPlan.seed_offset_days);

      tasks.push({
        garden_season_id: activeSeason.id,
        crop_plan_id: cropPlan.id,
        task_type: 'seed',
        title: `Seed ${profile.variety_name}`,
        start_date: seedDate.toISOString().split('T')[0],
        color_hex: cropPlan.color_hex
      });

      // Bed prep (7 days before transplant)
      const transplantDate = new Date(anchorDate);
      transplantDate.setDate(transplantDate.getDate() + cropPlan.transplant_offset_days);

      const bedPrepDate = new Date(transplantDate);
      bedPrepDate.setDate(bedPrepDate.getDate() - 7);

      tasks.push({
        garden_season_id: activeSeason.id,
        crop_plan_id: cropPlan.id,
        task_type: 'bed_prep',
        title: `Bed Prep for ${profile.variety_name}`,
        start_date: bedPrepDate.toISOString().split('T')[0],
        end_date: transplantDate.toISOString().split('T')[0],
        color_hex: cropPlan.color_hex
      });

      // Transplant
      tasks.push({
        garden_season_id: activeSeason.id,
        crop_plan_id: cropPlan.id,
        task_type: 'transplant',
        title: `Transplant ${profile.variety_name}`,
        start_date: transplantDate.toISOString().split('T')[0],
        color_hex: cropPlan.color_hex
      });

      // Harvest
      const harvestStart = new Date(transplantDate);
      harvestStart.setDate(harvestStart.getDate() + cropPlan.dtm_days);

      const harvestEnd = new Date(harvestStart);
      harvestEnd.setDate(harvestEnd.getDate() + cropPlan.harvest_window_days);

      tasks.push({
        garden_season_id: activeSeason.id,
        crop_plan_id: cropPlan.id,
        task_type: 'harvest',
        title: `Harvest ${profile.variety_name}`,
        start_date: harvestStart.toISOString().split('T')[0],
        end_date: harvestEnd.toISOString().split('T')[0],
        color_hex: cropPlan.color_hex
      });
    } else {
      // Direct seed
      const directSeedDate = new Date(anchorDate);
      directSeedDate.setDate(directSeedDate.getDate() + cropPlan.direct_seed_offset_days);

      // Bed prep
      const bedPrepDate = new Date(directSeedDate);
      bedPrepDate.setDate(bedPrepDate.getDate() - 7);

      tasks.push({
        garden_season_id: activeSeason.id,
        crop_plan_id: cropPlan.id,
        task_type: 'bed_prep',
        title: `Bed Prep for ${profile.variety_name}`,
        start_date: bedPrepDate.toISOString().split('T')[0],
        end_date: directSeedDate.toISOString().split('T')[0],
        color_hex: cropPlan.color_hex
      });

      // Direct seed
      tasks.push({
        garden_season_id: activeSeason.id,
        crop_plan_id: cropPlan.id,
        task_type: 'direct_seed',
        title: `Direct Seed ${profile.variety_name}`,
        start_date: directSeedDate.toISOString().split('T')[0],
        color_hex: cropPlan.color_hex
      });

      // Harvest
      const harvestStart = new Date(directSeedDate);
      harvestStart.setDate(harvestStart.getDate() + cropPlan.dtm_days);

      const harvestEnd = new Date(harvestStart);
      harvestEnd.setDate(harvestEnd.getDate() + cropPlan.harvest_window_days);

      tasks.push({
        garden_season_id: activeSeason.id,
        crop_plan_id: cropPlan.id,
        task_type: 'harvest',
        title: `Harvest ${profile.variety_name}`,
        start_date: harvestStart.toISOString().split('T')[0],
        end_date: harvestEnd.toISOString().split('T')[0],
        color_hex: cropPlan.color_hex
      });
    }

    for (const task of tasks) {
      await base44.entities.CropTask.create(task);
    }
  };

  const resetForm = () => {
    setFormData({
      source: 'stash',
      plant_type_id: '',
      plant_profile_id: '',
      variety_id: '',
      label: '',
      color_hex: COLOR_OPTIONS[0],
      planting_method: 'transplant',
      date_mode: 'relative_to_frost',
      relative_anchor: 'last_frost',
      seed_offset_days: -42,
      transplant_offset_days: 0,
      direct_seed_offset_days: 0,
      dtm_days: 60,
      harvest_window_days: 14,
      succession_interval_days: 14,
      succession_count: 0
    });
    setShowAdvanced(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Crop</DialogTitle>
        </DialogHeader>

        <Tabs value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
          <TabsList className="w-full">
            <TabsTrigger value="stash" className="flex-1">From Seed Stash</TabsTrigger>
            <TabsTrigger value="catalog" className="flex-1">From Plant Catalog</TabsTrigger>
          </TabsList>

          <TabsContent value="stash" className="space-y-4">
            <div>
              <Label>Select from your stash</Label>
              <Select
                value={formData.plant_profile_id}
                onValueChange={(id) => {
                  const profile = profiles[id];
                  setFormData({
                    ...formData,
                    plant_profile_id: id,
                    plant_type_id: profile?.plant_type_id || '',
                    dtm_days: profile?.days_to_maturity_seed || 60
                  });
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose variety" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Map(stashPlants.map(p => [p.plant_profile_id, p])).values()).map(plant => {
                    const profile = profiles[plant.plant_profile_id];
                    return profile ? (
                      <SelectItem key={plant.id} value={plant.plant_profile_id}>
                        {profile.variety_name} ({profile.common_name})
                      </SelectItem>
                    ) : null;
                  })}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="catalog" className="space-y-4">
            <div>
              <Label>Plant Type</Label>
              <Select value={formData.plant_type_id} onValueChange={handlePlantTypeChange}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {plantTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.common_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.plant_type_id && (
              <div>
                <Label>Variety</Label>
                <Select value={formData.variety_id} onValueChange={handleVarietySelect}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select variety" />
                  </SelectTrigger>
                  <SelectContent>
                    {varieties.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.variety_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Label (optional)</Label>
            <Input
              placeholder="e.g., BED1, North Row"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="mt-2"
            />
          </div>

          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-2">
              {COLOR_OPTIONS.map(color => (
                <button
                  key={color}
                  className="w-8 h-8 rounded border-2 transition-all"
                  style={{
                    backgroundColor: color,
                    borderColor: formData.color_hex === color ? '#000' : 'transparent'
                  }}
                  onClick={() => setFormData({ ...formData, color_hex: color })}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <Label>Planting Method</Label>
          <Select
            value={formData.planting_method}
            onValueChange={(v) => setFormData({ ...formData, planting_method: v })}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="transplant">Transplant (start indoors)</SelectItem>
              <SelectItem value="direct_seed">Direct Seed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Advanced Settings
        </button>

        {showAdvanced && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Days to Maturity</Label>
                <Input
                  type="number"
                  value={formData.dtm_days}
                  onChange={(e) => setFormData({ ...formData, dtm_days: parseInt(e.target.value) })}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Harvest Window (days)</Label>
                <Input
                  type="number"
                  value={formData.harvest_window_days}
                  onChange={(e) => setFormData({ ...formData, harvest_window_days: parseInt(e.target.value) })}
                  className="mt-2"
                />
              </div>
            </div>

            {formData.planting_method === 'transplant' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Indoors (days before frost)</Label>
                  <Input
                    type="number"
                    value={Math.abs(formData.seed_offset_days)}
                    onChange={(e) => setFormData({ ...formData, seed_offset_days: -Math.abs(parseInt(e.target.value)) })}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Transplant (days after frost)</Label>
                  <Input
                    type="number"
                    value={formData.transplant_offset_days}
                    onChange={(e) => setFormData({ ...formData, transplant_offset_days: parseInt(e.target.value) })}
                    className="mt-2"
                  />
                </div>
              </div>
            )}

            {formData.planting_method === 'direct_seed' && (
              <div>
                <Label>Direct Seed (days after frost)</Label>
                <Input
                  type="number"
                  value={formData.direct_seed_offset_days}
                  onChange={(e) => setFormData({ ...formData, direct_seed_offset_days: parseInt(e.target.value) })}
                  className="mt-2"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Succession Interval (days)</Label>
                <Input
                  type="number"
                  value={formData.succession_interval_days}
                  onChange={(e) => setFormData({ ...formData, succession_interval_days: parseInt(e.target.value) })}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Number of Successions</Label>
                <Input
                  type="number"
                  value={formData.succession_count}
                  onChange={(e) => setFormData({ ...formData, succession_count: parseInt(e.target.value) })}
                  className="mt-2"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.plant_profile_id}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}