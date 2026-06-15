import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { tapHaptic } from './haptics';

// Compact, in-row version of the app's floating "+" speed-dial. The + rotates to
// × and a small menu pops out: up to 4 routines as "Add to {name}" plus a
// "View All" entry that always appears. Rendered through a portal so the category
// section's overflow:hidden can't clip it. Opens upward (dropping below only when
// there's no room above), nudged left to clear the column of + buttons, and
// closes on any scroll/resize since it's position:fixed and would otherwise hang.
const MAX_ROUTINES = 4;
const ITEM_H = 46;     // approx pill height incl. gap, for up/down placement
const LEFT_SHIFT = 44; // nudge pills left so they don't sit on the + column
const TOP_MARGIN = 70; // keep the menu clear of the sticky search/header band

function pillStyle(isViewAll, i, active) {
  const blue = isViewAll || active;   // View All is always blue; others flash blue when tapped
  return {
    display: 'flex', alignItems: 'center', maxWidth: 'min(70vw, 320px)',
    background: blue ? 'var(--accent)' : 'var(--card)',
    color: blue ? '#fff' : 'var(--text-primary)',
    border: blue ? 'none' : '1px solid var(--border)',
    borderRadius: 22, padding: '10px 16px', fontSize: 14, fontWeight: blue ? 700 : 500,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,0.14)',
    transition: 'background 0.12s ease, color 0.12s ease',
    animation: `routineMenuIn 0.2s cubic-bezier(0.2,0.8,0.2,1) ${i * 0.04}s both`,
  };
}

function RoutineAddMenu({ routines = [], onAdd, onViewAll }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  // The tapped pill's key ('viewAll' or a routine id) — flashes blue briefly
  // (with a haptic) before its action runs and the menu closes.
  const [pending, setPending] = useState(null);
  const btnRef = useRef(null);

  const shown = routines.slice(0, MAX_ROUTINES);
  const itemCount = shown.length + 1;   // + View All

  const close = () => setOpen(false);

  // Flash the tapped pill, buzz, then run its action and close.
  const pick = (key, action) => {
    if (pending != null) return;
    tapHaptic();
    setPending(key);
    setTimeout(() => { setPending(null); close(); action(); }, 130);
  };

  // position:fixed menu would detach from the button on scroll — close it instead
  // (also covers "tap/scroll anywhere else dismisses it"). Capture phase catches
  // scrolls on inner containers too.
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) {
        const estH = itemCount * ITEM_H + 8;
        const right = (window.innerWidth - r.right) + LEFT_SHIFT;
        // Prefer opening upward; only drop below when there isn't room above.
        const openUp = estH <= r.top - TOP_MARGIN;
        setPos(openUp
          ? { up: true, bottom: window.innerHeight - r.top - 8, right }
          : { up: false, top: r.bottom + 6, right });
      }
    }
    setOpen(o => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Add to routine"
        aria-expanded={open}
        style={{
          width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)',
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0, marginLeft: 8, padding: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          style={{ transform: open ? 'rotate(135deg)' : 'rotate(0deg)', transition: 'transform 0.28s cubic-bezier(0.2,0.8,0.2,1)' }}>
          <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>

      {open && pos && createPortal(
        <>
          <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 600 }} />
          <div style={{
            position: 'fixed', right: pos.right, zIndex: 601,
            ...(pos.up ? { bottom: pos.bottom } : { top: pos.top }),
            // Always top-to-bottom (routines then View All), whether the menu
            // opens up or down — anchoring handles placement, order stays fixed.
            display: 'flex', flexDirection: 'column',
            alignItems: 'flex-end', gap: 8,
          }}>
            {shown.map((r, i) => (
              <button key={r.id} onClick={() => pick(r.id, () => onAdd(r))} style={pillStyle(false, i, pending === r.id)}>
                {`Add to ${r.name}`}
              </button>
            ))}
            <button onClick={() => pick('viewAll', onViewAll)} style={pillStyle(true, shown.length)}>
              View All
            </button>
          </div>
          <style>{`@keyframes routineMenuIn { from { opacity: 0; transform: translateY(-8px) scale(0.92); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
        </>,
        document.body
      )}
    </>
  );
}

export default RoutineAddMenu;
