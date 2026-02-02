import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Package } from 'lucide-react';

export default function AddToStashModal({ open, onOpenChange, variety, plantType, onSuccess }) {
  const [saving, setSaving] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [existingLotId, setExistingLotId] = useState(null);
  
  // V1B-11: Escape closes modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) onOpenChange(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);
  
  const [formData, setFormData] = useState({
    quantity: '',
    unit: 'seeds',
    year_acquired: new Date().getFullYear(),
    packed_for_year: '',
    source_vendor_name: '',
    source_vendor_url: '',
    lot_notes: '',
    storage_location: ''
  });

  useEffect(() => {
    if (open && variety) {
      checkIfExists();
    }
  }, [open, variety]);

  const checkIfExists = async () => {
    try {
      const user = await base44.auth.me();
      const existingProfiles = await base44.entities.PlantProfile.filter({
        variety_name: variety.variety_name,
        plant_type_id: variety.plant_type_id
      });
      
      if (existingProfiles.length > 0) {
        const existingLots = await base44.entities.SeedLot.filter({
          plant_profile_id: existingProfiles[0].id,
          created_by: user.email
        });
        
        if (existingLots.length > 0) {
          setAlreadyExists(true);
          setExistingLotId(existingLots[0].id);
          return;
        }
      }
      
      setAlreadyExists(false);
      setExistingLotId(null);
    } catch (error) {
      console.error('Error checking if exists:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (saving) return; // Prevent double-submit
    setSaving(true);

    try {
      console.log('[AddToStashModal] Starting submission for variety:', variety?.variety_name);
      
      if (!variety?.plant_type_id || !variety?.variety_name) {
        toast.error('Invalid variety data');
        setSaving(false);
        return;
      }

      // Find or create PlantProfile with proper null checks
      const existingProfiles = await base44.entities.PlantProfile.filter({
        variety_name: variety.variety_name,
        plant_type_id: variety.plant_type_id
      });
      
      let profileId;
      
      if (existingProfiles.length > 0) {
        profileId = existingProfiles[0].id;
        console.log('[AddToStashModal] Using existing PlantProfile:', profileId);
      } else {
        // Get PlantType for common_name
        const plantTypeResults = await base44.entities.PlantType.filter({ id: variety.plant_type_id });
        const plantTypeData = plantTypeResults.length > 0 ? plantTypeResults[0] : null;
        
        console.log('[AddToStashModal] Creating new PlantProfile');
        
        // Create new PlantProfile from Variety data with CRITICAL linkage
        const newProfile = await base44.entities.PlantProfile.create({
          plant_type_id: variety.plant_type_id,
          variety_id: variety.id, // CRITICAL: Link back to Variety for rich catalog data
          plant_subcategory_id: variety.plant_subcategory_id || null,
          plant_family: plantTypeData?.plant_family_id || null,
          common_name: plantTypeData?.common_name || plantType?.common_name || 'Unknown',
          variety_name: variety.variety_name,
          days_to_maturity_seed: variety.days_to_maturity || null,
          spacing_in_min: variety.spacing_recommended || null,
          spacing_in_max: variety.spacing_recommended || null,
          height_in_min: variety.height_min || null,
          height_in_max: variety.height_max || null,
          sun_requirement: variety.sun_requirement || null,
          water_requirement: variety.water_requirement || null,
          trellis_required: variety.trellis_required || false,
          container_friendly: variety.container_friendly || false,
          notes_public: variety.grower_notes || null,
          source_type: 'user_private'
        });
        profileId = newProfile.id;
        console.log('[AddToStashModal] Created PlantProfile with variety_id linkage:', { profileId, varietyId: variety.id });
      }

      // Check for duplicate SeedLots before creating
      const user = await base44.auth.me();
      const existingSeedLots = await base44.entities.SeedLot.filter({
        plant_profile_id: profileId,
        is_wishlist: false,
        created_by: user.email
      });
      
      if (existingSeedLots.length > 0) {
        console.log('[AddToStashModal] SeedLot already exists, not creating duplicate:', existingSeedLots[0].id);
        toast.info('This variety is already in your stash');
        onOpenChange(false);
        if (onSuccess) onSuccess();
        return;
      }

      const seedLotData = {
        plant_profile_id: profileId,
        quantity: formData.quantity ? parseInt(formData.quantity) : null,
        unit: formData.unit || 'seeds',
        year_acquired: formData.year_acquired ? parseInt(formData.year_acquired) : new Date().getFullYear(),
        packed_for_year: formData.packed_for_year ? parseInt(formData.packed_for_year) : null,
        source_vendor_name: formData.source_vendor_name || null,
        source_vendor_url: formData.source_vendor_url || null,
        lot_notes: formData.lot_notes || null,
        storage_location: formData.storage_location || null,
        from_catalog: true,
        is_wishlist: false
      };
      
      console.log('[AddToStashModal] Creating SeedLot with:', { ...seedLotData, profileId });
      const seedLot = await base44.entities.SeedLot.create(seedLotData);
      console.log('[AddToStashModal] SeedLot created successfully:', { 
        seedLotId: seedLot.id, 
        plant_profile_id: seedLot.plant_profile_id,
        linkage_chain: `SeedLot -> PlantProfile(${profileId}) -> Variety(${variety.id})`
      });

      toast.success('Added to seed stash!');
      onOpenChange(false);
      if (onSuccess) onSuccess();
      
      // Reset form
      setFormData({
        quantity: '',
        unit: 'seeds',
        year_acquired: new Date().getFullYear(),
        packed_for_year: '',
        source_vendor_name: '',
        source_vendor_url: '',
        lot_notes: '',
        storage_location: ''
      });
    } catch (error) {
      console.error('[AddToStashModal] Error adding to stash:', error);
      toast.error('Failed to add to stash: ' + (error.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to Seed Stash</DialogTitle>
          <p className="text-sm text-gray-600 mt-1">
            {variety?.variety_name} • {plantType?.common_name}
          </p>
        </DialogHeader>

        {alreadyExists ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Already in Seed Stash</h3>
            <p className="text-gray-600 mb-6">This variety is already in your seed collection.</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button 
                onClick={() => window.location.href = createPageUrl('SeedStashDetail') + `?id=${existingLotId}`}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                View in Stash
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="100"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seeds">Seeds</SelectItem>
                  <SelectItem value="grams">Grams</SelectItem>
                  <SelectItem value="packets">Packets</SelectItem>
                  <SelectItem value="ounces">Ounces</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="year_acquired">Year Acquired</Label>
              <Input
                id="year_acquired"
                type="number"
                value={formData.year_acquired}
                onChange={(e) => setFormData({ ...formData, year_acquired: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="packed_for_year">Packed For Year</Label>
              <Input
                id="packed_for_year"
                type="number"
                value={formData.packed_for_year}
                onChange={(e) => setFormData({ ...formData, packed_for_year: e.target.value })}
                placeholder="2025"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="vendor">Vendor/Source</Label>
            <Input
              id="vendor"
              value={formData.source_vendor_name}
              onChange={(e) => setFormData({ ...formData, source_vendor_name: e.target.value })}
              placeholder="Baker Creek, Johnny's, etc."
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="vendor_url">Vendor URL</Label>
            <Input
              id="vendor_url"
              value={formData.source_vendor_url}
              onChange={(e) => setFormData({ ...formData, source_vendor_url: e.target.value })}
              placeholder="pepperseeds.net or www.example.com"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="storage">Storage Location</Label>
            <Input
              id="storage"
              value={formData.storage_location}
              onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
              placeholder="Fridge, basement, etc."
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.lot_notes}
              onChange={(e) => setFormData({ ...formData, lot_notes: e.target.value })}
              placeholder="Any additional notes..."
              className="mt-1"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                'Add to Stash'
              )}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}