import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function PlantingViewContainer({ item, garden, onClose, onUpdate }) {
  const [planting, setPlanting] = useState(null);
  const [plantTypes, setPlantTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlantDialog, setShowPlantDialog] = useState(false);
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
      setPlanting(plantingsData?.[0] || null);
      setPlantTypes(typesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load planting data');
      setPlanting(null);
      setPlantTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlant = async () => {
    if (!newPlanting.plant_type_id) return;

    const plantType = plantTypes.find(pt => pt.id === newPlanting.plant_type_id);

    try {
      const plantingData = await base44.entities.Planting.create({
        garden_id: garden.id,
        item_id: item.id,
        plant_type_id: newPlanting.plant_type_id,
        plant_type_name: plantType.common_name,
        planting_method: newPlanting.planting_method,
        date_planted: newPlanting.date_planted,
        quantity: 1,
        notes: newPlanting.notes,
        status: 'PLANTED',
        location_type: 'CONTAINER',
        location_ref: { slot: 1 }
      });

      setPlanting(plantingData);
      setShowPlantDialog(false);
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

  const handleRemove = async () => {
    if (!planting || !confirm('Remove this plant?')) return;
    try {
      await base44.entities.Planting.delete(planting.id);
      setPlanting(null);
      toast.success('Plant removed');
      onUpdate?.();
    } catch (error) {
      console.error('Error removing:', error);
    }
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
            {item.item_type === 'GROW_BAG' ? 'Grow Bag' : 'Container'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 p-4">
        {planting ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{planting.plant_type_name}</h3>
                  <p className="text-sm text-gray-500">Planted: {planting.date_planted}</p>
                  {planting.notes && (
                    <p className="text-sm text-gray-600 mt-2">{planting.notes}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🪴</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Empty</h3>
            <p className="text-sm text-gray-500 mb-4">No plant in this container yet</p>
            <Button onClick={() => setShowPlantDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
              Plant Here
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showPlantDialog} onOpenChange={setShowPlantDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plant in {item.label}</DialogTitle>
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
    </div>
  );
}