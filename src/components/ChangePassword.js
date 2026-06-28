import { useState } from 'react';
import { supabase } from '../supabaseClient';
import SettingsPageHeader from './SettingsPageHeader';
import { validatePassword, PASSWORD_RULE_TEXT } from './passwordPolicy';

const fieldGroup = { display: 'flex', flexDirection: 'column', gap: 8 };
const fieldLabel = { fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 };

// In-app password change. Requires the current password (re-authenticated via
// signInWithPassword) before applying the new one, so an unlocked session can't
// silently swap credentials. The new password must pass the shared policy.
export default function ChangePassword({ user, onBack }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(''); setSuccess('');
    if (!current) { setError('Enter your current password'); return; }
    const pwError = validatePassword(next);
    if (pwError) { setError(pwError); return; }
    if (next !== confirm) { setError("Passwords don't match"); return; }
    if (next === current) { setError('New password must be different from your current password'); return; }

    setLoading(true);
    // Verify the current password by re-authenticating before allowing the change.
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user?.email, password: current });
    if (authError) { setLoading(false); setError('Current password is incorrect'); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setLoading(false);
    if (updateError) { setError(updateError.message); return; }
    setSuccess('Password updated successfully.');
    setCurrent(''); setNext(''); setConfirm('');
  };

  return (
    <div style={{ paddingBottom: 100 }}>
      <SettingsPageHeader title="Change Password" onBack={onBack} />
      <form onSubmit={submit} style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={fieldGroup}>
          <label style={fieldLabel}>Current Password</label>
          <input className="input" type="password" autoComplete="current-password" placeholder="Enter current password"
            value={current} onChange={e => setCurrent(e.target.value)} disabled={loading} />
        </div>
        <div style={fieldGroup}>
          <label style={fieldLabel}>New Password</label>
          <input className="input" type="password" autoComplete="new-password" placeholder="Enter new password"
            value={next} onChange={e => setNext(e.target.value)} disabled={loading} />
        </div>
        <div style={fieldGroup}>
          <label style={fieldLabel}>Confirm New Password</label>
          <input className="input" type="password" autoComplete="new-password" placeholder="Re-enter new password"
            value={confirm} onChange={e => setConfirm(e.target.value)} disabled={loading} />
          {confirm && confirm !== next ? (
            <p style={{ fontSize: 12, color: '#EF4444', fontWeight: 500, margin: '2px 0 0' }}>Passwords don't match</p>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{PASSWORD_RULE_TEXT}</p>
          )}
        </div>

        {error && <p style={{ fontSize: 14, color: '#EF4444', fontWeight: 500, margin: 0 }}>{error}</p>}
        {success && <p style={{ fontSize: 14, color: 'var(--green)', fontWeight: 600, margin: 0 }}>{success}</p>}

        <button type="submit" className="btn-primary" disabled={loading} style={{ opacity: loading ? 0.85 : 1 }}>
          {loading ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
