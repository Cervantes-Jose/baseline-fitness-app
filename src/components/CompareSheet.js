import React, { useState, useEffect } from 'react';

// Bottom sheet for picking a second series to overlay on the trend chart. Slides
// up from the bottom (same sheet language as the measurement calendar) and lists
// the cross-domain compare catalog grouped by source (Measurements / Nutrition /
// Personal Records). See compareSources.loadCompareCatalog for the shape.
//
// Props:
//   catalog    — [{ group, items:[{ id, label, color, unit, entries }] }]
//   loading    — true while the catalog is being fetched
//   selectedId — currently-overlaid series id (or null)
//   onSelect   — (id) => void
//   onRemove   — () => void   (clear the active comparison)
//   onClose    — () => void
//   zIndex     — base stacking level (backdrop = zIndex, sheet = zIndex + 1).
//                Defaults to 600; raise it when opening above a modal/portal.
export default function CompareSheet({ catalog, loading, selectedId, onSelect, onRemove, onClose, zIndex = 600 }) {
  const [shown, setShown] = useState(false);

  // Slide up on mount; lock the page behind the sheet.
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(id); document.body.style.overflow = prev; };
  }, []);

  const close = () => { setShown(false); setTimeout(onClose, 280); };

  const isEmpty = !loading && (!catalog || catalog.length === 0);

  return (
    <>
      <div onClick={close} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex,
        opacity: shown ? 1 : 0, transition: 'opacity 0.28s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', width: '100%', maxWidth: 480,
        transform: `translateX(-50%) translateY(${shown ? '0' : '100%'})`,
        transition: 'transform 0.3s cubic-bezier(0.2,0.8,0.2,1)',
        background: 'var(--card)', borderRadius: '24px 24px 0 0',
        padding: '12px 20px 36px', zIndex: zIndex + 1, boxShadow: '0 -4px 24px rgba(0,0,0,0.16)',
        maxHeight: '78vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px', flexShrink: 0 }} />
        <div style={{ marginBottom: 14, flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Compare with</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Overlay any measurement, nutrition, or PR trend</div>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {selectedId && (
            <button onClick={() => { onRemove(); close(); }} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14,
              border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)',
              fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
              Remove comparison
            </button>
          )}

          {loading && (
            <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
          )}

          {isEmpty && (
            <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Nothing else to compare yet. Log measurements, food, or PRs first.
            </div>
          )}

          {(catalog || []).map(group => (
            <div key={group.group} style={{ marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '4px 2px 8px' }}>
                {group.group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.items.map(item => {
                  const selected = item.id === selectedId;
                  const count = item.entries.length;
                  return (
                    <button key={item.id} onClick={() => { onSelect(item.id); close(); }} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14,
                      border: selected ? `1.5px solid ${item.color}` : '1px solid var(--border)',
                      background: selected ? 'var(--accent-light)' : 'var(--bg)',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}>
                      <span style={{ width: 14, height: 14, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{count} {count === 1 ? 'point' : 'points'}</div>
                      </div>
                      {selected && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: item.color, flexShrink: 0 }}>
                          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
