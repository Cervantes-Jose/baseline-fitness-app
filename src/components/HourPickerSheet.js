import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { tapHaptic } from './haptics';

// Hour picker that pops out *from* the hour pill (like the FAB speed-dial pops
// out from the "+" button) and grows downward. It renders as a transparent,
// scrollable column of floating hour "pills" — no card container, so you just
// see the hours, which fade in/out at the top and bottom edges via a mask
// gradient. Must be rendered inside a `position: relative` wrapper (the pill's
// wrapper) so it anchors directly beneath the trigger.
//
//   open      — whether the picker is shown
//   hours     — the HOURS array ({ label, value })
//   value     — currently selected hour value
//   onSelect  — (value) => void, fired when a row is tapped
//   onClose   — () => void, fired on tap-outside or after a selection
//   align     — 'right' (default) | 'left', which edge to anchor to the trigger
function HourPickerSheet({ open, hours = [], value, onSelect, onClose, align = 'right' }) {
  const listRef = useRef(null);
  // The hour being tapped — flashes blue briefly (with a haptic) before the
  // picker commits the selection and closes.
  const [pending, setPending] = useState(null);

  const pick = (val) => {
    if (pending != null) return;
    tapHaptic();
    setPending(val);
    setTimeout(() => { onSelect(val); onClose(); }, 130);
  };

  // Reset the flash state whenever the picker closes, so reopening it lets you
  // pick again (otherwise `pending` stays set and blocks the next selection).
  useEffect(() => { if (!open) setPending(null); }, [open]);

  // Center the selected hour in the scroll viewport as soon as it mounts
  // (before paint, so there's no visible jump from the top).
  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('[data-selected="true"]');
    if (el) {
      listRef.current.scrollTop =
        el.offsetTop - listRef.current.clientHeight / 2 + el.clientHeight / 2;
    }
  }, [open]);

  // Dismiss on a tap *outside* the list. Using a click listener (rather than a
  // full-screen backdrop) keeps the page behind scrollable, and a scroll
  // gesture won't dismiss the picker — only a discrete tap outside does.
  useEffect(() => {
    if (!open) return;
    // Arm on the next tick so the same tap that *opened* the picker (which is
    // still propagating to document) can't immediately close it.
    let armed = false;
    const t = setTimeout(() => { armed = true; }, 0);
    const onDocClick = (e) => {
      if (!armed) return;
      if (listRef.current && !listRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('click', onDocClick);
    return () => { clearTimeout(t); document.removeEventListener('click', onDocClick); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    /* Scrollable column of floating hour pills, anchored beneath the trigger */
    <div
      ref={listRef}
      style={{
        position: 'absolute', top: '100%', [align]: 0, marginTop: 8, zIndex: 201,
        maxHeight: 256,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        display: 'flex', flexDirection: 'column',
        alignItems: align === 'right' ? 'flex-end' : 'flex-start',
        gap: 7,
        padding: '38px 4px',
        scrollbarWidth: 'none',
          // Fade the rows in/out at the top and bottom edges as they scroll.
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0, #000 38px, #000 calc(100% - 38px), transparent 100%)',
          maskImage:
            'linear-gradient(to bottom, transparent 0, #000 38px, #000 calc(100% - 38px), transparent 100%)',
        }}
      >
        {hours.map((h) => {
          const selected = h.value === value;
          const active = selected || pending === h.value;
          return (
            <button
              key={h.value}
              data-selected={selected}
              onClick={() => pick(h.value)}
              style={{
                flexShrink: 0,
                minWidth: 100,
                background: active ? 'var(--accent)' : 'var(--card)',
                color: active ? '#fff' : 'var(--text-primary)',
                border: active ? 'none' : '1px solid var(--border)',
                borderRadius: 20,
                padding: '7px 16px',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'background 0.12s ease, color 0.12s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                animation: 'fabItemIn 0.2s cubic-bezier(0.2,0.8,0.2,1) both',
              }}
            >
              {h.label}
            </button>
          );
        })}
    </div>
  );
}

export default HourPickerSheet;
