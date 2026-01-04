import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
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
import { Loader2 } from 'lucide-react';

export default function AddToStashModal({ open, onOpenChange, variety, plantType, profile, onSuccess }) {
  // Support both Variety and PlantProfile
  const plantData = profile || variety;
  const [saving, setSaving] = useState(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await base44.entities.SeedLot.create({
        plant_profile_id: plantData.id,
        quantity: formData.quantity ? parseInt(formData.quantity) : null,
        unit: formData.unit,
        year_acquired: parseInt(formData.year_acquired),
        packed_for_year: formData.packed_for_year ? parseInt(formData.packed_for_year) : null,
        source_vendor_name: formData.source_vendor_name,
        source_vendor_url: formData.source_vendor_url,
        lot_notes: formData.lot_notes,
        storage_location: formData.storage_location,
        is_wishlist: false
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
      console.error('Error adding to stash:', error);
      toast.error('Failed to add to stash');
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
            {plantData?.variety_name} • {plantType?.common_name || plantData?.common_name}
          </p>
        </DialogHeader>

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
              type="url"
              value={formData.source_vendor_url}
              onChange={(e) => setFormData({ ...formData, source_vendor_url: e.target.value })}
              placeholder="https://..."
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
      </DialogContent>
    </Dialog>
  );
}