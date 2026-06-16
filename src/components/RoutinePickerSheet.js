import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { loadRoutinesWithStats, routineCategories, avgTimeText, daysAgoText } from './routineMeta';
import useSwipeToDismiss from './useSwipeToDismiss';
import { tapHaptic } from './haptics';

// Full-screen "View All" routine picker. Mirrors the My Routines list (rich
// tiles) minus the page's top stats widget. Slides up from the bottom and is
// swipe-down dismissable. Tapping a routine adds `exerciseName` to it via onPick.
function RoutinePickerSheet({ exerciseName, onPick, onClose }) {
  const [data, setData] = useState(null);   // { routines, lastPerformed, avgDuration } | null while loading
  // The tapped routine's id — flashes blue briefly (with a haptic) before the
  // pick commits and the sheet closes.
  const [pending, setPending] = useState(null);

  const pick = (routine) => {
    if (pending != null) return;
    tapHaptic();
    setPending(routine.id);
    setTimeout(() => onPick(routine), 130);
  };
  // Swipe down anywhere on the sheet (once the list is scrolled to the top) to dismiss.
  const { dragY, dragging, scrollRef, sheetRef, onPointerDown } = useSwipeToDismiss({ onDismiss: onClose });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setData(await loadRoutinesWithStats(session?.user?.id));
    })();
  }, []);

  // Lock background scroll while the sheet is open (same pattern as the other
  // portal sheets) so the page behind doesn't scroll under the overlay.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const routines = data?.routines || [];
  const divider = <span style={{ width: 1, height: 11, background: 'var(--border)', flexShrink: 0 }} />;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
        onPointerDown={onPointerDown}
        style={{
          background: 'var(--bg)', width: '100%', maxWidth: 480, height: '92vh', marginTop: 'auto',
          borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transform: `translateY(${dragY}px)`,
          transition: dragging ? 'none' : 'transform 0.25s ease',
          boxShadow: '0 -6px 24px rgba(0,0,0,0.18)',
        }}
      >
        {/* Drag handle + header */}
        <div
          style={{ flexShrink: 0, padding: '10px 16px 8px' }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Add to Routine</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>{exerciseName}</p>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data == null ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>Loading...</p>
          ) : routines.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>No routines yet — create one first.</p>
          ) : (
            routines.map(r => {
              const cats = routineCategories(r);
              const active = pending === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => pick(r)}
                  style={{
                    textAlign: 'left', background: active ? 'var(--accent)' : 'var(--card)', borderRadius: 12, padding: 18,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                    border: active ? '1px solid var(--accent)' : '1px solid var(--border)', cursor: 'pointer',
                    transition: 'background 0.12s ease',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 18, color: active ? '#fff' : 'var(--text-primary)', lineHeight: 1.1 }}>{r.name}</div>
                  {cats.length > 0 && (
                    <div style={{ fontSize: 12, color: active ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)', marginTop: 2 }}>{cats.join('  •  ')}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12, color: active ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)', marginTop: 8 }}>
                    <span>
                      {data.lastPerformed[r.id]
                        ? <>Last performed <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{daysAgoText(data.lastPerformed[r.id])}</span></>
                        : 'Never performed'}
                    </span>
                    {divider}
                    <span>{r.exercises.length} exercise{r.exercises.length !== 1 ? 's' : ''}</span>
                    {data.avgDuration[r.id] != null && (
                      <>
                        {divider}
                        <span>{avgTimeText(data.avgDuration[r.id])}</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default RoutinePickerSheet;
