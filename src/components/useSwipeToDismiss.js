import { useState, useRef, useEffect, useCallback } from 'react';

// Swipe-to-dismiss for bottom sheets.
//
// Rules:
//   - A downward swipe works anywhere on the sheet, but only once the scroll
//     content is at the very top (so the body scrolls normally otherwise).
//   - Dragging past `dismissThreshold` pixels and releasing dismisses it;
//     releasing before that snaps it back to fully open. A fixed distance (not
//     a fraction of height) keeps the feel consistent across short and
//     full-screen sheets — a fraction of a tall sheet demands an unnaturally
//     long drag.
//   - `dragY` tracks the live offset so the consumer can translateY the sheet
//     and the user sees it move; `dragging` is true while a drag is in progress
//     (so the consumer can drop its transition for 1:1 finger tracking).
//
// Usage:
//   const { dragY, dragging, sheetRef, scrollRef, onPointerDown } = useSwipeToDismiss({ onDismiss });
//   <div ref={sheetRef} onPointerDown={onPointerDown}
//        style={{ transform: `translateY(${dragY}px)`, transition: dragging ? 'none' : '<spring>' }}>
//     <div ref={scrollRef} style={{ overflowY: 'auto' }}>…</div>
//   </div>
//
// `scrollRef` is optional — omit it for a sheet with no scroll area and the
// swipe works unconditionally. Touch drives the mobile gesture (native
// listeners so it can preventDefault and take over from the browser's scroll);
// `onPointerDown` adds the equivalent mouse drag on desktop.
export default function useSwipeToDismiss({ onDismiss, dismissThreshold = 80 }) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const sheetRef = useRef(null);   // the sheet element: translated + measured for the threshold
  const scrollRef = useRef(null);  // optional inner scroll container

  const startY = useRef(null);     // gesture start clientY
  const active = useRef(false);    // true = dragging the sheet (vs. scrolling / idle)
  const dragYRef = useRef(0);

  const setDrag = (v) => { dragYRef.current = v; setDragY(v); };

  // True when the scrollable body is at the top (or there is no scroll body).
  const atTop = () => {
    const sc = scrollRef.current;
    return !sc || sc.scrollTop <= 0;
  };

  // On release: dismiss if dragged past the fraction of the sheet's height,
  // otherwise reset the offset to snap back. On dismiss the consumer's own
  // `open` flag animates the sheet away (and resetting avoids a stale offset
  // when it reopens).
  const end = useCallback(() => {
    if (active.current) {
      if (dragYRef.current > dismissThreshold) onDismiss();
      setDrag(0);
    }
    startY.current = null;
    active.current = false;
    setDragging(false);
  }, [onDismiss, dismissThreshold]);

  // Touch gesture: scroll first, then hand off into a sheet drag once a downward
  // pull starts while the body is at the top.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    const onTouchStart = (e) => { startY.current = e.touches[0].clientY; active.current = false; };

    const onTouchMove = (e) => {
      if (startY.current == null) return;
      const y = e.touches[0].clientY;
      if (!active.current) {
        // Take over only when pulling down AND the body is already at the top.
        if (y - startY.current > 0 && atTop()) {
          active.current = true;
          setDragging(true);
          startY.current = y;   // rebase so the sheet doesn't jump
          e.preventDefault();   // claim the gesture; the drag tracks from the next move
          return;               // without this, d === 0 below hits the pull-back branch
                                // and immediately deactivates — the touch drag never sustains
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

  // Mouse drag (desktop). Touch is handled above; pointerType 'touch' is ignored
  // so touch devices don't double-drive the gesture. A drag only begins on a
  // downward move from the top, so plain clicks on buttons/inputs are unaffected.
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch') return;
    if (!atTop()) return;
    const downY = e.clientY;
    let started = false;
    const onMove = (ev) => {
      if (!started) {
        if (ev.clientY - downY <= 0) return;   // only a downward pull starts a drag
        started = true;
        active.current = true;
        startY.current = downY;
        setDragging(true);
      }
      setDrag(Math.max(0, ev.clientY - startY.current));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      end();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return { dragY, dragging, sheetRef, scrollRef, onPointerDown };
}
