import { useState } from 'react';
import { supabase } from '../supabaseClient';
import SettingsPageHeader from './SettingsPageHeader';

const fieldGroup = { display: 'flex', flexDirection: 'column', gap: 8 };
const fieldLabel = { fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// In-app email change. Requires the current password (re-authenticated) before
// requesting the change. Supabase doesn't switch the email immediately — it emails
// a confirmation link to the new address; the account email updates only once that
// link is clicked, so we tell the user to check their inbox.
export default function ChangeEmail({ user, onBack }) {
  const [current, setCurrent] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    const next = email.trim();
    if (!current) { setError('Enter your current password'); return; }
    if (!EMAIL_RE.test(next)) { setError('Enter a valid email address'); return; }
    if (next.toLowerCase() === (user?.email || '').toLowerCase()) { setError('That is already your email address'); return; }
    if (next !== confirmEmail.trim()) { setError("Emails don't match"); return; }

    setLoading(true);
    // Verify the current password by re-authenticating before requesting the change.
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user?.email, password: current });
    if (authError) { setLoading(false); setError('Current password is incorrect'); return; }
    const { error: updateError } = await supabase.auth.updateUser({ email: next });
    setLoading(false);
    if (updateError) { setError(updateError.message); return; }
    setSent(true);
  };

  if (sent) {
    return (
      <div style={{ paddingBottom: 100 }}>
        <SettingsPageHeader title="Change Email" onBack={onBack} />
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
            We've sent a confirmation link to <strong>{email.trim()}</strong>. Click it to finish changing your email.
            Until then, keep signing in with your current email.
          </p>
          <button onClick={onBack} className="btn-primary">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <SettingsPageHeader title="Change Email" onBack={onBack} />
      <form onSubmit={submit} style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={fieldGroup}>
          <label style={fieldLabel}>Current Email</label>
          <input className="input" type="email" value={user?.email || ''} disabled readOnly
            style={{ color: 'var(--text-secondary)' }} />
        </div>
        <div style={fieldGroup}>
          <label style={fieldLabel}>Current Password</label>
          <input className="input" type="password" autoComplete="current-password" placeholder="Enter current password"
            value={current} onChange={e => setCurrent(e.target.value)} disabled={loading} />
        </div>
        <div style={fieldGroup}>
          <label style={fieldLabel}>New Email</label>
          <input className="input" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" placeholder="Enter new email"
            value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
        </div>
        <div style={fieldGroup}>
          <label style={fieldLabel}>Confirm New Email</label>
          <input className="input" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" placeholder="Re-enter new email"
            value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)} disabled={loading} />
          {confirmEmail && confirmEmail.trim() !== email.trim() && (
            <p style={{ fontSize: 12, color: '#EF4444', fontWeight: 500, margin: '2px 0 0' }}>Emails don't match</p>
          )}
        </div>

        {error && <p style={{ fontSize: 14, color: '#EF4444', fontWeight: 500, margin: 0 }}>{error}</p>}

        <button type="submit" className="btn-primary" disabled={loading} style={{ opacity: loading ? 0.85 : 1 }}>
          {loading ? 'Sending…' : 'Send Confirmation Link'}
        </button>
      </form>
    </div>
  );
}
