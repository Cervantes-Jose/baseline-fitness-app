import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { loadRoutinesWithStats, routineCategories, avgTimeText, daysAgoText } from './routineMeta';

// Full-screen "View All" routine picker. Mirrors the My Routines list (rich
// tiles) minus the page's top stats widget. Slides up from the bottom and is
// swipe-down dismissable. Tapping a routine adds `exerciseName` to it via onPick.
function RoutinePickerSheet({ exerciseName, onPick, onClose }) {
  const [data, setData] = useState(null);   // { routines, lastPerformed, avgDuration } | null while loading
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setData(await loadRoutinesWithStats(session?.user?.id));
    })();
  }, []);

  // Swipe-to-dismiss: drag down from the handle/header; release past a threshold closes.
  const onPointerDown = (e) => { dragStart.current = e.clientY; };
  const onPointerMove = (e) => {
    if (dragStart.current == null) return;
    const dy = e.clientY - dragStart.current;
    if (dy > 0) setDragY(dy);
  };
  const endDrag = () => {
    if (dragStart.current == null) return;
    dragStart.current = null;
    if (dragY > 110) onClose();
    else setDragY(0);
  };

  const routines = data?.routines || [];
  const divider = <span style={{ width: 1, height: 11, background: 'var(--border)', flexShrink: 0 }} />;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg)', width: '100%', maxWidth: 480, height: '92vh', marginTop: 'auto',
          borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transform: `translateY(${dragY}px)`,
          transition: dragStart.current == null ? 'transform 0.25s ease' : 'none',
          boxShadow: '0 -6px 24px rgba(0,0,0,0.18)',
        }}
      >
        {/* Drag handle + header — the swipe-to-dismiss zone */}
        <div
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={endDrag} onPointerCancel={endDrag}
          style={{ flexShrink: 0, padding: '10px 16px 8px', cursor: 'grab', touchAction: 'none' }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Add to Routine</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>{exerciseName}</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data == null ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>Loading...</p>
          ) : routines.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>No routines yet — create one first.</p>
          ) : (
            routines.map(r => {
              const cats = routineCategories(r);
              return (
                <button
                  key={r.id}
                  onClick={() => onPick(r)}
                  style={{
                    textAlign: 'left', background: 'var(--card)', borderRadius: 12, padding: 18,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)', border: '1px solid var(--border)', cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', lineHeight: 1.1 }}>{r.name}</div>
                  {cats.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{cats.join('  •  ')}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
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
