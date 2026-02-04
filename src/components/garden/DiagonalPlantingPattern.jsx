import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Diagonal/Offset Planting Pattern Component
 * 50% offset every other row for intensive planting
 */
export default function DiagonalPlantingPattern({ 
  rows, 
  columns, 
  plantings = [], 
  cellSize = 28,
  onCellClick,
  selectedCells = [],
  readOnly = false,
  selectedPlanting,
  onSelectPlanting,
  onMove,
  onDelete
}) {
  // Calculate position for diagonal pattern
  const getCellPosition = (rowIdx, colIdx) => {
    const isOddRow = rowIdx % 2 === 1;
    const xOffset = isOddRow ? cellSize / 2 : 0;
    
    return {
      x: colIdx * cellSize + xOffset,
      y: rowIdx * cellSize
    };
  };

  // Check if a cell is planted
  const getCellPlant = (rowIdx, colIdx) => {
    return plantings.find(p => 
      (p.cell_row ?? p.cell_y) === rowIdx && 
      (p.cell_col ?? p.cell_x) === colIdx
    );
  };

  // Check if a cell is selected
  const isCellSelected = (rowIdx, colIdx) => {
    return selectedCells.some(c => c.row === rowIdx && c.col === colIdx);
  };

  return (
    <div className="relative bg-amber-50 border-2 border-amber-300 rounded-lg p-4 overflow-auto">
      <div className="relative" style={{ 
        width: (columns + 0.5) * cellSize, 
        height: rows * cellSize,
        minWidth: '100%'
      }}>
        {Array.from({ length: rows }).map((_, rowIdx) => 
          Array.from({ length: columns }).map((_, colIdx) => {
            // Skip last column on odd rows (extends beyond boundary)
            const isOddRow = rowIdx % 2 === 1;
            if (isOddRow && colIdx === columns - 1) {
              return null;
            }

            const pos = getCellPosition(rowIdx, colIdx);
            const plant = getCellPlant(rowIdx, colIdx);
            const isSelected = isCellSelected(rowIdx, colIdx);

            return (
              <button
                key={`${rowIdx}-${colIdx}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (plant && onSelectPlanting) {
                    onSelectPlanting(plant);
                  } else if (!readOnly && !plant) {
                    onCellClick?.(colIdx, rowIdx);
                  }
                }}
                disabled={readOnly && !plant}
                className={cn(
                  "absolute rounded border-2 flex items-center justify-center text-xs font-bold transition-all",
                  plant 
                    ? "bg-emerald-500 border-emerald-600 text-white cursor-pointer hover:bg-emerald-600" 
                    : "bg-white border-amber-400 hover:bg-emerald-50",
                  isSelected && "ring-2 ring-blue-500 scale-105",
                  selectedPlanting?.id === plant?.id && "ring-4 ring-blue-400",
                  (plant || !readOnly) && "cursor-pointer"
                )}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: cellSize,
                  height: cellSize
                }}
                title={plant ? (plant.display_name || 'Plant') : `Row ${rowIdx + 1}, Col ${colIdx + 1}`}
              >
                {plant ? (
                  <>
                    <span>{plant.plant_type_icon || '🌱'}</span>
                    {selectedPlanting?.id === plant.id && onDelete && onMove && (
                      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-1 z-50 bg-white rounded-lg shadow-lg p-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMove(plant);
                          }}
                          className="h-7"
                        >
                          Move
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(plant);
                          }}
                          className="h-7"
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </>
                ) : ''}
              </button>
            );
          })
        )}
      </div>
      
      {/* Pattern Info */}
      <div className="mt-3 text-xs text-gray-600 italic">
        ℹ️ Diagonal pattern: odd rows offset by 50% for intensive planting
      </div>
    </div>
  );
}