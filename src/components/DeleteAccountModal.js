import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import CenterModal from './CenterModal';

// Two-step confirmation modal for permanent account deletion. Step 1 explains
// what will be removed; step 2 requires the current password (the Edge
// Function re-authenticates with it, so a leftover session alone can't delete
// an account). The actual deletion happens server-side in the `delete-account`
// Edge Function, which derives the user from the JWT — nothing here can target
// another account. Rendered as a centered popup (via CenterModal).
export default function DeleteAccountModal({ open, onClose }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');

  // Reset to step 1 whenever the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setStep(1);
      setError('');
      setBusy(false);
      setPassword('');
    }
  }, [open]);

  const close = () => {
    if (busy) return; // don't let the user dismiss mid-delete
    onClose();
  };

  const handleDelete = async () => {
    setBusy(true);
    setError('');
    const { error: fnError } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
      body: { password },
    });
    if (fnError) {
      // FunctionsHttpError carries the raw Response in .context.
      const status = fnError.context?.status;
      if (status === 403) {
        setError('Incorrect password. Please try again.');
      } else if (status === 429) {
        setError('Too many attempts. Please wait a while and try again.');
      } else {
        setError('Could not delete your account. Please try again.');
      }
      setBusy(false);
      return;
    }
    // Account is gone — sign out locally. App.js's onAuthStateChange listener
    // sends the user back to the auth screen.
    await supabase.auth.signOut();
  };

  return (
    <CenterModal open={open} onClose={close}>
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
            : 'There is no way to recover your data after this. Enter your password to confirm.'}
        </p>

        {step === 2 && (
          <input
            type="password"
            className="input"
            placeholder="Current password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoComplete="current-password"
            autoFocus
            style={{ width: '100%', marginBottom: 14, boxSizing: 'border-box' }}
          />
        )}

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
            disabled={busy || !password}
            style={{ display: 'block', width: '100%', padding: 14, marginBottom: 10, background: '#EF4444', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: busy || !password ? 'default' : 'pointer', opacity: busy || !password ? 0.7 : 1 }}
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
    </CenterModal>
  );
}
