import React from 'react';
import { Info } from 'lucide-react';

export function DiagonalPlantingPattern({ pattern, gridRows, gridCols, cellSize = 40 }) {
  const getCellPosition = (row, col) => {
    let x = col * cellSize;
    let y = row * cellSize;
    
    if (pattern === 'diagonal' && row % 2 === 1) {
      x += cellSize / 2;
    }
    
    return { x, y };
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          {pattern === 'diagonal' && (
            <>
              <p className="font-medium text-blue-900">Diagonal Pattern (50% Offset)</p>
              <p className="text-blue-700 mt-1">Odd rows offset by 50% for intensive planting (~15% more capacity)</p>
            </>
          )}
          {pattern === 'square_foot' && (
            <>
              <p className="font-medium text-blue-900">Square Foot Grid</p>
              <p className="text-blue-700 mt-1">Traditional grid layout with uniform spacing</p>
            </>
          )}
          {pattern === 'rows' && (
            <>
              <p className="font-medium text-blue-900">Traditional Rows</p>
              <p className="text-blue-700 mt-1">Plants arranged in straight rows</p>
            </>
          )}
        </div>
      </div>

      {/* Grid visualization */}
      <div className="border rounded-lg p-4 bg-gray-50 overflow-auto">
        <svg
          width={Math.max(400, gridCols * cellSize + 20)}
          height={Math.max(300, gridRows * cellSize + 20)}
          className="mx-auto"
        >
          {/* Grid lines */}
          {Array.from({ length: gridRows }).map((_, row) =>
            Array.from({ length: gridCols }).map((_, col) => {
              // Skip last column in odd rows for diagonal
              if (pattern === 'diagonal' && row % 2 === 1 && col === gridCols - 1) {
                return null;
              }

              const { x, y } = getCellPosition(row, col);
              return (
                <rect
                  key={`${row}-${col}`}
                  x={x + 10}
                  y={y + 10}
                  width={cellSize}
                  height={cellSize}
                  fill="white"
                  stroke="#ccc"
                  strokeWidth="1"
                />
              );
            })
          )}

          {/* Sample plants */}
          {Array.from({ length: Math.min(3, gridRows) }).map((_, row) =>
            Array.from({ length: Math.min(3, gridCols) }).map((_, col) => {
              if (pattern === 'diagonal' && row % 2 === 1 && col === gridCols - 1) {
                return null;
              }

              const { x, y } = getCellPosition(row, col);
              return (
                <circle
                  key={`plant-${row}-${col}`}
                  cx={x + 10 + cellSize / 2}
                  cy={y + 10 + cellSize / 2}
                  r="8"
                  fill="#10b981"
                  opacity="0.7"
                />
              );
            })
          )}
        </svg>
      </div>
    </div>
  );
}