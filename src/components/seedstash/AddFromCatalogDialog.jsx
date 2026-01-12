import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AddFromCatalogDialog({ open, onOpenChange, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [plantTypes, setPlantTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [selectedPlantTypeId, setSelectedPlantTypeId] = useState('');
  const [selectedVarietyId, setSelectedVarietyId] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [seedData, setSeedData] = useState({
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

  useEffect(() => {
    if (selectedPlantTypeId) {
      setSelectedVarietyId('');
      loadVarieties();
    } else {
      setVarieties([]);
      setSelectedVarietyId('');
    }
  }, [selectedPlantTypeId]);

  const loadPlantTypes = async () => {
    try {
      const types = await base44.entities.PlantType.list('common_name');
      setPlantTypes(types.filter(t => t.common_name));
    } catch (error) {
      console.error('Error loading plant types:', error);
    }
  };

  const loadVarieties = async () => {
    if (!selectedPlantTypeId) return;
    try {
      const vars = await base44.entities.Variety.filter({ 
        plant_type_id: selectedPlantTypeId,
        status: 'active'
      }, 'variety_name');
      setVarieties(vars);
    } catch (error) {
      console.error('Error loading varieties:', error);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSeedData({ 
        ...seedData, 
        lot_images: [...(seedData.lot_images || []), file_url] 
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
    const plantType = plantTypes.find(t => t.id === selectedPlantTypeId);
    const variety = varieties.find(v => v.id === selectedVarietyId);
    
    if (!plantType || !variety) {
      toast.error('Please select plant type and variety');
      return;
    }

    setLoading(true);
    try {
      // Create or get PlantProfile
      let profile = null;
      const existingProfiles = await base44.entities.PlantProfile.filter({
        plant_type_id: plantType.id,
        variety_id: variety.id
      });

      if (existingProfiles.length > 0) {
        profile = existingProfiles[0];
      } else {
        profile = await base44.entities.PlantProfile.create({
          plant_type_id: plantType.id,
          plant_type_name: plantType.common_name,
          variety_id: variety.id,
          variety_name: variety.variety_name,
          common_name: plantType.common_name,
          days_to_maturity_seed: variety.days_to_maturity,
          spacing_in_min: variety.spacing_min || variety.spacing_recommended,
          spacing_in_max: variety.spacing_max || variety.spacing_recommended,
          source_type: 'catalog'
        });
      }

      // Create SeedLot
      await base44.entities.SeedLot.create({
        plant_profile_id: profile.id,
        quantity: seedData.quantity ? parseFloat(seedData.quantity) : null,
        unit: seedData.unit,
        year_acquired: seedData.year_acquired,
        packed_for_year: seedData.packed_for_year || null,
        source_vendor_name: seedData.source_vendor_name || null,
        source_url: seedData.source_vendor_url || null,
        source_vendor_url: seedData.source_vendor_url || null,
        storage_location: seedData.storage_location || null,
        lot_notes: seedData.lot_notes || null,
        lot_images: seedData.lot_images || [],
        is_wishlist: false,
        from_catalog: true
      });

      toast.success('Seed added to your stash!');
      onSuccess?.();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error adding seed:', error);
      toast.error('Failed to add seed');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedPlantTypeId('');
    setSelectedVarietyId('');
    setSeedData({
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

  const selectedPlantType = plantTypes.find(t => t.id === selectedPlantTypeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add Seeds from Plant Catalog</DialogTitle>
          <DialogDescription>
            Select a variety from our catalog and add it to your stash
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Plant Type */}
          <div>
            <Label>Plant Type <span className="text-red-500">*</span></Label>
            <Select 
              value={String(selectedPlantTypeId || '')} 
              onValueChange={(id) => setSelectedPlantTypeId(String(id))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select plant type..." />
              </SelectTrigger>
              <SelectContent>
                {plantTypes.map(type => (
                  <SelectItem key={type.id} value={String(type.id)}>
                    {type.icon} {type.common_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Variety */}
          {selectedPlantTypeId && (
            <div>
              <Label>Variety Name <span className="text-red-500">*</span></Label>
              {varieties.length === 0 ? (
                <div className="mt-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-gray-700">
                    No varieties available for {selectedPlantType?.common_name}. Use "Add My Own Seeds" to create a custom variety.
                  </p>
                </div>
              ) : (
                <Select 
                  value={String(selectedVarietyId || '')}
                  onValueChange={(id) => setSelectedVarietyId(String(id))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select variety..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {varieties.map(v => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.variety_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Stash Info */}
          {selectedVarietyId && (
            <>
              <div className="border-t pt-4">
                <h3 className="font-semibold text-sm text-gray-700 mb-3">Your Stash Info</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={seedData.quantity}
                    onChange={(e) => setSeedData({ ...seedData, quantity: e.target.value })}
                    placeholder="e.g., 20"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Select 
                    value={seedData.unit} 
                    onValueChange={(v) => setSeedData({ ...seedData, unit: v })}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Year Acquired</Label>
                  <Input
                    type="number"
                    value={seedData.year_acquired}
                    onChange={(e) => setSeedData({ ...seedData, year_acquired: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Packed For Year</Label>
                  <Input
                    type="number"
                    value={seedData.packed_for_year}
                    onChange={(e) => setSeedData({ ...seedData, packed_for_year: parseInt(e.target.value) || '' })}
                    placeholder="2025"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Vendor/Source</Label>
                <Input
                  value={seedData.source_vendor_name}
                  onChange={(e) => setSeedData({ ...seedData, source_vendor_name: e.target.value })}
                  placeholder="e.g., Baker Creek"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Vendor URL</Label>
                <Input
                  value={seedData.source_vendor_url}
                  onChange={(e) => setSeedData({ ...seedData, source_vendor_url: e.target.value })}
                  placeholder="e.g., https://www.example.com"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Storage Location</Label>
                <Input
                  value={seedData.storage_location}
                  onChange={(e) => setSeedData({ ...seedData, storage_location: e.target.value })}
                  placeholder="e.g., Refrigerator, Shelf A"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={seedData.lot_notes}
                  onChange={(e) => setSeedData({ ...seedData, lot_notes: e.target.value })}
                  rows={3}
                  placeholder="Any notes about these seeds..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Photos</Label>
                <div className="mt-2 space-y-2">
                  {seedData.lot_images?.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {seedData.lot_images.map((url, idx) => (
                        <div key={idx} className="relative group">
                          <img src={url} alt="Seed" className="w-full h-20 object-cover rounded-lg" />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={() => {
                              const updated = seedData.lot_images.filter((_, i) => i !== idx);
                              setSeedData({ ...seedData, lot_images: updated });
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
                    onClick={() => document.getElementById('catalog-seed-photo').click()}
                    className="w-full"
                  >
                    {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Add Photo
                  </Button>
                  <input
                    id="catalog-seed-photo"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedPlantTypeId || !selectedVarietyId}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Add to Stash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}