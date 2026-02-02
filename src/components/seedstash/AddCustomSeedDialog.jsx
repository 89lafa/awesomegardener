import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function AddCustomSeedDialog({ open, onOpenChange, onSuccess, prefilledData }) {
  const [loading, setLoading] = useState(false);
  const [plantTypes, setPlantTypes] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showSuggestButton, setShowSuggestButton] = useState(false);
  
  const [formData, setFormData] = useState({
    plant_type_id: '',
    variety_name: '',
    description: '',
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
      resetForm();
    }
  }, [open]);

  const loadPlantTypes = async () => {
    try {
      const types = await base44.entities.PlantType.list('common_name');
      setPlantTypes(types);
    } catch (error) {
      console.error('Error loading plant types:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      plant_type_id: '',
      variety_name: '',
      description: '',
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
    setShowSuggestButton(false);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ 
        ...formData, 
        lot_images: [...formData.lot_images, file_url] 
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
      toast.error('Please select plant type and enter variety name');
      return;
    }
    
    if (loading) return; // V1B-11: Prevent double-submit
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const plantType = plantTypes.find(t => t.id === formData.plant_type_id);

      // Create custom PlantProfile
      const profile = await base44.entities.PlantProfile.create({
        plant_type_id: formData.plant_type_id,
        plant_family: plantType?.plant_family_id,
        common_name: plantType?.common_name,
        variety_name: formData.variety_name,
        description: formData.description || null,
        days_to_maturity_seed: formData.days_to_maturity_seed ? parseInt(formData.days_to_maturity_seed) : null,
        days_to_maturity_transplant: formData.days_to_maturity_transplant ? parseInt(formData.days_to_maturity_transplant) : null,
        spacing_in_min: formData.spacing_min ? parseInt(formData.spacing_min) : null,
        spacing_in_max: formData.spacing_max ? parseInt(formData.spacing_max) : null,
        height_in_min: formData.height_min ? parseInt(formData.height_min) : null,
        height_in_max: formData.height_max ? parseInt(formData.height_max) : null,
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
        scoville_min: formData.scoville_min ? parseInt(formData.scoville_min) : null,
        scoville_max: formData.scoville_max ? parseInt(formData.scoville_max) : null,
        notes_private: formData.growing_notes || null,
        source_type: 'user_private',
        is_custom: true
      });

      // Create SeedLot
      await base44.entities.SeedLot.create({
        plant_profile_id: profile.id,
        quantity: formData.quantity ? parseInt(formData.quantity) : null,
        unit: formData.unit,
        year_acquired: formData.year_acquired,
        packed_for_year: formData.packed_for_year ? parseInt(formData.packed_for_year) : null,
        source_vendor_name: formData.source_vendor_name || null,
        source_vendor_url: formData.source_vendor_url || null,
        storage_location: formData.storage_location || null,
        lot_notes: formData.lot_notes || null,
        lot_images: formData.lot_images,
        is_wishlist: false,
        from_catalog: false
      });

      toast.success('Custom seed added to stash!');
      setShowSuggestButton(true);
      
      // Don't close immediately - show suggest button
      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
        setShowSuggestButton(false);
      }, 3000);
    } catch (error) {
      console.error('Error adding custom seed:', error);
      toast.error('Failed to add seed');
      setLoading(false);
    }
  };

  const handleSuggestToCatalog = async () => {
    try {
      const plantType = plantTypes.find(t => t.id === formData.plant_type_id);
      
      await base44.entities.VarietySuggestion.create({
        plant_type_id: formData.plant_type_id,
        plant_type_name: plantType?.common_name,
        variety_name: formData.variety_name,
        description: formData.description,
        days_to_maturity: formData.days_to_maturity_seed ? parseInt(formData.days_to_maturity_seed) : null,
        spacing_recommended: formData.spacing_min ? parseInt(formData.spacing_min) : null,
        plant_height_typical: formData.height_max ? `${formData.height_min || formData.height_max}` : null,
        sun_requirement: formData.sun_requirement,
        water_requirement: formData.water_requirement,
        growth_habit: formData.growth_habit,
        trellis_required: formData.trellis_required,
        container_friendly: formData.container_friendly,
        grower_notes: formData.growing_notes,
        images: formData.lot_images,
        submitted_by: (await base44.auth.me()).email,
        status: 'pending'
      });

      toast.success('Variety suggested to catalog! Admins will review it.');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error suggesting variety:', error);
      toast.error('Failed to submit suggestion');
    }
  };

  const selectedPlantType = plantTypes.find(t => t.id === formData.plant_type_id);
  const isPepperType = selectedPlantType?.common_name?.toLowerCase().includes('pepper');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add My Own Seeds</DialogTitle>
          <DialogDescription>
            Add a custom variety to your seed stash (may or may not be in our catalog)
          </DialogDescription>
        </DialogHeader>

        {showSuggestButton ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold">Seed Added!</h3>
            <p className="text-gray-600">Would you like to suggest this variety to our Plant Catalog?</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => { onOpenChange(false); onSuccess?.(); }}>
                No Thanks
              </Button>
              <Button onClick={handleSuggestToCatalog} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <Sparkles className="w-4 h-4" />
                Suggest to Catalog
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Plant Type */}
            <div>
              <Label>Plant Type <span className="text-red-500">*</span></Label>
              <Combobox
                options={plantTypes.map(type => ({
                  value: type.id,
                  label: `${type.icon || '🌱'} ${type.common_name}`,
                  searchValue: type.common_name.toLowerCase()
                }))}
                value={formData.plant_type_id}
                onChange={(value) => setFormData({ ...formData, plant_type_id: value })}
                placeholder="Select or search plant type"
                searchPlaceholder="Type to search (e.g., 'pep' for Pepper)..."
                className="mt-1"
              />
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

            {/* Description */}
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this variety..."
                className="mt-1"
                rows={2}
              />
            </div>

            {/* Seed Details Section */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">My Stash Info</h3>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="100"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
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

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label>Year Acquired</Label>
                  <Input
                    type="number"
                    value={formData.year_acquired}
                    onChange={(e) => setFormData({ ...formData, year_acquired: parseInt(e.target.value) || '' })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Packed For Year</Label>
                  <Input
                    type="number"
                    value={formData.packed_for_year}
                    onChange={(e) => setFormData({ ...formData, packed_for_year: e.target.value })}
                    placeholder="2025"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="mb-3">
                <Label>Vendor/Source</Label>
                <Input
                  value={formData.source_vendor_name}
                  onChange={(e) => setFormData({ ...formData, source_vendor_name: e.target.value })}
                  placeholder="Baker Creek, Johnny's, etc."
                  className="mt-1"
                />
              </div>

              <div className="mb-3">
                <Label>Vendor URL</Label>
                <Input
                  value={formData.source_vendor_url}
                  onChange={(e) => setFormData({ ...formData, source_vendor_url: e.target.value })}
                  placeholder="www.example.com"
                  className="mt-1"
                />
              </div>

              <div className="mb-3">
                <Label>Storage Location</Label>
                <Input
                  value={formData.storage_location}
                  onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                  placeholder="Fridge, Box A, etc."
                  className="mt-1"
                />
              </div>

              <div className="mb-3">
                <Label>Lot Notes</Label>
                <Textarea
                  value={formData.lot_notes}
                  onChange={(e) => setFormData({ ...formData, lot_notes: e.target.value })}
                  placeholder="Notes about this seed lot..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>

            {/* Growing Details Section */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Variety Details</h3>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label>Days to Maturity (seed)</Label>
                  <Input
                    type="number"
                    value={formData.days_to_maturity_seed}
                    onChange={(e) => setFormData({ ...formData, days_to_maturity_seed: e.target.value })}
                    placeholder="65"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Days to Maturity (transplant)</Label>
                  <Input
                    type="number"
                    value={formData.days_to_maturity_transplant}
                    onChange={(e) => setFormData({ ...formData, days_to_maturity_transplant: e.target.value })}
                    placeholder="55"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label>Spacing Min (inches)</Label>
                  <Input
                    type="number"
                    value={formData.spacing_min}
                    onChange={(e) => setFormData({ ...formData, spacing_min: e.target.value })}
                    placeholder="12"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Spacing Max (inches)</Label>
                  <Input
                    type="number"
                    value={formData.spacing_max}
                    onChange={(e) => setFormData({ ...formData, spacing_max: e.target.value })}
                    placeholder="24"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label>Height Min (inches)</Label>
                  <Input
                    type="number"
                    value={formData.height_min}
                    onChange={(e) => setFormData({ ...formData, height_min: e.target.value })}
                    placeholder="24"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Height Max (inches)</Label>
                  <Input
                    type="number"
                    value={formData.height_max}
                    onChange={(e) => setFormData({ ...formData, height_max: e.target.value })}
                    placeholder="36"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label>Sun Requirement</Label>
                  <Select value={formData.sun_requirement} onValueChange={(v) => setFormData({ ...formData, sun_requirement: v })}>
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
                  <Select value={formData.water_requirement} onValueChange={(v) => setFormData({ ...formData, water_requirement: v })}>
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

              <div className="mb-3">
                <Label>Growth Habit</Label>
                <Input
                  value={formData.growth_habit}
                  onChange={(e) => setFormData({ ...formData, growth_habit: e.target.value })}
                  placeholder="e.g., Bush, Vining, Indeterminate"
                  className="mt-1"
                />
              </div>

              <div className="mb-3">
                <Label>Transplant Timing</Label>
                <Input
                  value={formData.transplant_timing}
                  onChange={(e) => setFormData({ ...formData, transplant_timing: e.target.value })}
                  placeholder="e.g., 6 weeks before frost, 2 weeks after frost"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label>Flavor Profile</Label>
                  <Input
                    value={formData.flavor_profile}
                    onChange={(e) => setFormData({ ...formData, flavor_profile: e.target.value })}
                    placeholder="Sweet, tangy, etc."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Fruit Color</Label>
                  <Input
                    value={formData.fruit_color}
                    onChange={(e) => setFormData({ ...formData, fruit_color: e.target.value })}
                    placeholder="Red, yellow, etc."
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="mb-3">
                <Label>Fruit Shape</Label>
                <Input
                  value={formData.fruit_shape}
                  onChange={(e) => setFormData({ ...formData, fruit_shape: e.target.value })}
                  placeholder="Round, oblong, etc."
                  className="mt-1"
                />
              </div>

              {isPepperType && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label>Scoville Min (peppers)</Label>
                    <Input
                      type="number"
                      value={formData.scoville_min}
                      onChange={(e) => setFormData({ ...formData, scoville_min: e.target.value })}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Scoville Max</Label>
                    <Input
                      type="number"
                      value={formData.scoville_max}
                      onChange={(e) => setFormData({ ...formData, scoville_max: e.target.value })}
                      placeholder="5000"
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.container_friendly}
                    onCheckedChange={(checked) => setFormData({ ...formData, container_friendly: checked })}
                  />
                  <span className="text-sm">Container Friendly</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.trellis_required}
                    onCheckedChange={(checked) => setFormData({ ...formData, trellis_required: checked })}
                  />
                  <span className="text-sm">Trellis Required</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.is_perennial}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_perennial: checked })}
                  />
                  <span className="text-sm">Perennial</span>
                </label>
              </div>

              <div className="mb-3">
                <Label>Growing Notes</Label>
                <Textarea
                  value={formData.growing_notes}
                  onChange={(e) => setFormData({ ...formData, growing_notes: e.target.value })}
                  placeholder="Tips for growing this variety..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label>Photos</Label>
                <div className="mt-2 space-y-2">
                  {formData.lot_images.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {formData.lot_images.map((url, idx) => (
                        <div key={idx} className="relative group">
                          <img src={url} alt="Seed" loading="lazy" className="w-full h-20 object-cover rounded-lg" />
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
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button 
                onClick={handleSubmit}
                disabled={loading || !formData.plant_type_id || !formData.variety_name.trim()}
                className="bg-emerald-600 hover:bg-emerald-700"
                >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  'Add to Stash'
                )}
                </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}