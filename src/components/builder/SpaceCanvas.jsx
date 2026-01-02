import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import BedGrid from './BedGrid';
import PlantPicker from './PlantPicker';
import { 
  Plus, 
  Move, 
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  RotateCw,
  Save,
  Undo,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BED_TYPES = [
  { value: 'raised_bed', label: 'Raised Bed', color: '#8B7355' },
  { value: 'plot', label: 'In-Ground Plot', color: '#6B8E23' },
  { value: 'greenhouse_bench', label: 'Greenhouse Bench', color: '#A0A0A0' },
  { value: 'grow_bag', label: 'Grow Bag Zone', color: '#D2691E' },
  { value: 'container', label: 'Container', color: '#708090' },
];

export default function SpaceCanvas({ 
  space, 
  gardenId,
  beds: initialBeds = [],
  plantInstances: initialPlants = [],
  companionRules = [],
  onUpdate 
}) {
  const [beds, setBeds] = useState(initialBeds);
  const [plants, setPlants] = useState(initialPlants);
  const [selectedBed, setSelectedBed] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [showAddBed, setShowAddBed] = useState(false);
  const [showPlantPicker, setShowPlantPicker] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [undoStack, setUndoStack] = useState([]);

  const [newBed, setNewBed] = useState({
    name: '',
    type: 'raised_bed',
    width: 48,
    height: 48
  });

  const canvasRef = useRef(null);

  useEffect(() => {
    setBeds(initialBeds);
    setPlants(initialPlants);
  }, [initialBeds, initialPlants]);

  const saveState = () => {
    setUndoStack(prev => [...prev.slice(-9), { beds, plants }]);
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const lastState = undoStack[undoStack.length - 1];
    setBeds(lastState.beds);
    setPlants(lastState.plants);
    setUndoStack(prev => prev.slice(0, -1));
    setHasChanges(true);
  };

  const handleAddBed = async () => {
    if (!newBed.name.trim()) return;
    
    saveState();
    const gridSize = space.grid_size || 12;
    const gridCols = Math.floor(newBed.width / gridSize);
    const gridRows = Math.floor(newBed.height / gridSize);

    try {
      const bed = await base44.entities.Bed.create({
        space_id: space.id,
        garden_id: gardenId,
        name: newBed.name,
        type: newBed.type,
        width: newBed.width,
        height: newBed.height,
        grid_columns: gridCols,
        grid_rows: gridRows,
        position_x: 50,
        position_y: 50,
        color: BED_TYPES.find(t => t.value === newBed.type)?.color
      });

      setBeds([...beds, bed]);
      setShowAddBed(false);
      setNewBed({ name: '', type: 'raised_bed', width: 48, height: 48 });
      toast.success('Bed added!');
    } catch (error) {
      console.error('Error adding bed:', error);
      toast.error('Failed to add bed');
    }
  };

  const handleDeleteBed = async (bed) => {
    if (!confirm(`Delete "${bed.name}"?`)) return;
    saveState();
    
    try {
      // Delete all plants in this bed
      const plantsInBed = plants.filter(p => p.bed_id === bed.id);
      for (const plant of plantsInBed) {
        await base44.entities.PlantInstance.delete(plant.id);
      }
      
      await base44.entities.Bed.delete(bed.id);
      setBeds(beds.filter(b => b.id !== bed.id));
      setPlants(plants.filter(p => p.bed_id !== bed.id));
      setSelectedBed(null);
      toast.success('Bed deleted');
    } catch (error) {
      console.error('Error deleting bed:', error);
      toast.error('Failed to delete bed');
    }
  };

  const handleCellClick = (bed, row, col, existingPlant) => {
    setSelectedBed(bed);
    setSelectedCell({ row, col, plant: existingPlant });
    
    if (!existingPlant) {
      setShowPlantPicker(true);
    }
  };

  const handlePlantSelect = async (plantData) => {
    if (!selectedBed || selectedCell === null) return;
    saveState();

    try {
      const plant = await base44.entities.PlantInstance.create({
        garden_id: gardenId,
        space_id: space.id,
        bed_id: selectedBed.id,
        cell_row: selectedCell.row,
        cell_col: selectedCell.col,
        ...plantData,
        status: 'planned'
      });

      setPlants([...plants, plant]);
      setHasChanges(true);
      toast.success('Plant placed!');

      // Auto-generate tasks if dates are set
      if (plantData.planned_plant_out_date) {
        await base44.entities.Task.create({
          garden_id: gardenId,
          plant_instance_id: plant.id,
          type: 'transplant',
          title: `Plant out ${plantData.display_name}`,
          due_date: plantData.planned_plant_out_date,
          status: 'open',
          auto_generated: true,
          rule_source: 'planting_window',
          plant_display_name: plantData.display_name
        });
      }
    } catch (error) {
      console.error('Error placing plant:', error);
      toast.error('Failed to place plant');
    }
  };

  const handleRemovePlant = async () => {
    if (!selectedCell?.plant) return;
    saveState();

    try {
      await base44.entities.PlantInstance.delete(selectedCell.plant.id);
      setPlants(plants.filter(p => p.id !== selectedCell.plant.id));
      setSelectedCell(null);
      setHasChanges(true);
      toast.success('Plant removed');
    } catch (error) {
      console.error('Error removing plant:', error);
      toast.error('Failed to remove plant');
    }
  };

  const getBedsForSpace = () => beds.filter(b => b.space_id === space.id);
  const getPlantsForBed = (bedId) => plants.filter(p => p.bed_id === bedId);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b bg-white">
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setShowAddBed(true)}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Bed
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={undo}
            disabled={undoStack.length === 0}
          >
            <Undo className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-600 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div 
        ref={canvasRef}
        className="flex-1 overflow-auto bg-gradient-to-br from-green-50 to-emerald-50 p-8"
      >
        <div 
          className="min-w-max"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        >
          {getBedsForSpace().length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Plus className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No beds yet</h3>
              <p className="text-gray-600 mb-4">Add your first bed to start planting</p>
              <Button 
                onClick={() => setShowAddBed(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Add Your First Bed
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-6">
              {getBedsForSpace().map((bed) => (
                <div 
                  key={bed.id}
                  className={cn(
                    "relative bg-white rounded-xl shadow-sm border-2 p-4 transition-all",
                    selectedBed?.id === bed.id ? 'border-emerald-500 shadow-lg' : 'border-gray-200'
                  )}
                >
                  {/* Bed Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{bed.name}</h3>
                      <p className="text-xs text-gray-500">
                        {bed.width}" × {bed.height}" • {bed.grid_columns}×{bed.grid_rows} grid
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteBed(bed)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Grid */}
                  <BedGrid
                    bed={bed}
                    plantInstances={getPlantsForBed(bed.id)}
                    companionRules={companionRules}
                    onCellClick={(row, col, plant) => handleCellClick(bed, row, col, plant)}
                    selectedCell={selectedBed?.id === bed.id ? selectedCell : null}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Plant Panel */}
      {selectedCell?.plant && (
        <div className="absolute bottom-4 right-4 bg-white rounded-xl shadow-xl border p-4 w-72">
          <h4 className="font-semibold mb-2">{selectedCell.plant.display_name}</h4>
          <p className="text-sm text-gray-600 mb-3">
            Status: <span className="capitalize">{selectedCell.plant.status}</span>
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => setSelectedCell(null)}
            >
              Close
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleRemovePlant}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Bed Dialog */}
      <Dialog open={showAddBed} onOpenChange={setShowAddBed}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Bed</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bedName">Bed Name</Label>
              <Input
                id="bedName"
                placeholder="e.g., Main Raised Bed"
                value={newBed.name}
                onChange={(e) => setNewBed({ ...newBed, name: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select 
                value={newBed.type} 
                onValueChange={(v) => setNewBed({ ...newBed, type: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BED_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="width">Width (inches)</Label>
                <Input
                  id="width"
                  type="number"
                  value={newBed.width}
                  onChange={(e) => setNewBed({ ...newBed, width: parseInt(e.target.value) || 0 })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="height">Length (inches)</Label>
                <Input
                  id="height"
                  type="number"
                  value={newBed.height}
                  onChange={(e) => setNewBed({ ...newBed, height: parseInt(e.target.value) || 0 })}
                  className="mt-2"
                />
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Grid: {Math.floor(newBed.width / 12)} × {Math.floor(newBed.height / 12)} cells (1 ft spacing)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBed(false)}>Cancel</Button>
            <Button 
              onClick={handleAddBed}
              disabled={!newBed.name.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Add Bed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plant Picker */}
      <PlantPicker
        open={showPlantPicker}
        onClose={() => setShowPlantPicker(false)}
        onSelect={handlePlantSelect}
        bed={selectedBed}
        cellRow={selectedCell?.row}
        cellCol={selectedCell?.col}
      />
    </div>
  );
}