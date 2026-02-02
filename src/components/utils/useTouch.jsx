import { useState, useRef, useCallback } from 'react';

/**
 * Hook for handling swipe gestures
 */
export function useSwipe({ 
  onSwipeLeft, 
  onSwipeRight, 
  onSwipeUp, 
  onSwipeDown,
  threshold = 50 
}) {
  const touchStart = useRef({ x: 0, y: 0 });
  const touchEnd = useRef({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  }, []);

  const handleTouchMove = useCallback((e) => {
    touchEnd.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  }, []);

  const handleTouchEnd = useCallback(() => {
    const deltaX = touchStart.current.x - touchEnd.current.x;
    const deltaY = touchStart.current.y - touchEnd.current.y;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
      }
    } else {
      // Vertical swipe
      if (Math.abs(deltaY) > threshold) {
        if (deltaY > 0) {
          onSwipeUp?.();
        } else {
          onSwipeDown?.();
        }
      }
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
}

/**
 * Hook for handling long press
 */
export function useLongPress(callback, delay = 500) {
  const timeout = useRef(null);
  const target = useRef(null);

  const start = useCallback((e) => {
    target.current = e.target;
    timeout.current = setTimeout(() => {
      callback?.(e);
    }, delay);
  }, [callback, delay]);

  const clear = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
      timeout.current = null;
    }
  }, []);

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
  };
}

/**
 * Hook for pinch-to-zoom
 */
export function usePinchZoom({ 
  minScale = 0.5, 
  maxScale = 3, 
  initialScale = 1 
}) {
  const [scale, setScale] = useState(initialScale);
  const initialDistance = useRef(null);
  const initialScaleRef = useRef(scale);

  const getDistance = (touches) => {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  };

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      initialDistance.current = getDistance(e.touches);
      initialScaleRef.current = scale;
    }
  }, [scale]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && initialDistance.current) {
      const currentDistance = getDistance(e.touches);
      const delta = currentDistance / initialDistance.current;
      const newScale = Math.min(maxScale, Math.max(minScale, initialScaleRef.current * delta));
      setScale(newScale);
    }
  }, [minScale, maxScale]);

  const handleTouchEnd = useCallback(() => {
    initialDistance.current = null;
  }, []);

  const resetZoom = useCallback(() => {
    setScale(initialScale);
  }, [initialScale]);

  return {
    scale,
    setScale,
    resetZoom,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    }
  };
}

/**
 * Hook for touch-friendly drag and drop
 */
export function useTouchDrag({ onDragStart, onDrag, onDragEnd }) {
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e) => {
    isDragging.current = true;
    startPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    onDragStart?.({ x: startPos.current.x, y: startPos.current.y });
  }, [onDragStart]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current) return;
    
    const currentPos = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    
    const delta = {
      x: currentPos.x - startPos.current.x,
      y: currentPos.y - startPos.current.y
    };

    onDrag?.({ position: currentPos, delta });
  }, [onDrag]);

  const handleTouchEnd = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      onDragEnd?.();
    }
  }, [onDragEnd]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}