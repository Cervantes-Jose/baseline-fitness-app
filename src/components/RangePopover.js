import { useState } from 'react';

// A small pill that opens a floating column of option pills popping out beneath
// it — the same popout language as the Food Log hour picker and the FAB
// speed-dial (white rounded cards that animate up; the selected one is accent).
// Used for the 7D/14D trend range selectors on Measurements, Nutrition, and the
// dashboard trend widgets.
//
//   value     — selected option id
//   options   — array of { id, label } (plain strings are accepted too)
//   onChange  — (id) => void
//   align     — 'right' (default) | 'left' edge to anchor the popout to
//   accent    — highlight color for the selected pill (defaults to the app's blue)
export default function RangePopover({ value, options = [], onChange = () => {}, align = 'right', accent = 'var(--accent)' }) {
  const [open, setOpen] = useState(false);
  const opts = options.map(o => (typeof o === 'string' ? { id: o, label: o } : o));
  const current = opts.find(o => o.id === value) || opts[0];

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
        {current?.label}
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          {/* Transparent full-screen catcher: tap anywhere outside to dismiss. */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div style={{
            position: 'absolute', top: '100%', [align]: 0, marginTop: '8px', zIndex: 201,
            display: 'flex', flexDirection: 'column', alignItems: align === 'right' ? 'flex-end' : 'flex-start', gap: '8px',
          }}>
            {opts.map((o, i) => {
              const sel = o.id === value;
              return (
                <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }}
                  style={{ whiteSpace: 'nowrap', minWidth: '72px', textAlign: 'center', background: sel ? accent : 'var(--card)', color: sel ? '#fff' : 'var(--text-primary)', border: sel ? 'none' : '1px solid var(--border)', borderRadius: '20px', padding: '9px 16px', fontSize: '13px', fontWeight: sel ? 700 : 500, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.14)', animation: `fabItemIn 0.2s cubic-bezier(0.2,0.8,0.2,1) ${i * 0.04}s both` }}>
                  {o.label}
                </button>
              );
            })}
          </div>
          <style>{`@keyframes fabItemIn { from { opacity: 0; transform: translateY(14px) scale(0.85); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
        </>
      )}
    </div>
  );
}
