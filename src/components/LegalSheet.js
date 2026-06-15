import { useState, useEffect } from 'react';
import TermsOfService from './TermsOfService';
import PrivacyPolicy from './PrivacyPolicy';
import useSheetDrag from './useSheetDrag';

// Bottom-up sheet that shows a legal document on the auth screen. Opened from
// the "Terms of Service" / "Privacy Policy" links under the Sign up button.
// Dismissed by dragging the sheet down (from the top handle) or tapping the
// backdrop. `doc` is 'terms' | 'privacy'; `onClose` clears it.
export default function LegalSheet({ doc, onClose = () => {} }) {
  // `open` drives the slide: false = parked below the screen, true = settled at
  // its resting height. We mount parked, then flip to open on the next frame so
  // the browser animates the transition (rather than rendering at rest first).
  const [open, setOpen] = useState(false);

  // Slide the sheet back down, then unmount once the transition finishes.
  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 280);
  };

  // Swipe-to-dismiss: drag the handle, or swipe down anywhere on the document
  // once it's scrolled to the top.
  const { dragY, dragging, scrollRef, handleProps } = useSheetDrag({ onDismiss: handleClose, threshold: 120 });

  useEffect(() => {
    if (!doc) { setOpen(false); return; }
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, [doc]);

  if (!doc) return null;

  const title = doc === 'terms' ? 'Terms of Service' : 'Privacy Policy';

  // Resting position is translateY(0); while dragging, follow the finger; while
  // closed, park fully below the viewport.
  const translateY = !open ? '100%' : `${dragY}px`;

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: open ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
        transition: 'background 0.28s ease',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          height: '67vh', display: 'flex', flexDirection: 'column',
          transform: `translateY(${translateY})`,
          transition: dragging ? 'none' : 'transform 0.3s ease',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
        }}
      >
        {/* Grab handle + title — always a drag target */}
        <div
          {...handleProps}
          style={{ padding: '10px 16px 12px', flexShrink: 0, cursor: 'grab', touchAction: 'none' }}
        >
          <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--border)', margin: '0 auto 10px' }} />
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
        </div>

        {/* Scrollable document body — reuses the existing legal screens */}
        <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {doc === 'terms' ? <TermsOfService /> : <PrivacyPolicy />}
        </div>
      </div>
    </div>
  );
}
