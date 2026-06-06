import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Bottom sheet for adding widgets to the dashboard. Categories (Food, Measurements)
// expand to reveal each widget in its real, full form; tap to multi-select, then
// "Add" drops them onto the dashboard. Slides up/down smoothly via a transform.
//
// TODO (next step): press-and-hold a preview to dismiss the sheet and continue
// dragging that widget straight onto the editing canvas.
export default function AddWidgetSheet({ open, onClose, catalog, placedSet, renderPreview, isHalf, onAdd }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set(catalog[0] ? [catalog[0].category] : []));

  // Mount then animate in on open; on close, slide out and unmount after the transition.
  useEffect(() => {
    if (open) {
      setMounted(true);
      setSelected(new Set());
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
  }, [open]);

  if (!mounted) return null;

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleExpand = (cat) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // A single selectable preview. `compact` tiles are fixed-width for the horizontal
  // scroll row; full tiles stretch. The widget already shows its own name, so there's
  // no separate label here — only the select-check / Added badge.
  const renderTile = (id, compact) => {
    const placed = placedSet.has(id);
    const isSel = selected.has(id);
    return (
      <div
        key={id}
        onClick={() => !placed && toggleSelect(id)}
        style={{
          position: 'relative', borderRadius: 18,
          flexShrink: compact ? 0 : undefined,
          width: compact ? 168 : '100%',
          cursor: placed ? 'default' : 'pointer',
          opacity: placed ? 0.45 : 1,
          boxShadow: isSel ? '0 0 0 2px var(--accent)' : 'none',
          transition: 'box-shadow 0.15s, opacity 0.15s',
        }}
      >
        {renderPreview(id)}
        {placed ? (
          <span style={{ position: 'absolute', top: 10, right: 12, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg)', padding: '3px 8px', borderRadius: 10 }}>Added</span>
        ) : (
          <span style={{
            position: 'absolute', top: 10, right: 12, width: 24, height: 24, borderRadius: '50%',
            background: isSel ? 'var(--accent)' : 'var(--card)',
            border: isSel ? 'none' : '2px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          }}>
            {isSel && <svg width="13" height="13" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>}
          </span>
        )}
      </div>
    );
  };

  const count = selected.size;
  const onSheetTransitionEnd = () => { if (!shown) setMounted(false); };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 700,
        background: 'rgba(0,0,0,0.4)',
        opacity: shown ? 1 : 0, transition: 'opacity 0.28s ease',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onTransitionEnd={onSheetTransitionEnd}
        style={{
          width: '100%', maxWidth: 480, maxHeight: '88vh',
          background: 'var(--card)', borderRadius: '20px 20px 0 0',
          display: 'flex', flexDirection: 'column',
          transform: shown ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
        }}
      >
        {/* Grabber + header */}
        <div style={{ padding: '10px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15, fontWeight: 600, padding: 0 }}>Cancel</button>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Add Widget</span>
            <button
              onClick={() => onAdd([...selected])}
              disabled={count === 0}
              style={{
                background: 'none', border: 'none', cursor: count ? 'pointer' : 'default',
                color: 'var(--accent)', opacity: count ? 1 : 0.4,
                fontSize: 15, fontWeight: 700, padding: 0,
              }}
            >
              Add{count ? ` (${count})` : ''}
            </button>
          </div>
        </div>

        {/* Scrollable categorized list */}
        <div style={{ overflowY: 'auto', padding: '8px 16px 32px' }}>
          {catalog.map(({ category, items }) => {
            const isOpen = expanded.has(category);
            const available = items.filter(it => !placedSet.has(it.id)).length;
            return (
              <div key={category} style={{ marginBottom: 8 }}>
                <button
                  onClick={() => toggleExpand(category)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 4px', background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {category}
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {available} available
                    </span>
                  </span>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', color: 'var(--text-muted)' }}>
                    <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {isOpen && (() => {
                  const halfItems = items.filter(it => isHalf(it.id));
                  const fullItems = items.filter(it => !isHalf(it.id));
                  return (
                    <div style={{ padding: '4px 0 12px' }}>
                      {items.length === 0 && (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 4px' }}>Nothing here yet.</p>
                      )}
                      {/* Small ring tiles condensed into one horizontal scroll row */}
                      {halfItems.length > 0 && (
                        <div style={{ display: 'flex', overflowX: 'auto', gap: 12, paddingBottom: 4, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                          {halfItems.map(it => renderTile(it.id, true))}
                        </div>
                      )}
                      {/* Full-width widgets stacked */}
                      {fullItems.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: halfItems.length ? 12 : 0 }}>
                          {fullItems.map(it => renderTile(it.id, false))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
