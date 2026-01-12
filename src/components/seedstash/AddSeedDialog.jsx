import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function AddSeedDialog({ open, onOpenChange, onSuccess }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [plantTypes, setPlantTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [selectedPlantTypeId, setSelectedPlantTypeId] = useState('');
  const [selectedVarietyId, setSelectedVarietyId] = useState('');
  const [showAddVariety, setShowAddVariety] = useState(false);
  const [newVarietyName, setNewVarietyName] = useState('');
  const [seedData, setSeedData] = useState({
    quantity: '',
    unit: 'seeds',
    year_acquired: new Date().getFullYear(),
    source_vendor_name: '',
    storage_location: '',
    lot_notes: ''
  });

  useEffect(() => {
    if (open) {
      loadPlantTypes();
      setStep(1);
      setSelectedPlantTypeId('');
      setSelectedVarietyId('');
      setShowAddVariety(false);
    }
  }, [open]);

  useEffect(() => {
    if (selectedPlantTypeId) {
      loadVarieties();
    } else {
      setVarieties([]);
      setSelectedVarietyId('');
    }
  }, [selectedPlantTypeId]);

  const loadPlantTypes = async () => {
    try {
      const types = await base44.entities.PlantType.list('common_name');
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
      console.log('[AddSeed] Loaded', vars.length, 'varieties for plant type', selectedPlantTypeId);
      setVarieties(vars);
    } catch (error) {
      console.error('Error loading varieties:', error);
    }
  };

  const handleCreateVariety = async () => {
    if (!newVarietyName.trim()) {
      toast.error('Please enter a variety name');
      return;
    }

    const plantType = plantTypes.find(t => t.id === selectedPlantTypeId);
    if (!plantType) {
      toast.error('Plant type not found');
      return;
    }

    setLoading(true);
    try {
      const newVariety = await base44.entities.Variety.create({
        plant_type_id: plantType.id,
        plant_type_name: plantType.common_name,
        variety_name: newVarietyName,
        status: 'active',
        is_custom: true
      });
      
      setVarieties([...varieties, newVariety]);
      setSelectedVarietyId(newVariety.id);
      setShowAddVariety(false);
      setNewVarietyName('');
      toast.success('Variety added!');
    } catch (error) {
      console.error('Error creating variety:', error);
      toast.error('Failed to create variety');
    } finally {
      setLoading(false);
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
          variety_name: variety.variety_name
        });
      }

      // Create SeedLot
      await base44.entities.SeedLot.create({
        plant_profile_id: profile.id,
        quantity: seedData.quantity ? parseFloat(seedData.quantity) : null,
        unit: seedData.unit,
        year_acquired: seedData.year_acquired,
        source_vendor_name: seedData.source_vendor_name,
        storage_location: seedData.storage_location,
        lot_notes: seedData.lot_notes,
        is_wishlist: false,
        from_catalog: true
      });

      toast.success('Seed added to your stash!');
      onSuccess?.();
      onOpenChange(false);
      
      // Reset
      setStep(1);
      setSelectedPlantTypeId('');
      setSelectedVarietyId('');
      setSeedData({
        quantity: '',
        unit: 'seeds',
        year_acquired: new Date().getFullYear(),
        source_vendor_name: '',
        storage_location: '',
        lot_notes: ''
      });
    } catch (error) {
      console.error('Error adding seed:', error);
      toast.error('Failed to add seed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Seeds to Stash</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Plant Type */}
          <div>
            <Label>Plant Type (from catalog)</Label>
            <Select 
              value={selectedPlantTypeId} 
              onValueChange={(id) => {
                console.log('[AddSeed] Selected plant type ID:', id);
                setSelectedPlantTypeId(id);
                setSelectedVarietyId('');
                setShowAddVariety(false);
              }}
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

          {/* Step 2: Variety */}
          {selectedPlantTypeId && (
            <div>
              <Label>Variety Name <span className="text-red-500">*</span></Label>
              {!showAddVariety && varieties.length === 0 ? (
                <div className="mt-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-gray-700 mb-3">
                    No varieties available for {plantTypes.find(t => t.id === selectedPlantTypeId)?.common_name}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setShowAddVariety(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Variety
                  </Button>
                </div>
              ) : showAddVariety ? (
                <div className="mt-2 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  <div>
                    <Label htmlFor="newVarietyName">New Variety Name</Label>
                    <Input
                      id="newVarietyName"
                      value={newVarietyName}
                      onChange={(e) => setNewVarietyName(e.target.value)}
                      placeholder="e.g., Cherokee Purple"
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleCreateVariety}
                      disabled={loading || !newVarietyName.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Create Variety
                    </Button>
                    {varieties.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowAddVariety(false);
                          setNewVarietyName('');
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-1">
                  <Select 
                    value={selectedVarietyId} 
                    onValueChange={(id) => {
                      console.log('[AddSeed] Selected variety ID:', id);
                      setSelectedVarietyId(id);
                    }}
                    className="flex-1"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select variety..." />
                    </SelectTrigger>
                    <SelectContent>
                      {varieties.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.variety_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddVariety(true)}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Seed Details */}
          {selectedVarietyId && (
            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
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
                  <Label htmlFor="year">Year Acquired</Label>
                  <Input
                    id="year"
                    type="number"
                    value={seedData.year_acquired}
                    onChange={(e) => setSeedData({ ...seedData, year_acquired: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="vendor">Vendor/Source</Label>
                  <Input
                    id="vendor"
                    value={seedData.source_vendor_name}
                    onChange={(e) => setSeedData({ ...seedData, source_vendor_name: e.target.value })}
                    placeholder="e.g., Baker Creek"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="storage">Storage Location</Label>
                <Input
                  id="storage"
                  value={seedData.storage_location}
                  onChange={(e) => setSeedData({ ...seedData, storage_location: e.target.value })}
                  placeholder="e.g., Refrigerator, Shelf A"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={seedData.lot_notes}
                  onChange={(e) => setSeedData({ ...seedData, lot_notes: e.target.value })}
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
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
            Add Seed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}