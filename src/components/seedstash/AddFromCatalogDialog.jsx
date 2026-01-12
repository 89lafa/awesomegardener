import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AddFromCatalogDialog({ open, onOpenChange, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [plantTypes, setPlantTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [selectedPlantTypeId, setSelectedPlantTypeId] = useState('');
  const [selectedVarietyId, setSelectedVarietyId] = useState('');
  
  const [formData, setFormData] = useState({
    quantity: '',
    unit: 'seeds',
    year_acquired: new Date().getFullYear(),
    packed_for_year: '',
    source_vendor_name: '',
    source_vendor_url: '',
    storage_location: '',
    lot_notes: ''
  });

  useEffect(() => {
    if (open) {
      loadPlantTypes();
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (selectedPlantTypeId) {
      console.log('[AddFromCatalog] Loading varieties for type:', selectedPlantTypeId);
      setSelectedVarietyId('');
      loadVarieties();
    } else {
      setVarieties([]);
      setSelectedVarietyId('');
    }
  }, [selectedPlantTypeId]);

  useEffect(() => {
    console.log('[AddFromCatalog] selectedVarietyId:', selectedVarietyId, typeof selectedVarietyId);
  }, [selectedVarietyId]);

  const loadPlantTypes = async () => {
    try {
      const types = await base44.entities.PlantType.list('common_name');
      console.log('[AddFromCatalog] Loaded', types.length, 'plant types');
      setPlantTypes(types);
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
      console.log('[AddFromCatalog] Loaded', vars.length, 'varieties');
      setVarieties(vars);
    } catch (error) {
      console.error('Error loading varieties:', error);
      setVarieties([]);
    }
  };

  const resetForm = () => {
    setSelectedPlantTypeId('');
    setSelectedVarietyId('');
    setFormData({
      quantity: '',
      unit: 'seeds',
      year_acquired: new Date().getFullYear(),
      packed_for_year: '',
      source_vendor_name: '',
      source_vendor_url: '',
      storage_location: '',
      lot_notes: ''
    });
  };

  const handleSubmit = async () => {
    const variety = varieties.find(v => v.id === selectedVarietyId);
    const plantType = plantTypes.find(t => t.id === selectedPlantTypeId);
    
    if (!variety || !plantType) {
      toast.error('Please select plant type and variety');
      return;
    }

    setLoading(true);
    try {
      console.log('[AddFromCatalog] Creating for variety:', variety.variety_name);
      const user = await base44.auth.me();

      // Find or create PlantProfile
      let profileId;
      const existingProfiles = await base44.entities.PlantProfile.filter({
        variety_name: variety.variety_name,
        plant_type_id: variety.plant_type_id
      });
      
      if (existingProfiles.length > 0) {
        profileId = existingProfiles[0].id;
        console.log('[AddFromCatalog] Using existing profile:', profileId);
      } else {
        const newProfile = await base44.entities.PlantProfile.create({
          plant_type_id: variety.plant_type_id,
          plant_subcategory_id: variety.plant_subcategory_id,
          plant_family: plantType?.plant_family_id,
          common_name: plantType?.common_name,
          variety_name: variety.variety_name,
          days_to_maturity_seed: variety.days_to_maturity,
          spacing_in_min: variety.spacing_recommended,
          spacing_in_max: variety.spacing_recommended,
          height_in_min: variety.height_min,
          height_in_max: variety.height_max,
          sun_requirement: variety.sun_requirement,
          trellis_required: variety.trellis_required,
          container_friendly: variety.container_friendly,
          notes_public: variety.grower_notes,
          source_type: 'user_private'
        });
        profileId = newProfile.id;
        console.log('[AddFromCatalog] Created profile:', profileId);
      }

      // Check for duplicates
      const existingLots = await base44.entities.SeedLot.filter({
        plant_profile_id: profileId,
        is_wishlist: false,
        created_by: user.email
      });
      
      if (existingLots.length > 0) {
        toast.info('This variety is already in your stash');
        onOpenChange(false);
        onSuccess?.();
        return;
      }

      // Create SeedLot
      await base44.entities.SeedLot.create({
        plant_profile_id: profileId,
        quantity: formData.quantity ? parseInt(formData.quantity) : null,
        unit: formData.unit,
        year_acquired: formData.year_acquired,
        packed_for_year: formData.packed_for_year ? parseInt(formData.packed_for_year) : null,
        source_vendor_name: formData.source_vendor_name || null,
        source_vendor_url: formData.source_vendor_url || null,
        storage_location: formData.storage_location || null,
        lot_notes: formData.lot_notes || null,
        is_wishlist: false,
        from_catalog: true
      });

      toast.success('Added to seed stash!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error adding from catalog:', error);
      toast.error('Failed to add seed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Seeds from Plant Catalog</DialogTitle>
          <DialogDescription>
            Select a variety from our catalog and add your stash details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Plant Type */}
          <div>
            <Label>Plant Type <span className="text-red-500">*</span></Label>
            <Select 
              value={String(selectedPlantTypeId || '')} 
              onValueChange={(id) => {
                console.log('[AddFromCatalog] Plant type selected:', id, typeof id);
                setSelectedPlantTypeId(String(id));
              }}
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
              <Label>Variety <span className="text-red-500">*</span></Label>
              {varieties.length === 0 ? (
                <p className="text-sm text-gray-500 mt-2">
                  No varieties in catalog for {plantTypes.find(t => t.id === selectedPlantTypeId)?.common_name}
                </p>
              ) : (
                <Select 
                  value={String(selectedVarietyId || '')}
                  onValueChange={(id) => {
                    console.log('[AddFromCatalog] Variety selected:', id, typeof id);
                    setSelectedVarietyId(String(id));
                  }}
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

          {/* Stash Details - only show after variety selected */}
          {selectedVarietyId && (
            <>
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 text-sm">My Stash Info</h3>
                
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

                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.lot_notes}
                    onChange={(e) => setFormData({ ...formData, lot_notes: e.target.value })}
                    placeholder="Notes about this seed lot..."
                    className="mt-1"
                    rows={2}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
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