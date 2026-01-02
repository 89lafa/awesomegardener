import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Plus, Trash2, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function PlantingViewGreenhouse({ item, garden, onClose, onUpdate }) {
  const [plantings, setPlantings] = useState([]);
  const [plantTypes, setPlantTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlantDialog, setShowPlantDialog] = useState(false);
  const [showCapacityDialog, setShowCapacityDialog] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [capacity, setCapacity] = useState(item.metadata?.capacity || 20);
  const [newCapacity, setNewCapacity] = useState(capacity);
  const [newPlanting, setNewPlanting] = useState({
    plant_type_id: '',
    planting_method: 'TRANSPLANT',
    date_planted: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [item.id]);

  const loadData = async () => {
    try {
      if (!item?.id) {
        throw new Error('Invalid item');
      }
      const [plantingsData, typesData] = await Promise.all([
        base44.entities.Planting.filter({ item_id: item.id }),
        base44.entities.PlantType.list('common_name', 100)
      ]);
      setPlantings(plantingsData || []);
      setPlantTypes(typesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load planting data');
      setPlantings([]);
      setPlantTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotClick = (slotNum) => {
    const existing = plantings.find(p => p.location_ref?.slot === slotNum);
    if (existing) {
      setSelectedSlot({ num: slotNum, planting: existing });
    } else {
      setSelectedSlot({ num: slotNum, planting: null });
      setShowPlantDialog(true);
    }
  };

  const handlePlant = async () => {
    if (!newPlanting.plant_type_id || !selectedSlot) return;

    const plantType = plantTypes.find(pt => pt.id === newPlanting.plant_type_id);

    try {
      const planting = await base44.entities.Planting.create({
        garden_id: garden.id,
        item_id: item.id,
        plant_type_id: newPlanting.plant_type_id,
        plant_type_name: plantType.common_name,
        planting_method: newPlanting.planting_method,
        date_planted: newPlanting.date_planted,
        quantity: 1,
        notes: newPlanting.notes,
        status: 'PLANTED',
        location_type: 'SLOT',
        location_ref: { slot: selectedSlot.num }
      });

      setPlantings([...plantings, planting]);
      setShowPlantDialog(false);
      setSelectedSlot(null);
      setNewPlanting({
        plant_type_id: '',
        planting_method: 'TRANSPLANT',
        date_planted: new Date().toISOString().split('T')[0],
        notes: ''
      });
      toast.success('Plant added!');
      onUpdate?.();
    } catch (error) {
      console.error('Error planting:', error);
      toast.error('Failed to plant');
    }
  };

  const handleRemovePlanting = async (planting) => {
    if (!confirm('Remove this plant?')) return;
    try {
      await base44.entities.Planting.delete(planting.id);
      setPlantings(plantings.filter(p => p.id !== planting.id));
      setSelectedSlot(null);
      toast.success('Plant removed');
      onUpdate?.();
    } catch (error) {
      console.error('Error removing:', error);
    }
  };

  const handleUpdateCapacity = async () => {
    const newCap = parseInt(newCapacity);
    if (newCap < plantings.length) {
      toast.error(`Cannot reduce capacity below ${plantings.length} (current planted count)`);
      return;
    }

    try {
      await base44.entities.PlotItem.update(item.id, {
        metadata: { ...item.metadata, capacity: newCap }
      });
      setCapacity(newCap);
      setShowCapacityDialog(false);
      toast.success('Capacity updated');
      onUpdate?.();
    } catch (error) {
      console.error('Error updating capacity:', error);
      toast.error('Failed to update capacity');
    }
  };

  const getSlotPlanting = (slotNum) => {
    return plantings.find(p => p.location_ref?.slot === slotNum);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-xl font-bold">{item.label}</h2>
          <p className="text-sm text-gray-500">
            {plantings.length} / {capacity} slots planted
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setNewCapacity(capacity); setShowCapacityDialog(true); }}>
            <Settings className="w-4 h-4 mr-2" />
            Capacity
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: capacity }).map((_, i) => {
            const slotNum = i + 1;
            const planting = getSlotPlanting(slotNum);
            return (
              <button
                key={i}
                onClick={() => handleSlotClick(slotNum)}
                className={cn(
                  "h-24 rounded-lg border-2 flex flex-col items-center justify-center transition-all",
                  planting ? "bg-emerald-50 border-emerald-300 hover:bg-emerald-100" : "bg-white border-gray-200 hover:border-gray-300",
                  selectedSlot?.num === slotNum && "ring-2 ring-emerald-500"
                )}
              >
                <div className="text-xs text-gray-400 mb-1">Slot {slotNum}</div>
                {planting ? (
                  <div className="text-sm font-medium text-center px-2">{planting.plant_type_name}</div>
                ) : (
                  <Plus className="w-5 h-5 text-gray-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedSlot?.planting && (
        <Card className="m-4 mt-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{selectedSlot.planting.plant_type_name}</h3>
                <p className="text-sm text-gray-500">Slot {selectedSlot.num}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Planted: {selectedSlot.planting.date_planted}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemovePlanting(selectedSlot.planting)}
                className="text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showPlantDialog} onOpenChange={setShowPlantDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plant in Slot {selectedSlot?.num}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plant Type *</Label>
              <Select value={newPlanting.plant_type_id} onValueChange={(v) => setNewPlanting({ ...newPlanting, plant_type_id: v })}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose plant..." />
                </SelectTrigger>
                <SelectContent>
                  {plantTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>{pt.common_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date Planted</Label>
              <Input
                type="date"
                value={newPlanting.date_planted}
                onChange={(e) => setNewPlanting({ ...newPlanting, date_planted: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes..."
                value={newPlanting.notes}
                onChange={(e) => setNewPlanting({ ...newPlanting, notes: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlantDialog(false)}>Cancel</Button>
            <Button onClick={handlePlant} disabled={!newPlanting.plant_type_id} className="bg-emerald-600 hover:bg-emerald-700">
              Plant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCapacityDialog} onOpenChange={setShowCapacityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Greenhouse Capacity</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Number of Plant Slots</Label>
            <Input
              type="number"
              min={plantings.length}
              value={newCapacity}
              onChange={(e) => setNewCapacity(e.target.value)}
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-2">
              Minimum: {plantings.length} (currently planted)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCapacityDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateCapacity} className="bg-emerald-600 hover:bg-emerald-700">
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}