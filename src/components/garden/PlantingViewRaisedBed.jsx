import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function PlantingViewRaisedBed({ item, garden, onClose, onUpdate }) {
  const [plantings, setPlantings] = useState([]);
  const [plantTypes, setPlantTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlantDialog, setShowPlantDialog] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [newPlanting, setNewPlanting] = useState({
    plant_type_id: '',
    variety_id: '',
    planting_method: 'TRANSPLANT',
    date_planted: new Date().toISOString().split('T')[0],
    quantity: 1,
    notes: ''
  });

  const gridSize = item.metadata?.gridSize || 12;
  const cols = Math.floor(item.width / gridSize);
  const rows = Math.floor(item.height / gridSize);

  useEffect(() => {
    loadData();
  }, [item.id]);

  const loadData = async () => {
    try {
      const [plantingsData, typesData] = await Promise.all([
        base44.entities.Planting.filter({ item_id: item.id }),
        base44.entities.PlantType.list('common_name', 100)
      ]);
      setPlantings(plantingsData);
      setPlantTypes(typesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = (r, c) => {
    const existing = plantings.find(p => 
      p.location_type === 'GRID_CELL' && 
      p.location_ref?.r === r && 
      p.location_ref?.c === c
    );

    if (existing) {
      setSelectedCell({ r, c, planting: existing });
    } else {
      setSelectedCell({ r, c, planting: null });
      setShowPlantDialog(true);
    }
  };

  const handlePlant = async () => {
    if (!newPlanting.plant_type_id || !selectedCell) return;

    const plantType = plantTypes.find(pt => pt.id === newPlanting.plant_type_id);

    try {
      const planting = await base44.entities.Planting.create({
        garden_id: garden.id,
        item_id: item.id,
        plant_type_id: newPlanting.plant_type_id,
        plant_type_name: plantType.common_name,
        planting_method: newPlanting.planting_method,
        date_planted: newPlanting.date_planted,
        quantity: newPlanting.quantity,
        notes: newPlanting.notes,
        status: 'PLANTED',
        location_type: 'GRID_CELL',
        location_ref: { r: selectedCell.r, c: selectedCell.c }
      });

      setPlantings([...plantings, planting]);
      setShowPlantDialog(false);
      setSelectedCell(null);
      setNewPlanting({
        plant_type_id: '',
        variety_id: '',
        planting_method: 'TRANSPLANT',
        date_planted: new Date().toISOString().split('T')[0],
        quantity: 1,
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
      setSelectedCell(null);
      toast.success('Plant removed');
      onUpdate?.();
    } catch (error) {
      console.error('Error removing:', error);
    }
  };

  const getCellPlanting = (r, c) => {
    return plantings.find(p => 
      p.location_type === 'GRID_CELL' && 
      p.location_ref?.r === r && 
      p.location_ref?.c === c
    );
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
            {item.width}" × {item.height}" • {plantings.length} planted
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="inline-block border-2 border-gray-300 bg-white">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex">
              {Array.from({ length: cols }).map((_, c) => {
                const planting = getCellPlanting(r, c);
                return (
                  <button
                    key={c}
                    onClick={() => handleCellClick(r, c)}
                    className={cn(
                      "w-16 h-16 border border-gray-200 flex items-center justify-center text-xs font-medium transition-colors",
                      planting ? "bg-emerald-100 hover:bg-emerald-200" : "bg-white hover:bg-gray-50",
                      selectedCell?.r === r && selectedCell?.c === c && "ring-2 ring-emerald-500"
                    )}
                  >
                    {planting ? (
                      <div className="text-center">
                        <div className="truncate w-full px-1">{planting.plant_type_name}</div>
                      </div>
                    ) : (
                      <Plus className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selectedCell?.planting && (
        <Card className="m-4 mt-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{selectedCell.planting.plant_type_name}</h3>
                <p className="text-sm text-gray-500">
                  Cell ({selectedCell.r + 1}, {selectedCell.c + 1})
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Planted: {selectedCell.planting.date_planted}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemovePlanting(selectedCell.planting)}
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
            <DialogTitle>Plant in Cell ({selectedCell?.r + 1}, {selectedCell?.c + 1})</DialogTitle>
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
              <Label>Method</Label>
              <Select value={newPlanting.planting_method} onValueChange={(v) => setNewPlanting({ ...newPlanting, planting_method: v })}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIRECT">Direct Sow</SelectItem>
                  <SelectItem value="TRANSPLANT">Transplant</SelectItem>
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