import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';

// Two-step confirmation modal for permanent account deletion. Step 1 explains
// what will be removed; step 2 is the final "are you sure" guard. The actual
// deletion happens server-side in the `delete-account` Edge Function, which
// derives the user from the JWT — nothing here can target another account.
export default function DeleteAccountModal({ open, onClose }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setMounted(true);
      setStep(1);
      setError('');
      setBusy(false);
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
  }, [open]);

  if (!mounted) return null;

  const close = () => {
    if (busy) return; // don't let the user dismiss mid-delete
    onClose();
  };

  const handleDelete = async () => {
    setBusy(true);
    setError('');
    const { error: fnError } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
    });
    if (fnError) {
      setError('Could not delete your account. Please try again.');
      setBusy(false);
      return;
    }
    // Account is gone — sign out locally. App.js's onAuthStateChange listener
    // sends the user back to the auth screen.
    await supabase.auth.signOut();
  };

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

        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <p style={{ textAlign: 'center', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          {step === 1 ? 'Delete Account' : 'Are you absolutely sure?'}
        </p>
        <p style={{ textAlign: 'center', fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
          {step === 1
            ? 'This permanently deletes your account and all of your data — food logs, workouts, routines, measurements and goals. This cannot be undone.'
            : 'There is no way to recover your data after this. Continue?'}
        </p>

        {error && (
          <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#EF4444', margin: '0 0 14px' }}>
            {error}
          </p>
        )}

        {step === 1 ? (
          <button
            onClick={() => setStep(2)}
            style={{ display: 'block', width: '100%', padding: 14, marginBottom: 10, background: '#EF4444', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleDelete}
            disabled={busy}
            style={{ display: 'block', width: '100%', padding: 14, marginBottom: 10, background: '#EF4444', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? 'Deleting…' : 'Delete Forever'}
          </button>
        )}

        <button
          onClick={close}
          disabled={busy}
          style={{ display: 'block', width: '100%', padding: 14, background: 'transparent', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}
