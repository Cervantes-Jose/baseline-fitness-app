import React, { useState, useEffect } from 'react';

// `onUndo` is optional: most callers are plain notifications ("Couldn't save — check your
// connection.") with nothing to undo. Those render as message-only — an Undo button with
// no handler behind it threw when tapped.
function UndoToast({ message, onUndo = null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: '90px',
      left: '50%',
      transform: `translateX(-50%) translateY(${visible ? '0px' : '16px'})`,
      opacity: visible ? 1 : 0,
      transition: 'transform 0.25s ease, opacity 0.25s ease',
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '10px 16px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      zIndex: 400,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>{message}</span>
      {onUndo && (
        <button onClick={onUndo} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--accent)', fontWeight: '700', fontSize: '14px', padding: '0',
        }}>Undo</button>
      )}
    </div>
  );
}

export default UndoToast;
