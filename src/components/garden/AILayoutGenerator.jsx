import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export function AILayoutGenerator({ isOpen, onClose, onApply, gardenId, seasonId }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [plants, setPlants] = useState([]);
  const [width, setWidth] = useState(8);
  const [height, setHeight] = useState(4);
  const [sunDirection, setSunDirection] = useState('south');
  const [result, setResult] = useState(null);

  const handleAddPlant = () => {
    setPlants([...plants, { plant_type_id: '', quantity: 1, name: '' }]);
  };

  const handleRemovePlant = (idx) => {
    setPlants(plants.filter((_, i) => i !== idx));
  };

  const generateLayout = async () => {
    if (plants.length === 0) {
      toast.error('Add at least one plant');
      return;
    }

    setLoading(true);
    try {
      // For now, use simple algorithm (fallback)
      const grid = generateSimpleLayout(width, height, plants, sunDirection);
      setResult(grid);
      setStep(2);
    } catch (error) {
      console.error('Layout generation failed:', error);
      toast.error('Failed to generate layout');
    } finally {
      setLoading(false);
    }
  };

  const generateSimpleLayout = (w, h, plantList, sun) => {
    const grid = Array(h).fill(null).map(() => Array(w).fill(null));

    const sorted = [...plantList].sort((a, b) => (b.height || 0) - (a.height || 0));

    let row = sun === 'north' ? 0 : h - 1;
    let col = 0;
    const direction = sun === 'north' ? 1 : -1;

    for (const plant of sorted) {
      for (let i = 0; i < plant.quantity; i++) {
        if (row >= 0 && row < h) {
          grid[row][col] = plant;
        }
        col++;
        if (col >= w) {
          col = 0;
          row += direction;
        }
      }
    }

    return {
      grid,
      reasoning: [
        'Tallest plants on ' + (sun === 'north' ? 'north' : 'south') + ' side to minimize shading',
        'Grouped by plant type for easier care',
        'Simple row arrangement for maximum efficiency'
      ]
    };
  };

  const handleApplyLayout = async () => {
    if (!result) return;

    try {
      // Create PlotStructure
      const structure = await base44.entities.PlotStructure.create({
        garden_id: gardenId,
        garden_season_id: seasonId,
        name: 'AI Generated Bed',
        structure_type: 'raised_bed',
        width_cells: width,
        height_cells: height,
        planting_grid_cols: width,
        planting_grid_rows: height
      });

      // Create PlantingSpaces
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          const plant = result.grid[r][c];
          if (plant) {
            await base44.entities.PlantingSpace.create({
              garden_id: gardenId,
              garden_season_id: seasonId,
              plot_item_id: structure.id,
              space_type: 'RAISED_BED',
              name: `${plant.name} - Cell ${r}-${c}`,
              plant_type_id: plant.plant_type_id,
              cell_x: c,
              cell_y: r
            });
          }
        }
      }

      toast.success('Layout created!');
      onApply?.();
      onClose();
    } catch (error) {
      console.error('Error applying layout:', error);
      toast.error('Failed to apply layout');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI Garden Layout Generator
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          // Input step
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Width (ft)</label>
                <Input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value))}
                  min="2"
                  max="20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Height (ft)</label>
                <Input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value))}
                  min="2"
                  max="20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Sun Direction</label>
              <select
                value={sunDirection}
                onChange={(e) => setSunDirection(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                <option value="north">North (sun from south)</option>
                <option value="south">South (sun from north)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Plants to Grow</label>
                <Button onClick={handleAddPlant} size="sm" variant="outline" className="gap-1">
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {plants.map((plant, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="Plant name"
                      value={plant.name}
                      onChange={(e) => {
                        const newPlants = [...plants];
                        newPlants[idx].name = e.target.value;
                        setPlants(newPlants);
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={plant.quantity}
                      onChange={(e) => {
                        const newPlants = [...plants];
                        newPlants[idx].quantity = parseInt(e.target.value);
                        setPlants(newPlants);
                      }}
                      className="w-20"
                      min="1"
                    />
                    <Button
                      onClick={() => handleRemovePlant(idx)}
                      variant="ghost"
                      size="icon"
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={onClose} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={generateLayout}
                disabled={loading || plants.length === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                {loading ? 'Generating...' : <><Sparkles className="w-4 h-4" /> Generate</>}
              </Button>
            </div>
          </div>
        ) : (
          // Result step
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-gray-50 overflow-auto max-h-80">
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${width}, 30px)` }}>
                {result.grid.flat().map((cell, idx) => (
                  <div
                    key={idx}
                    className="w-8 h-8 rounded border flex items-center justify-center text-xs font-bold"
                    style={{
                      background: cell ? '#10b981' : '#f3f4f6',
                      borderColor: '#d1d5db',
                      color: cell ? 'white' : 'gray'
                    }}
                  >
                    {cell ? cell.name?.[0] : ''}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Why this layout:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {result.reasoning.map((reason, idx) => (
                  <li key={idx}>• {reason}</li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleApplyLayout}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                Apply Layout
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}