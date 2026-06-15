import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import LegalSheet from './LegalSheet';

// Eye / eye-off icon for the password reveal toggle.
function EyeIcon({ off }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {off ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

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

// Field layout: a label stacked above its input, with bigger inputs than the
// default `.input` to give the login form more presence.
const fieldGroup = { display: 'flex', flexDirection: 'column', gap: 9 };
// Black, sentence-case label (overrides `.section-title`'s muted uppercase look).
const fieldLabel = { margin: 0, color: 'var(--text-primary)', textTransform: 'none', letterSpacing: 'normal' };
// Bigger inputs, squared off (12px) to match the app's flat tiles.
const bigInput = { padding: '19px 18px', fontSize: 17, borderRadius: 12 };

// Whole-years age from a "YYYY-MM-DD" string. Returns null for an invalid or
// future date (negative age).
function ageFromDob(dobStr) {
  const d = new Date(dobStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age < 0 ? null : age;
}

// ─── AUTH SCREEN ────────────────────────────────────────────
// Full-screen login / signup / forgot-password flow. Rendered by App.js when
// there is no authenticated user. No bottom tab bar here.
export default function AuthScreen({ onAuth = () => {} }) {
  const [view, setView] = useState('login'); // login | signup | forgot | reset
  const [firstName, setFirstName] = useState('');
  const [dob, setDob] = useState('');   // YYYY-MM-DD (matches the profiles.dob column)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [legalDoc, setLegalDoc] = useState(null); // null | 'terms' | 'privacy'

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
    setFirstName('');
    setDob('');
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
    if (!firstName.trim()) { setError('Please enter your name'); return; }
    if (!dob) { setError('Please enter your date of birth'); return; }
    const ageNum = ageFromDob(dob);
    if (ageNum == null) { setError('Please enter a valid date of birth'); return; }
    if (ageNum < 13) { setError('You must be at least 13 years old to use Baseline Fitness'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          // Stash DOB in auth metadata too: it persists with the signup even
          // when email confirmation is on (no session yet to write profiles).
          // AccountInformation backfills it into the profiles row on first load.
          dob,
        },
      },
    });
    if (error) { setLoading(false); setError(error.message); return; }
    // When email confirmation is off there's a session immediately, so write
    // DOB straight to the profiles row. When it's on, this no-ops (no session)
    // and the metadata copy above is synced into profiles on first load.
    if (data?.user?.id && data?.session) {
      await supabase.from('profiles').upsert({ user_id: data.user.id, dob }, { onConflict: 'user_id' });
    }
    setLoading(false);
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
      justifyContent: 'center', padding: '24px 16px',
    }}>
      {/* keyframes for the in-button spinner */}
      <style>{`@keyframes authSpin { to { transform: rotate(360deg); } }`}</style>

      {/* Back to sign in — bare blue chevron, top-left (signup only) */}
      {view === 'signup' && (
        <button
          type="button"
          onClick={() => switchView('login')}
          aria-label="Back"
          style={{ position: 'absolute', top: 16, left: 10, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 8, display: 'flex' }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}

      {/* App name + tagline — pinned to the top-left of the screen */}
      <div style={{ position: 'absolute', top: 56, left: 24, right: 24, textAlign: 'left' }}>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-1px', margin: 0, lineHeight: 1.1 }}>
          {view === 'login' && <span style={{ display: 'block' }}>Welcome to</span>}
          {view === 'signup' && <span>Join </span>}
          <span style={{ display: view === 'signup' ? 'inline' : 'block', color: 'var(--accent)' }}>Baseline Fitness</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', marginTop: 12 }}>
          {view === 'login'
            ? 'Sign in to continue tracking your progress.'
            : view === 'signup'
            ? 'Elevate your fitness journey.'
            : 'Track everything. Know your baseline.'}
        </p>
      </div>

      {/* Form card */}
      <form
        onSubmit={onSubmit}
        style={{ width: '100%', maxWidth: 420, marginTop: 96, display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        {view === 'reset' && (
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 4px' }}>
            Set New Password
          </h2>
        )}

        {view === 'signup' && (
          <div style={fieldGroup}>
            <label className="section-title" style={fieldLabel}>First Name</label>
            <input
              className="input"
              type="text"
              autoCapitalize="words"
              autoComplete="given-name"
              placeholder="Enter your name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={loading}
              style={bigInput}
            />
          </div>
        )}

        {view !== 'reset' && (
          <div style={fieldGroup}>
            <label className="section-title" style={fieldLabel}>Email</label>
            <input
              className="input"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              style={bigInput}
            />
          </div>
        )}

        {view === 'signup' && (
          <div style={fieldGroup}>
            <label className="section-title" style={fieldLabel}>Date of Birth</label>
            <input
              className="input"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              disabled={loading}
              style={{ ...bigInput, textAlign: 'left' }}
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              You must be at least 13 years old.
            </p>
          </div>
        )}

        {view !== 'forgot' && (
          <div style={fieldGroup}>
            <label className="section-title" style={fieldLabel}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                autoComplete={view === 'login' ? 'current-password' : 'new-password'}
                placeholder={view === 'reset' ? 'New password' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                style={{ ...bigInput, paddingRight: 52 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
          </div>
        )}

        {/* Forgot password (right) — login only */}
        {view === 'login' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -2 }}>
            <button
              type="button"
              onClick={() => switchView('forgot')}
              style={{ ...linkStyle, fontSize: 14 }}
            >
              Forgot password?
            </button>
          </div>
        )}

        {(view === 'signup' || view === 'reset') && (
          <div style={fieldGroup}>
            <label className="section-title" style={fieldLabel}>Confirm Password</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder={view === 'reset' ? 'Re-enter new password' : 'Re-enter your password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              style={bigInput}
            />
            {confirmPassword && confirmPassword !== password ? (
              <p style={{ fontSize: 12, color: '#EF4444', fontWeight: 500, margin: '2px 0 0' }}>
                Passwords don't match
              </p>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                At least 6 characters
              </p>
            )}
          </div>
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
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 50, fontWeight: 500, opacity: loading ? 0.85 : 1 }}
        >
          {loading ? <ButtonSpinner /> : (view === 'login' ? 'Sign In' : view === 'signup' ? 'Sign up' : view === 'reset' ? 'Update Password' : 'Send Reset Link')}
        </button>

        {/* Legal agreement — signup only. Links open the bottom sheet. */}
        {view === 'signup' && (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
            <span style={{ display: 'block' }}>By signing up, you agree to our</span>
            <span style={{ display: 'block' }}>
              <button type="button" onClick={() => setLegalDoc('terms')} style={{ ...linkStyle, fontSize: 14 }}>Terms of Service</button>
              {' '}and{' '}
              <button type="button" onClick={() => setLegalDoc('privacy')} style={{ ...linkStyle, fontSize: 14 }}>Privacy Policy</button>.
            </span>
          </p>
        )}

        {/* Back to sign in (forgot only) */}
        {view === 'forgot' && (
          <button type="button" onClick={() => switchView('login')} style={{ ...linkStyle, alignSelf: 'center' }}>
            Back to sign in
          </button>
        )}
      </form>

      {/* Footer view switch */}
      <div style={{ marginTop: view === 'signup' ? 10 : 20, fontSize: 15, color: 'var(--text-muted)' }}>
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

      {/* Terms / Privacy bottom sheet */}
      <LegalSheet doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}
