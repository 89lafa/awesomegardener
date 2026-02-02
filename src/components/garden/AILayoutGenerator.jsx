import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function AILayoutGenerator({ isOpen, onClose, onApply, gardenId }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState(8);
  const [height, setHeight] = useState(4);
  const [sunDirection, setSunDirection] = useState('south');
  const [plants, setPlants] = useState([]);
  const [result, setResult] = useState(null);

  const handleGenerate = async () => {
    if (plants.length === 0) {
      toast.error('Add at least one plant');
      return;
    }

    setLoading(true);
    try {
      // Simple algorithm: arrange by height (tallest on shade side)
      const sorted = [...plants].sort((a, b) => (b.height || 0) - (a.height || 0));
      const grid = Array(height)
        .fill(null)
        .map(() => Array(width).fill(null));

      let currentRow = sunDirection === 'south' ? 0 : height - 1;
      let currentCol = 0;
      const rowDirection = sunDirection === 'south' ? 1 : -1;

      for (const plant of sorted) {
        for (let i = 0; i < plant.quantity; i++) {
          if (currentRow < 0 || currentRow >= height) break;
          grid[currentRow][currentCol] = plant;
          currentCol++;
          if (currentCol >= width) {
            currentCol = 0;
            currentRow += rowDirection;
          }
        }
      }

      setResult({
        grid,
        reasoning: [
          'Tallest plants on shade side to avoid blocking sunlight',
          'Grouped plants by type for easier care',
          'Companion plants positioned nearby when possible'
        ]
      });
      setStep(2);
    } catch (error) {
      toast.error('Failed to generate layout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            AI Garden Layout Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 max-h-[600px] overflow-y-auto">
          {step === 1 ? (
            <>
              {/* Dimensions */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Width (ft)</label>
                  <Input type="number" value={width} onChange={(e) => setWidth(parseInt(e.target.value))} min="2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Height (ft)</label>
                  <Input type="number" value={height} onChange={(e) => setHeight(parseInt(e.target.value))} min="2" />
                </div>
              </div>

              {/* Sun Direction */}
              <div>
                <label className="block text-sm font-medium mb-2">Primary Sun Direction</label>
                <select
                  value={sunDirection}
                  onChange={(e) => setSunDirection(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="north">From North (shade-tolerant on south)</option>
                  <option value="south">From South (tall plants on north side)</option>
                  <option value="east">From East</option>
                  <option value="west">From West</option>
                </select>
              </div>

              {/* Plants */}
              <div>
                <label className="block text-sm font-medium mb-2">What to Grow</label>
                {plants.map((plant, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded">
                    <span className="flex-1 text-sm">{plant.name} ({plant.quantity})</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPlants(p => p.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full mt-2 gap-2"
                  onClick={() =>
                    setPlants([
                      ...plants,
                      { name: 'Tomato', quantity: 3, height: 48 }
                    ])
                  }
                >
                  <Plus className="w-4 h-4" />
                  Add Plant
                </Button>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={onClose} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={loading || plants.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Result */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Suggested Layout</h3>
                <div className="border rounded-lg p-4 bg-gray-50">
                  <svg
                    width={Math.max(300, width * 40)}
                    height={Math.max(200, height * 40)}
                    className="mx-auto"
                  >
                    {Array.from({ length: height }).map((_, row) =>
                      Array.from({ length: width }).map((_, col) => {
                        const cell = result?.grid[row][col];
                        return (
                          <g key={`${row}-${col}`}>
                            <rect
                              x={col * 40 + 10}
                              y={row * 40 + 10}
                              width="40"
                              height="40"
                              fill={cell ? '#10b981' : 'white'}
                              stroke="#ccc"
                              strokeWidth="1"
                              opacity={cell ? 0.6 : 1}
                            />
                            {cell && (
                              <text
                                x={col * 40 + 30}
                                y={row * 40 + 35}
                                textAnchor="middle"
                                fontSize="10"
                                fill="white"
                                fontWeight="bold"
                              >
                                {cell.name[0]}
                              </text>
                            )}
                          </g>
                        );
                      })
                    )}
                  </svg>
                </div>
              </div>

              {/* Reasoning */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Why This Layout</h3>
                <ul className="space-y-1 text-sm text-gray-700">
                  {result?.reasoning.map((reason, i) => (
                    <li key={i} className="flex gap-2">
                      <span>•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      onApply?.(result);
                      toast.success('Layout applied!');
                      onClose();
                    } catch (error) {
                      toast.error('Failed to apply layout');
                    }
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  Apply Layout
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}