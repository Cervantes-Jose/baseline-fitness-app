import React, { useState } from 'react';

// App-wide floating action button that expands into a small speed-dial menu pinned to the
// bottom-right. The "+" rotates into an "×" when open; tapping the × or the backdrop closes
// it. `actions` is an array of { label, onClick }; the first action sits nearest the button.
// `raised` lifts the whole thing above the collapsed active-workout bar.
const SIZE = 50;

function Fab({ actions = [], raised = false, label = 'Add' }) {
  const [open, setOpen] = useState(false);
  const bottom = raised ? 140 : 84;
  // Hug the 480px app's right edge on desktop; 16px inset on mobile.
  const right = 'max(16px, calc((100% - 480px) / 2 + 16px))';

  const close = () => setOpen(false);

  return (
    <>
      {/* Tap-outside backdrop (transparent) */}
      {open && <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 139 }} />}

      {/* Menu items — stack upward, first action nearest the button */}
      {open && (
        <div
          style={{
            position: 'fixed',
            right,
            bottom: bottom + SIZE + 14,
            zIndex: 141,
            display: 'flex',
            flexDirection: 'column-reverse',
            alignItems: 'flex-end',
            gap: 10,
          }}
        >
          {actions.map((a, i) => (
            <button
              key={a.label}
              onClick={() => { close(); a.onClick(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 22,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.14)',
                animation: `fabItemIn 0.2s cubic-bezier(0.2,0.8,0.2,1) ${i * 0.04}s both`,
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* The button itself */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={label}
        aria-expanded={open}
        style={{
          position: 'fixed',
          bottom,
          right,
          zIndex: 141,
          width: SIZE,
          height: SIZE,
          borderRadius: '50%',
          background: 'var(--accent)',
          border: 'none',
          cursor: 'pointer',
          color: '#fff',
          boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          transition: 'bottom 0.2s ease',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          style={{
            transform: open ? 'rotate(135deg)' : 'rotate(0deg)',
            transition: 'transform 0.28s cubic-bezier(0.2,0.8,0.2,1)',
          }}
        >
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>

      <style>{`
        @keyframes fabItemIn {
          from { opacity: 0; transform: translateY(14px) scale(0.85); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}

export default Fab;
