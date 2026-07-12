import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';

const MAX_CHARS = 500;

// Bottom-sheet modal for sending feedback. The message goes to the
// `send-feedback` Edge Function, which derives the sender from the JWT and
// emails it via Resend.
export default function FeedbackModal({ open, onClose }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setMessage('');
      setError('');
      setBusy(false);
      setSent(false);
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
  }, [open]);

  if (!mounted) return null;

  const close = () => {
    if (busy) return; // don't dismiss mid-send
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    const { error: fnError } = await supabase.functions.invoke('send-feedback', {
      method: 'POST',
      body: { message: trimmed },
    });
    if (fnError) {
      setError("Couldn't send your feedback. Please try again.");
      setBusy(false);
      return;
    }
    setSent(true);
    setBusy(false);
    // Close shortly after showing the success state.
    setTimeout(() => onClose(), 1400);
  };

  const remaining = MAX_CHARS - message.length;

  return createPortal(
    <div
      onClick={close}
      style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', opacity: shown ? 1 : 0, transition: 'opacity 0.28s ease', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onTransitionEnd={() => { if (!shown) setMounted(false); }}
        style={{
          width: '100%', maxWidth: 480, background: 'var(--card)', borderRadius: '20px 20px 0 0',
          transform: shown ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', padding: '10px 24px 32px',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />

        {sent ? (
          <div style={{ padding: '12px 0 8px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.4">
                <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>Thanks for the feedback!</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>We've received your message.</p>
          </div>
        ) : (
          <>
            <p style={{ textAlign: 'center', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Send Feedback
            </p>
            <p style={{ textAlign: 'center', fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Found a bug or have an idea? We'd love to hear it.
            </p>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, MAX_CHARS))}
              maxLength={MAX_CHARS}
              placeholder="Tell us what's on your mind…"
              rows={5}
              autoFocus
              className="input"
              style={{ width: '100%', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.5 }}
            />
            <div style={{ textAlign: 'right', fontSize: 12, color: remaining <= 20 ? '#EF4444' : 'var(--text-muted)', margin: '6px 2px 14px' }}>
              {remaining} characters left
            </div>

            {error && (
              <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#EF4444', margin: '0 0 14px' }}>
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={busy || !message.trim()}
              style={{ display: 'block', width: '100%', padding: 14, marginBottom: 10, background: 'var(--accent)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: (busy || !message.trim()) ? 'default' : 'pointer', opacity: (busy || !message.trim()) ? 0.6 : 1 }}
            >
              {busy ? 'Sending…' : 'Submit'}
            </button>
            <button
              onClick={close}
              disabled={busy}
              style={{ display: 'block', width: '100%', padding: 14, background: 'transparent', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
