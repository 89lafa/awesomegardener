import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function BedGrid({ 
  bed, 
  plantInstances = [], 
  companionRules = [],
  onCellClick, 
  selectedCell,
  paintMode = false,
  paintPlant = null 
}) {
  const [hoveredCell, setHoveredCell] = useState(null);

  const getPlantAtCell = (row, col) => {
    return plantInstances.find(p => p.cell_row === row && p.cell_col === col);
  };

  const getCompanionStatus = (row, col, plant) => {
    if (!plant || !companionRules.length) return null;
    
    // Check adjacent cells
    const adjacentPlants = [];
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        if (r === row && c === col) continue;
        const adjacent = getPlantAtCell(r, c);
        if (adjacent && adjacent.plant_type_id !== plant.plant_type_id) {
          adjacentPlants.push(adjacent);
        }
      }
    }

    for (const adj of adjacentPlants) {
      const rule = companionRules.find(r => 
        (r.plant_type_a_id === plant.plant_type_id && r.plant_type_b_id === adj.plant_type_id) ||
        (r.plant_type_b_id === plant.plant_type_id && r.plant_type_a_id === adj.plant_type_id)
      );
      if (rule?.relationship === 'bad') return 'bad';
      if (rule?.relationship === 'good') return 'good';
    }
    return null;
  };

  const getCellColor = (plant) => {
    if (!plant) return 'bg-amber-50';
    // Use a hash of the plant type to generate consistent colors
    const colors = [
      'bg-red-100 border-red-300',
      'bg-green-100 border-green-300',
      'bg-blue-100 border-blue-300',
      'bg-yellow-100 border-yellow-300',
      'bg-purple-100 border-purple-300',
      'bg-pink-100 border-pink-300',
      'bg-orange-100 border-orange-300',
      'bg-teal-100 border-teal-300',
    ];
    const hash = plant.plant_type_id?.split('').reduce((a, b) => a + b.charCodeAt(0), 0) || 0;
    return colors[hash % colors.length];
  };

  const handleCellClick = (row, col) => {
    if (onCellClick) {
      onCellClick(row, col, getPlantAtCell(row, col));
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div 
        className="inline-grid gap-0.5 p-1 bg-amber-200/50 rounded-lg"
        style={{
          gridTemplateColumns: `repeat(${bed.grid_columns}, minmax(0, 1fr))`
        }}
      >
        {Array(bed.grid_rows).fill(0).map((_, row) => (
          Array(bed.grid_columns).fill(0).map((_, col) => {
            const plant = getPlantAtCell(row, col);
            const isSelected = selectedCell?.row === row && selectedCell?.col === col;
            const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;
            const companionStatus = plant ? getCompanionStatus(row, col, plant) : null;

            return (
              <Tooltip key={`${row}-${col}`}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleCellClick(row, col)}
                    onMouseEnter={() => setHoveredCell({ row, col })}
                    onMouseLeave={() => setHoveredCell(null)}
                    className={cn(
                      "w-10 h-10 lg:w-12 lg:h-12 rounded-md border-2 transition-all relative",
                      plant ? getCellColor(plant) : 'bg-amber-50 border-amber-100',
                      isSelected && 'ring-2 ring-emerald-500 ring-offset-1',
                      isHovered && !isSelected && 'ring-2 ring-gray-300',
                      paintMode && 'cursor-crosshair',
                      companionStatus === 'bad' && 'ring-4 ring-red-600',
                      companionStatus === 'good' && 'ring-4 ring-blue-500'
                    )}
                  >
                    {plant && (
                      <span className="text-xs font-medium truncate block p-0.5">
                        {plant.display_name?.split(' ')[0]?.slice(0, 3)}
                      </span>
                    )}
                    {companionStatus === 'bad' && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
                    )}
                    {companionStatus === 'good' && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
                    )}
                  </button>
                </TooltipTrigger>
                {plant && (
                  <TooltipContent>
                    <div className="text-sm">
                      <p className="font-medium">{plant.display_name}</p>
                      <p className="text-gray-500">Status: {plant.status}</p>
                      {companionStatus === 'bad' && (
                        <p className="text-red-600">⚠️ Bad companion nearby</p>
                      )}
                      {companionStatus === 'good' && (
                        <p className="text-green-600">✓ Good companions nearby</p>
                      )}
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })
        ))}
      </div>
    </TooltipProvider>
  );
}