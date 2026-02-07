import React from 'react';
import { cn } from '@/lib/utils';

const PlotItem = React.memo(({ 
  item, 
  itemType, 
  status, 
  counts, 
  isGrowBagOrContainer, 
  isFull, 
  selectedItem, 
  isDragging, 
  draggingItem, 
  zoom, 
  isMobile, 
  getItemColor,
  onDoubleClick 
}) => {
  return (
    <div
      onDoubleClick={isMobile ? onDoubleClick : undefined}
      className={cn(
        "absolute border-4 rounded-lg flex items-center justify-center text-sm font-medium overflow-hidden plot-item group",
        selectedItem?.id === item.id && "ring-4 ring-emerald-300",
        !status && "border-gray-400",
        status?.status === 'empty' && "border-gray-400",
        status?.status === 'partial' && "border-amber-500 bg-amber-500/5",
        status?.status === 'full' && "border-emerald-600 bg-emerald-500/5",
        isGrowBagOrContainer && isFull && "!bg-emerald-600"
      )}
      style={{
        left: item.x * zoom,
        top: item.y * zoom,
        width: item.width * zoom,
        height: item.height * zoom,
        backgroundColor: isGrowBagOrContainer && isFull ? '#10b981' : getItemColor(item),
        cursor: isDragging && draggingItem?.id === item.id ? 'grabbing' : 'grab'
      }}
    >
      {/* Enhanced status overlay */}
      {status && status.status === 'partial' && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'repeating-linear-gradient(45deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.15) 12px, transparent 12px, transparent 24px)'
          }}
        />
      )}
      {status && status.status === 'full' && (
        <div className="absolute inset-0 bg-emerald-600/15 pointer-events-none" />
      )}

      {/* Status badge - top left corner */}
      {status && status.status !== 'empty' && (
        <div className={cn(
          "absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm pointer-events-none",
          status.status === 'partial' && "bg-amber-500 text-white",
          status.status === 'full' && "bg-emerald-600 text-white"
        )}>
          {status.label}
        </div>
      )}
      
      {/* Badge with pointer-events: none */}
      {counts && counts.capacity > 0 && (
        <div className="absolute top-1 right-1 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-sm pointer-events-none">
          {counts.filled}/{counts.capacity}
        </div>
      )}
      {/* Row lines for row-based items */}
      {item.metadata?.rowCount && (
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
          {Array.from({ length: item.metadata.rowCount - 1 }).map((_, i) => (
            <line
              key={i}
              x1={0}
              y1={((i + 1) / item.metadata.rowCount) * 100 + '%'}
              x2="100%"
              y2={((i + 1) / item.metadata.rowCount) * 100 + '%'}
              stroke="white"
              strokeWidth="1"
              opacity="0.3"
            />
          ))}
        </svg>
      )}
      {/* Rotated container */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          transform: `rotate(${item.rotation}deg)`,
          transformOrigin: 'center'
        }}
      >
        {/* Label counter-rotated to stay horizontal */}
        <span 
          className="text-white text-shadow font-semibold plot-item-label"
          style={{
            transform: `rotate(${-item.rotation}deg)`,
            display: 'inline-block'
          }}
        >
          {item.label}
        </span>
      </div>
    </div>
  );
});

PlotItem.displayName = 'PlotItem';

export default PlotItem;