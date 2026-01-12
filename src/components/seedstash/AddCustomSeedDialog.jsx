import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AddCustomSeedDialog({ open, onOpenChange, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [plantTypes, setPlantTypes] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [formData, setFormData] = useState({
    // Plant Type Selection
    plant_type_id: '',
    variety_name: '',
    
    // Variety Profile Attributes
    days_to_maturity_seed: '',
    days_to_maturity_transplant: '',
    spacing_min: '',
    spacing_max: '',
    height_min: '',
    height_max: '',
    sun_requirement: '',
    water_requirement: '',
    growth_habit: '',
    transplant_timing: '',
    flavor_profile: '',
    fruit_color: '',
    fruit_shape: '',
    container_friendly: false,
    trellis_required: false,
    is_perennial: false,
    scoville_min: '',
    scoville_max: '',
    growing_notes: '',
    description: '',
    
    // Stash Info (Personal)
    quantity: '',
    unit: 'seeds',
    year_acquired: new Date().getFullYear(),
    packed_for_year: '',
    source_vendor_name: '',
    source_vendor_url: '',
    storage_location: '',
    lot_notes: '',
    lot_images: []
  });

  useEffect(() => {
    if (open) {
      loadPlantTypes();
    }
  }, [open]);

  const loadPlantTypes = async () => {
    try {
      const types = await base44.entities.PlantType.list('common_name');
      setPlantTypes(types.filter(t => t.common_name));
    } catch (error) {
      console.error('Error loading plant types:', error);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ 
        ...formData, 
        lot_images: [...(formData.lot_images || []), file_url] 
      });
      toast.success('Photo added');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.plant_type_id || !formData.variety_name.trim()) {
      toast.error('Plant type and variety name are required');
      return;
    }

    setLoading(true);
    try {
      const plantType = plantTypes.find(t => t.id === formData.plant_type_id);
      
      // Create PlantProfile
      const profile = await base44.entities.PlantProfile.create({
        plant_type_id: formData.plant_type_id,
        common_name: plantType.common_name,
        variety_name: formData.variety_name,
        days_to_maturity_seed: formData.days_to_maturity_seed ? parseInt(formData.days_to_maturity_seed) : null,
        days_to_maturity_transplant: formData.days_to_maturity_transplant ? parseInt(formData.days_to_maturity_transplant) : null,
        spacing_in_min: formData.spacing_min ? parseFloat(formData.spacing_min) : null,
        spacing_in_max: formData.spacing_max ? parseFloat(formData.spacing_max) : null,
        height_in_min: formData.height_min ? parseFloat(formData.height_min) : null,
        height_in_max: formData.height_max ? parseFloat(formData.height_max) : null,
        sun_requirement: formData.sun_requirement || null,
        water_requirement: formData.water_requirement || null,
        growth_habit: formData.growth_habit || null,
        transplant_timing: formData.transplant_timing || null,
        flavor_profile: formData.flavor_profile || null,
        fruit_color: formData.fruit_color || null,
        fruit_shape: formData.fruit_shape || null,
        container_friendly: formData.container_friendly,
        trellis_required: formData.trellis_required,
        is_perennial: formData.is_perennial,
        scoville_min: formData.scoville_min ? parseFloat(formData.scoville_min) : null,
        scoville_max: formData.scoville_max ? parseFloat(formData.scoville_max) : null,
        notes_private: formData.growing_notes || null,
        description: formData.description || null,
        source_type: 'user_private'
      });

      // Create SeedLot
      await base44.entities.SeedLot.create({
        plant_profile_id: profile.id,
        quantity: formData.quantity ? parseFloat(formData.quantity) : null,
        unit: formData.unit,
        year_acquired: formData.year_acquired,
        packed_for_year: formData.packed_for_year || null,
        source_vendor_name: formData.source_vendor_name || null,
        source_url: formData.source_vendor_url || null,
        source_vendor_url: formData.source_vendor_url || null,
        storage_location: formData.storage_location || null,
        lot_notes: formData.lot_notes || null,
        lot_images: formData.lot_images || [],
        is_wishlist: false,
        from_catalog: false
      });

      toast.success('Custom seed added to your stash!');
      onSuccess?.();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error adding custom seed:', error);
      toast.error('Failed to add seed');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestToCatalog = async () => {
    if (!formData.plant_type_id || !formData.variety_name.trim()) {
      toast.error('Plant type and variety name are required to suggest');
      return;
    }

    try {
      await base44.entities.VarietySuggestion.create({
        plant_type_id: formData.plant_type_id,
        plant_type_name: plantTypes.find(t => t.id === formData.plant_type_id)?.common_name,
        variety_name: formData.variety_name,
        description: formData.description || null,
        days_to_maturity: formData.days_to_maturity_seed ? parseInt(formData.days_to_maturity_seed) : null,
        spacing_recommended: formData.spacing_min ? parseFloat(formData.spacing_min) : null,
        plant_height_typical: formData.height_min && formData.height_max ? `${formData.height_min}-${formData.height_max}"` : null,
        sun_requirement: formData.sun_requirement || null,
        water_requirement: formData.water_requirement || null,
        growth_habit: formData.growth_habit || null,
        trellis_required: formData.trellis_required,
        container_friendly: formData.container_friendly,
        grower_notes: formData.growing_notes || null,
        status: 'pending',
        submitted_by: (await base44.auth.me()).email
      });

      toast.success('Variety suggested to catalog for review!');
    } catch (error) {
      console.error('Error suggesting variety:', error);
      toast.error('Failed to submit suggestion');
    }
  };

  const resetForm = () => {
    setFormData({
      plant_type_id: '',
      variety_name: '',
      days_to_maturity_seed: '',
      days_to_maturity_transplant: '',
      spacing_min: '',
      spacing_max: '',
      height_min: '',
      height_max: '',
      sun_requirement: '',
      water_requirement: '',
      growth_habit: '',
      transplant_timing: '',
      flavor_profile: '',
      fruit_color: '',
      fruit_shape: '',
      container_friendly: false,
      trellis_required: false,
      is_perennial: false,
      scoville_min: '',
      scoville_max: '',
      growing_notes: '',
      description: '',
      quantity: '',
      unit: 'seeds',
      year_acquired: new Date().getFullYear(),
      packed_for_year: '',
      source_vendor_name: '',
      source_vendor_url: '',
      storage_location: '',
      lot_notes: '',
      lot_images: []
    });
  };

  const selectedPlantType = plantTypes.find(t => t.id === formData.plant_type_id);
  const isPepper = selectedPlantType?.common_name?.toLowerCase().includes('pepper');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add My Own Seeds</DialogTitle>
          <DialogDescription>
            Add a custom variety to your seed stash (may or may not be in the catalog)
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="variety" className="flex-1">
          <TabsList className="w-full">
            <TabsTrigger value="variety" className="flex-1">Variety Info</TabsTrigger>
            <TabsTrigger value="stash" className="flex-1">My Stash Info</TabsTrigger>
          </TabsList>

          <TabsContent value="variety" className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* Plant Type */}
            <div>
              <Label>Plant Type <span className="text-red-500">*</span></Label>
              <Select 
                value={formData.plant_type_id} 
                onValueChange={(id) => setFormData({ ...formData, plant_type_id: id })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select plant type..." />
                </SelectTrigger>
                <SelectContent>
                  {plantTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.icon} {type.common_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Variety Name */}
            <div>
              <Label>Variety Name <span className="text-red-500">*</span></Label>
              <Input
                value={formData.variety_name}
                onChange={(e) => setFormData({ ...formData, variety_name: e.target.value })}
                placeholder="e.g., Cherokee Purple"
                className="mt-1"
              />
            </div>

            {/* Days to Maturity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Days to Maturity (seed)</Label>
                <Input
                  type="number"
                  value={formData.days_to_maturity_seed}
                  onChange={(e) => setFormData({ ...formData, days_to_maturity_seed: e.target.value })}
                  placeholder="e.g., 70"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Days to Maturity (transplant)</Label>
                <Input
                  type="number"
                  value={formData.days_to_maturity_transplant}
                  onChange={(e) => setFormData({ ...formData, days_to_maturity_transplant: e.target.value })}
                  placeholder="e.g., 55"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Spacing */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Spacing Min (inches)</Label>
                <Input
                  type="number"
                  value={formData.spacing_min}
                  onChange={(e) => setFormData({ ...formData, spacing_min: e.target.value })}
                  placeholder="e.g., 18"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Spacing Max (inches)</Label>
                <Input
                  type="number"
                  value={formData.spacing_max}
                  onChange={(e) => setFormData({ ...formData, spacing_max: e.target.value })}
                  placeholder="e.g., 24"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Height */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Height Min (inches)</Label>
                <Input
                  type="number"
                  value={formData.height_min}
                  onChange={(e) => setFormData({ ...formData, height_min: e.target.value })}
                  placeholder="e.g., 36"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Height Max (inches)</Label>
                <Input
                  type="number"
                  value={formData.height_max}
                  onChange={(e) => setFormData({ ...formData, height_max: e.target.value })}
                  placeholder="e.g., 48"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Sun & Water */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sun Requirement</Label>
                <Select 
                  value={formData.sun_requirement} 
                  onValueChange={(v) => setFormData({ ...formData, sun_requirement: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_sun">Full Sun</SelectItem>
                    <SelectItem value="partial_sun">Partial Sun</SelectItem>
                    <SelectItem value="partial_shade">Partial Shade</SelectItem>
                    <SelectItem value="full_shade">Full Shade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Water Requirement</Label>
                <Select 
                  value={formData.water_requirement} 
                  onValueChange={(v) => setFormData({ ...formData, water_requirement: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Growth Habit & Transplant */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Growth Habit</Label>
                <Input
                  value={formData.growth_habit}
                  onChange={(e) => setFormData({ ...formData, growth_habit: e.target.value })}
                  placeholder="e.g., Vining, Bush, Indeterminate"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Transplant Timing</Label>
                <Input
                  value={formData.transplant_timing}
                  onChange={(e) => setFormData({ ...formData, transplant_timing: e.target.value })}
                  placeholder="e.g., 2 weeks after frost"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Flavor & Fruit Info */}
            <div>
              <Label>Flavor Profile</Label>
              <Input
                value={formData.flavor_profile}
                onChange={(e) => setFormData({ ...formData, flavor_profile: e.target.value })}
                placeholder="e.g., Sweet, acidic, complex"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fruit Color</Label>
                <Input
                  value={formData.fruit_color}
                  onChange={(e) => setFormData({ ...formData, fruit_color: e.target.value })}
                  placeholder="e.g., Red, Yellow"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Fruit Shape</Label>
                <Input
                  value={formData.fruit_shape}
                  onChange={(e) => setFormData({ ...formData, fruit_shape: e.target.value })}
                  placeholder="e.g., Round, Oblong"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="container"
                  checked={formData.container_friendly}
                  onCheckedChange={(checked) => setFormData({ ...formData, container_friendly: checked })}
                />
                <Label htmlFor="container" className="text-sm font-normal">Container Friendly</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="trellis"
                  checked={formData.trellis_required}
                  onCheckedChange={(checked) => setFormData({ ...formData, trellis_required: checked })}
                />
                <Label htmlFor="trellis" className="text-sm font-normal">Trellis Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="perennial"
                  checked={formData.is_perennial}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_perennial: checked })}
                />
                <Label htmlFor="perennial" className="text-sm font-normal">Perennial</Label>
              </div>
            </div>

            {/* Scoville (Peppers only) */}
            {isPepper && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Scoville Min</Label>
                  <Input
                    type="number"
                    value={formData.scoville_min}
                    onChange={(e) => setFormData({ ...formData, scoville_min: e.target.value })}
                    placeholder="e.g., 0"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Scoville Max</Label>
                  <Input
                    type="number"
                    value={formData.scoville_max}
                    onChange={(e) => setFormData({ ...formData, scoville_max: e.target.value })}
                    placeholder="e.g., 5000"
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Growing Notes */}
            <div>
              <Label>Growing Notes</Label>
              <Textarea
                value={formData.growing_notes}
                onChange={(e) => setFormData({ ...formData, growing_notes: e.target.value })}
                placeholder="Tips for growing this variety..."
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Description */}
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="General description of this variety..."
                rows={3}
                className="mt-1"
              />
            </div>
          </TabsContent>

          <TabsContent value="stash" className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="e.g., 20"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select 
                  value={formData.unit} 
                  onValueChange={(v) => setFormData({ ...formData, unit: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seeds">Seeds</SelectItem>
                    <SelectItem value="packets">Packets</SelectItem>
                    <SelectItem value="grams">Grams</SelectItem>
                    <SelectItem value="ounces">Ounces</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Years */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Year Acquired</Label>
                <Input
                  type="number"
                  value={formData.year_acquired}
                  onChange={(e) => setFormData({ ...formData, year_acquired: parseInt(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Packed For Year</Label>
                <Input
                  type="number"
                  value={formData.packed_for_year}
                  onChange={(e) => setFormData({ ...formData, packed_for_year: parseInt(e.target.value) || '' })}
                  placeholder="2025"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Vendor */}
            <div>
              <Label>Vendor/Source</Label>
              <Input
                value={formData.source_vendor_name}
                onChange={(e) => setFormData({ ...formData, source_vendor_name: e.target.value })}
                placeholder="e.g., Baker Creek"
                className="mt-1"
              />
            </div>

            {/* Vendor URL */}
            <div>
              <Label>Vendor URL</Label>
              <Input
                value={formData.source_vendor_url}
                onChange={(e) => setFormData({ ...formData, source_vendor_url: e.target.value })}
                placeholder="e.g., https://www.example.com"
                className="mt-1"
              />
            </div>

            {/* Storage */}
            <div>
              <Label>Storage Location</Label>
              <Input
                value={formData.storage_location}
                onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                placeholder="e.g., Refrigerator, Shelf A"
                className="mt-1"
              />
            </div>

            {/* Notes */}
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.lot_notes}
                onChange={(e) => setFormData({ ...formData, lot_notes: e.target.value })}
                rows={3}
                placeholder="Any notes about these seeds..."
                className="mt-1"
              />
            </div>

            {/* Photos */}
            <div>
              <Label>Photos</Label>
              <div className="mt-2 space-y-2">
                {formData.lot_images?.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {formData.lot_images.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img src={url} alt="Seed" className="w-full h-20 object-cover rounded-lg" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => {
                            const updated = formData.lot_images.filter((_, i) => i !== idx);
                            setFormData({ ...formData, lot_images: updated });
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingPhoto}
                  onClick={() => document.getElementById('custom-seed-photo').click()}
                  className="w-full"
                >
                  {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add Photo
                </Button>
                <input
                  id="custom-seed-photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={handleSuggestToCatalog}
            className="gap-2"
            disabled={!formData.plant_type_id || !formData.variety_name.trim()}
          >
            <Sparkles className="w-4 h-4" />
            Suggest to Plant Catalog
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !formData.plant_type_id || !formData.variety_name.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add to Stash
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}