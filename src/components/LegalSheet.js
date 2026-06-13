import { useState, useRef } from 'react';
import TermsOfService from './TermsOfService';
import PrivacyPolicy from './PrivacyPolicy';

// Bottom-up sheet that shows a legal document on the auth screen. Opened from
// the "Terms of Service" / "Privacy Policy" links under the Sign up button.
// Dismissed by dragging the sheet down (from the top handle) or tapping the
// backdrop. `doc` is 'terms' | 'privacy'; `onClose` clears it.
export default function LegalSheet({ doc, onClose = () => {} }) {
  // Vertical drag offset while the user is pulling the sheet down.
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef(null);

  if (!doc) return null;

  const title = doc === 'terms' ? 'Terms of Service' : 'Privacy Policy';

  const onPointerDown = (e) => {
    dragStartY.current = e.clientY;
  };
  const onPointerMove = (e) => {
    if (dragStartY.current == null) return;
    const delta = e.clientY - dragStartY.current;
    if (delta > 0) setDragY(delta); // only allow dragging downward
  };
  const onPointerUp = () => {
    if (dragStartY.current == null) return;
    // Past ~120px of pull, dismiss; otherwise snap back.
    if (dragY > 120) onClose();
    else setDragY(0);
    dragStartY.current = null;
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          transform: `translateY(${dragY}px)`,
          transition: dragStartY.current == null ? 'transform 0.25s ease' : 'none',
          animation: 'legalSheetUp 0.28s ease',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
        }}
      >
        <style>{`@keyframes legalSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

        {/* Grab handle + title — this strip is the drag target */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ padding: '10px 16px 12px', flexShrink: 0, cursor: 'grab', touchAction: 'none' }}
        >
          <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--border)', margin: '0 auto 10px' }} />
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
        </div>

        {/* Scrollable document body — reuses the existing legal screens */}
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {doc === 'terms' ? <TermsOfService hideBack /> : <PrivacyPolicy hideBack />}
        </div>
      </div>
    </div>
  );
}
