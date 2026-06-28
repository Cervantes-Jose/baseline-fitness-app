import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Reusable centered popup. Same mount/animate lifecycle as the app's bottom
// sheets (mounted → shown → onTransitionEnd unmount), but it scales up in the
// middle of the screen instead of sliding from the bottom. Backdrop click calls
// onClose; the parent can ignore that (e.g. while busy) by gating its handler.
export default function CenterModal({ open, onClose = () => {}, children, maxWidth = 340 }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', opacity: shown ? 1 : 0, transition: 'opacity 0.24s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onTransitionEnd={() => { if (!shown) setMounted(false); }}
        style={{
          width: '100%', maxWidth, background: 'var(--card)', borderRadius: 20,
          opacity: shown ? 1 : 0,
          transform: shown ? 'scale(1)' : 'scale(0.94)',
          transition: 'transform 0.26s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease',
          boxShadow: '0 16px 48px rgba(0,0,0,0.28)', padding: '24px',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
