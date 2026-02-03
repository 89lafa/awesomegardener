import { useRef, useCallback } from 'react';

const useLongPress = (callback, { threshold = 500, onStart = () => {}, onEnd = () => {}, onClick = () => {} } = {}) => {
  const timeout = useRef();
  const isLongPress = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const start = useCallback(
    (event) => {
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;
      
      startPos.current = { x: clientX, y: clientY };
      onStart(event);
      isLongPress.current = false;
      
      timeout.current = setTimeout(() => {
        callback(event);
        isLongPress.current = true;
      }, threshold);
    },
    [callback, threshold, onStart]
  );

  const clear = useCallback(
    (event, shouldTriggerClick = true) => {
      clearTimeout(timeout.current);
      onEnd(event);
      
      if (!isLongPress.current && shouldTriggerClick) {
        // Check if finger moved (ignore if dragged)
        const clientX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
        const clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;
        
        const dx = clientX - startPos.current.x;
        const dy = clientY - startPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 10) { // Only trigger click if not dragged
          onClick(event);
        }
      }
      isLongPress.current = false;
    },
    [onClick, onEnd]
  );

  const cancel = useCallback(() => {
    clearTimeout(timeout.current);
    isLongPress.current = false;
  }, []);

  return { 
    onMouseDown: start,
    onTouchStart: start,
    onMouseUp: clear,
    onMouseLeave: () => cancel(),
    onTouchEnd: clear,
    onTouchCancel: () => cancel(),
  };
};

export default useLongPress;