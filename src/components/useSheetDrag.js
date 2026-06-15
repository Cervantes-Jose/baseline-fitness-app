import { useState, useRef, useEffect, useCallback } from 'react';

// Swipe-to-dismiss behavior shared by the app's full-height bottom sheets.
//
// Two ways to dismiss, both feeding one `dragY`:
//   1. Drag the grab handle / header — spread `handleProps` on it. Always drags
//      from the first downward pixel (it's not scrollable).
//   2. Swipe down anywhere over the scrollable body — put `ref={scrollRef}` on it.
//      The body scrolls normally; only once it's at the very top does a further
//      downward swipe hand off into dragging the sheet. Swiping back up before
//      release returns control to scrolling.
//
// The body uses native touch listeners (attached non-passive so the drag can
// preventDefault and take over from the browser's scroll). Desktop users drag
// via the handle; "swipe from anywhere" is a touch gesture.
export default function useSheetDrag({ onDismiss, threshold = 110 }) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const scrollRef = useRef(null);

  const startY = useRef(null);   // gesture start clientY
  const active = useRef(false);  // true = dragging the sheet (vs. scrolling)
  const dragYRef = useRef(0);

  const setDrag = (v) => { dragYRef.current = v; setDragY(v); };

  const end = useCallback(() => {
    if (active.current) {
      if (dragYRef.current > threshold) onDismiss();
      // Always reset the offset: on dismiss the sheet's own `open` flag hides it
      // (and this prevents a stale offset when it's reopened); on a short pull it
      // just snaps back to rest.
      setDrag(0);
    }
    startY.current = null;
    active.current = false;
    setDragging(false);
  }, [onDismiss, threshold]);

  // Handle/header: a plain downward pointer drag, active from the first pixel.
  // Capture the pointer so a fast drag that slides off the small handle keeps
  // tracking.
  const handleProps = {
    onPointerDown: (e) => {
      startY.current = e.clientY; active.current = true; setDragging(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e) => {
      if (!active.current || startY.current == null) return;
      setDrag(Math.max(0, e.clientY - startY.current));
    },
    onPointerUp: end,
    onPointerCancel: end,
  };

  // Body: scroll first, then drag once at the top.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = (e) => { startY.current = e.touches[0].clientY; active.current = false; };

    const onTouchMove = (e) => {
      if (startY.current == null) return;
      const y = e.touches[0].clientY;
      if (!active.current) {
        // Take over only when pulling down AND the body is already at the top.
        if (y - startY.current > 0 && el.scrollTop <= 0) {
          active.current = true;
          setDragging(true);
          startY.current = y;   // rebase so the sheet doesn't jump
        } else {
          return;               // let the body scroll natively
        }
      }
      const d = y - startY.current;
      if (d > 0) {
        e.preventDefault();     // stop native scroll/overscroll while dragging
        setDrag(d);
      } else {
        // Pulled back above the takeover point — return control to scrolling.
        active.current = false;
        setDragging(false);
        setDrag(0);
        startY.current = y;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [end]);

  return { dragY, dragging, scrollRef, handleProps };
}
