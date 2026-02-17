import React, { useRef, useCallback } from 'react';
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
  onTap,
  onLongPress,
  onDragStart,   // NEW: mobile drag initiation callback
  onDoubleClick
}) => {
  // ─── Mobile long-press + drag detection ───
  const longPressTimer = useRef(null);
  const pressStartPos = useRef({ x: 0, y: 0 });
  const didLongPress = useRef(false);
  const didMove = useRef(false);
  const dragStarted = useRef(false);

  const handlePointerDown = useCallback((e) => {
    if (!isMobile) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    pressStartPos.current = { x: clientX, y: clientY };
    didLongPress.current = false;
    didMove.current = false;
    dragStarted.current = false;

    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      if (onLongPress) onLongPress(item);
    }, 500);
  }, [isMobile, item, onLongPress]);

  const handlePointerMove = useCallback((e) => {
    if (!isMobile) return;
    
    // Already handed off to drag system — nothing more to do here
    if (dragStarted.current) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - pressStartPos.current.x;
    const dy = clientY - pressStartPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 10) {
      // Cancel long-press
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      didMove.current = true;
      
      // *** FIX: Initiate drag instead of doing nothing ***
      if (!didLongPress.current && onDragStart) {
        dragStarted.current = true;
        onDragStart(item, e);
      }
    }
  }, [isMobile, item, onDragStart]);

  const handlePointerUp = useCallback((e) => {
    if (!isMobile) return;
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;

    // If it was a long press or a drag, don't fire tap
    if (didLongPress.current || didMove.current) return;

    // Short tap → select
    if (onTap) {
      e.stopPropagation();
      onTap(item);
    }
  }, [isMobile, item, onTap]);

  const handlePointerCancel = useCallback(() => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    dragStarted.current = false;
  }, []);

  // Minimum touch target size on mobile (44px per Apple HIG)
  const minTouchSize = isMobile ? 44 : 0;
  const renderedW = item.width * zoom;
  const renderedH = item.height * zoom;
  const needsExpander = isMobile && (renderedW < minTouchSize || renderedH < minTouchSize);

  return (
    <div
      // Desktop: double-click for context menu
      onDoubleClick={!isMobile ? onDoubleClick : undefined}
      // Mobile: custom pointer handlers for tap + long-press + drag
      onTouchStart={isMobile ? handlePointerDown : undefined}
      onTouchMove={isMobile ? handlePointerMove : undefined}
      onTouchEnd={isMobile ? handlePointerUp : undefined}
      onTouchCancel={isMobile ? handlePointerCancel : undefined}
      className={cn(
        "absolute border-4 rounded-lg flex items-center justify-center text-sm font-medium overflow-hidden plot-item group",
        selectedItem?.id === item.id && "ring-4 ring-emerald-300 z-10",
        !status && "border-gray-400",
        status?.status === 'empty' && "border-gray-400",
        status?.status === 'partial' && "border-amber-500 bg-amber-500/5",
        status?.status === 'full' && "border-emerald-600 bg-emerald-500/5",
        isGrowBagOrContainer && isFull && "!bg-emerald-600"
      )}
      style={{
        left: item.x * zoom,
        top: item.y * zoom,
        width: Math.max(renderedW, needsExpander ? minTouchSize : 0),
        height: Math.max(renderedH, needsExpander ? minTouchSize : 0),
        backgroundColor: isGrowBagOrContainer && isFull ? '#10b981' : getItemColor(item),
        cursor: isDragging && draggingItem?.id === item.id ? 'grabbing' : 'grab',
        zIndex: selectedItem?.id === item.id ? 5 : 1
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
          "absolute top-1 left-1 px-1.5 py-0.5 rounded-full font-bold shadow-sm pointer-events-none",
          isMobile ? "text-[8px]" : "text-[10px]",
          status.status === 'partial' && "bg-amber-500 text-white",
          status.status === 'full' && "bg-emerald-600 text-white"
        )}>
          {status.label}
        </div>
      )}
      
      {/* Capacity badge - top right */}
      {counts && counts.capacity > 0 && (
        <div className={cn(
          "absolute top-1 right-1 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full font-bold border shadow-sm pointer-events-none",
          isMobile ? "text-[8px]" : "text-[10px]"
        )}>
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

      {/* Rotated label container */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          transform: `rotate(${item.rotation}deg)`,
          transformOrigin: 'center'
        }}
      >
        <span 
          className={cn(
            "text-white text-shadow font-semibold plot-item-label text-center leading-tight",
            isMobile && renderedW < 60 && "text-[9px]",
            isMobile && renderedW >= 60 && renderedW < 100 && "text-[11px]"
          )}
          style={{
            transform: `rotate(${-item.rotation}deg)`,
            display: 'inline-block',
            maxWidth: '90%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
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
