import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export default function TrayGrid({ 
  tray, 
  cells, 
  selectedCells, 
  onCellClick, 
  loading 
}) {
  const cellsByPosition = {};
  cells.forEach(cell => {
    const key = `${cell.row}-${cell.col}`;
    cellsByPosition[key] = cell;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'seeded': return 'bg-yellow-100 border-yellow-400';
      case 'germinated': return 'bg-green-100 border-green-500';
      case 'growing': return 'bg-emerald-500 border-emerald-600 text-white';
      case 'failed': return 'bg-red-100 border-red-400';
      case 'empty': return 'bg-gray-50 border-gray-300 hover:bg-emerald-50';
      default: return 'bg-gray-50 border-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'seeded': return '🌱';
      case 'germinated': return '🌿';
      case 'growing': return '✓';
      case 'failed': return '❌';
      default: return '';
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
    <div className="bg-white rounded-lg border p-4">
      <div className="inline-grid gap-1 bg-amber-50 p-4 rounded-lg" 
           style={{ gridTemplateColumns: `repeat(${tray.cells_cols}, 40px)` }}>
        {Array.from({ length: tray.total_cells }).map((_, idx) => {
          const row = Math.floor(idx / tray.cells_cols);
          const col = (idx % tray.cells_cols);
          const key = `${row}-${col}`;
          const cell = cellsByPosition[key];
          const isSelected = selectedCells.some(c => c?.id === cell?.id);
          const cellNumber = idx + 1;

          return (
            <button
              key={key}
              onClick={() => cell && onCellClick(cell)}
              className={cn(
                'w-10 h-10 rounded border-2 flex flex-col items-center justify-center text-xs font-bold cursor-pointer relative',
                'transition-all duration-200',
                cell 
                  ? getStatusColor(cell.status)
                  : 'bg-gray-200 border-gray-400 opacity-50 cursor-not-allowed',
                isSelected && 'ring-2 ring-blue-500 scale-105'
              )}
              title={cell ? `#${cellNumber} - ${cell.variety_name && cell.plant_type_name ? `${cell.variety_name} - ${cell.plant_type_name}` : cell.variety_name || 'Empty'} - ${cell.status}` : `Cell ${cellNumber} - Missing`}
              disabled={!cell}
            >
              <span className="text-[8px] text-gray-500 absolute top-0.5 left-1">{cellNumber}</span>
              {cell && <span className="mt-1">{getStatusIcon(cell.status)}</span>}
              {!cell && <span className="text-red-500">?</span>}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-50 border-2 border-gray-300 rounded" />
          <span>Empty</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-yellow-100 border-2 border-yellow-400 rounded flex items-center justify-center">🌱</div>
          <span>Seeded</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-green-100 border-2 border-green-500 rounded flex items-center justify-center">🌿</div>
          <span>Germinated</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-500 border-2 border-emerald-600 rounded flex items-center justify-center text-white text-xs">✓</div>
          <span>Growing</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-red-100 border-2 border-red-400 rounded flex items-center justify-center">❌</div>
          <span>Failed</span>
        </div>
      </div>
    </div>
  );
}