import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Small inline spinner used inside buttons while auth is processing.
function ButtonSpinner() {
  return (
    <span
      style={{
        display: 'inline-block', width: 18, height: 18,
        border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
        borderRadius: '50%', animation: 'authSpin 0.7s linear infinite',
      }}
    />
  );
}

// ─── AUTH SCREEN ────────────────────────────────────────────
// Full-screen login / signup / forgot-password flow. Rendered by App.js when
// there is no authenticated user. No bottom tab bar here.
export default function AuthScreen({ onAuth = () => {} }) {
  const [view, setView] = useState('login'); // login | signup | forgot | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Supabase redirects back from a password-reset email with a recovery token in
  // the URL hash. Detect it on mount and show the "Set New Password" form.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setView('reset');
    }
  }, []);

  // Switch views and reset any transient state (errors, success, password fields).
  const switchView = (next) => {
    setView(next);
    setError('');
    setSuccess('');
    setResetSent(false);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSignIn = async () => {
    setError('');
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    onAuth(data.user);
  };

  const handleSignUp = async () => {
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    onAuth(data.user);
  };

  const handleReset = async () => {
    setError('');
    setLoading(true);
    // Redirect URL must be added to Supabase Auth → URL Configuration → Redirect URLs:
    // https://fitness-app-ebon-six.vercel.app
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://fitness-app-ebon-six.vercel.app',
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setResetSent(true);
  };

  // Set a new password using the recovery session established by the email link.
  const handleUpdatePassword = async () => {
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    // End the temporary recovery session so the user must re-authenticate with
    // their new password.
    await supabase.auth.signOut();
    // Clear the recovery hash from the URL so a refresh doesn't re-trigger reset.
    window.history.replaceState(null, '', window.location.pathname);
    setSuccess('Password updated successfully. Please sign in.');
    setPassword('');
    setConfirmPassword('');
    setView('login');
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    if (view === 'login') handleSignIn();
    else if (view === 'signup') handleSignUp();
    else if (view === 'reset') handleUpdatePassword();
    else handleReset();
  };

  const linkStyle = {
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    color: 'var(--accent)', fontSize: 14, fontWeight: 600,
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px',
    }}>
      {/* keyframes for the in-button spinner */}
      <style>{`@keyframes authSpin { to { transform: rotate(360deg); } }`}</style>

      {/* App name + tagline */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          Baseline Fitness
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
          Track everything. Know your baseline.
        </p>
      </div>

      {/* Form card */}
      <form
        onSubmit={onSubmit}
        className="card-flat"
        style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {view === 'reset' && (
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 4px' }}>
            Set New Password
          </h2>
        )}

        {view !== 'reset' && (
          <input
            className="input"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        )}

        {view !== 'forgot' && (
          <input
            className="input"
            type="password"
            autoComplete={view === 'login' ? 'current-password' : 'new-password'}
            placeholder={view === 'reset' ? 'New password' : 'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        )}

        {(view === 'signup' || view === 'reset') && (
          <>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder={view === 'reset' ? 'Confirm new password' : 'Confirm password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -4 }}>
              At least 6 characters
            </p>
          </>
        )}

        {/* Success message (forgot password) */}
        {view === 'forgot' && resetSent && (
          <p style={{ fontSize: 14, color: 'var(--green)', fontWeight: 600 }}>
            Check your email for a reset link
          </p>
        )}

        {/* Success message (e.g. after a password update) */}
        {success && (
          <p style={{ fontSize: 14, color: 'var(--green)', fontWeight: 600 }}>
            {success}
          </p>
        )}

        {/* Error message */}
        {error && (
          <p style={{ fontSize: 14, color: '#EF4444', fontWeight: 500 }}>
            {error}
          </p>
        )}

        {/* Primary action */}
        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 50, opacity: loading ? 0.85 : 1 }}
        >
          {loading ? <ButtonSpinner /> : (view === 'login' ? 'Sign In' : view === 'signup' ? 'Create Account' : view === 'reset' ? 'Update Password' : 'Send Reset Link')}
        </button>

        {/* Forgot password link (login only) */}
        {view === 'login' && (
          <button type="button" onClick={() => switchView('forgot')} style={{ ...linkStyle, alignSelf: 'center' }}>
            Forgot password?
          </button>
        )}

        {/* Back to sign in (forgot only) */}
        {view === 'forgot' && (
          <button type="button" onClick={() => switchView('login')} style={{ ...linkStyle, alignSelf: 'center' }}>
            Back to sign in
          </button>
        )}
      </form>

      {/* Footer view switch */}
      <div style={{ marginTop: 20, fontSize: 14, color: 'var(--text-muted)' }}>
        {view === 'login' && (
          <span>
            Don't have an account?{' '}
            <button type="button" onClick={() => switchView('signup')} style={linkStyle}>Sign up</button>
          </span>
        )}
        {view === 'signup' && (
          <span>
            Already have an account?{' '}
            <button type="button" onClick={() => switchView('login')} style={linkStyle}>Sign in</button>
          </span>
        )}
      </div>
    </div>
  );
}
