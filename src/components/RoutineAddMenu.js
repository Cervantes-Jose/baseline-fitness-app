import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

// Compact, in-row version of the app's floating "+" speed-dial. The + rotates to
// × and a small menu pops out: up to 4 routines as "Add to {name}" plus a
// "View All" entry that always appears. Anchored to the button via a portal (and
// opening upward when near the bottom of the screen) so the category section's
// overflow:hidden can't clip it.
const MAX_ROUTINES = 4;
const ITEM_H = 46;   // approx pill height incl. gap, for up/down placement

function pillStyle(isViewAll, i) {
  return {
    display: 'flex', alignItems: 'center', maxWidth: 'min(70vw, 320px)',
    background: isViewAll ? 'var(--accent)' : 'var(--card)',
    color: isViewAll ? '#fff' : 'var(--text-primary)',
    border: isViewAll ? 'none' : '1px solid var(--border)',
    borderRadius: 22, padding: '10px 16px', fontSize: 14, fontWeight: isViewAll ? 700 : 500,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,0.14)',
    animation: `routineMenuIn 0.2s cubic-bezier(0.2,0.8,0.2,1) ${i * 0.04}s both`,
  };
}

function RoutineAddMenu({ routines = [], onAdd, onViewAll }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);

  const shown = routines.slice(0, MAX_ROUTINES);
  const itemCount = shown.length + 1;   // + View All

  const toggle = () => {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) {
        const estH = itemCount * ITEM_H + 8;
        const right = window.innerWidth - r.right;
        const openUp = r.bottom + 6 + estH > window.innerHeight - 12;
        setPos(openUp
          ? { up: true, bottom: window.innerHeight - r.top + 6, right }
          : { up: false, top: r.bottom + 6, right });
      }
    }
    setOpen(o => !o);
  };
  const close = () => setOpen(false);

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
            display: 'flex', flexDirection: pos.up ? 'column-reverse' : 'column',
            alignItems: 'flex-end', gap: 8,
          }}>
            {shown.map((r, i) => (
              <button key={r.id} onClick={() => { close(); onAdd(r); }} style={pillStyle(false, i)}>
                {`Add to ${r.name}`}
              </button>
            ))}
            <button onClick={() => { close(); onViewAll(); }} style={pillStyle(true, shown.length)}>
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
