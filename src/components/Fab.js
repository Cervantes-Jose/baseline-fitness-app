import React from 'react';

// App-wide floating action button: a fixed blue circle pinned to the bottom-right (above
// the tab bar) that triggers a screen's primary "add" action. Each screen renders its own
// <Fab> with the right onClick. `raised` lifts it above the collapsed active-workout bar so
// the two don't overlap.
function Fab({ onClick, label = 'Add', raised = false }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        position: 'fixed',
        bottom: raised ? 140 : 84,
        // Hug the 480px app's right edge on desktop; 16px inset on mobile.
        right: 'max(16px, calc((100% - 480px) / 2 + 16px))',
        zIndex: 140,
        width: 50,
        height: 50,
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
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export default Fab;
