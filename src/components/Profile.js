import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';

// ─── ICONS ──────────────────────────────────────────────────
// All row icons inherit color from their IconBox (accent), 18px, stroke style.
const ICONS = {
  person: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6.5 8-6.5s8 2.5 8 6.5" strokeLinecap="round" /></svg>,
  crown: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7l4.5 4L12 5l4.5 6L21 7v11H3z" strokeLinejoin="round" strokeLinecap="round" /></svg>,
  download: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  ruler: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="8" width="18" height="8" rx="1.5" /><path d="M7.5 8v3M12 8v4M16.5 8v3" strokeLinecap="round" /></svg>,
  target: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></svg>,
  dumbbell: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9.5v5M6 7v10M18 7v10M21 9.5v5M6 12h12" strokeLinecap="round" /></svg>,
  appearance: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 14.5A8 8 0 119.5 4 6.5 6.5 0 0020 14.5z" strokeLinejoin="round" /></svg>,
  grid: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>,
  bell: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9a6 6 0 1112 0c0 4.5 2 6 2 6H4s2-1.5 2-6z" strokeLinejoin="round" /><path d="M10 20a2 2 0 004 0" strokeLinecap="round" /></svg>,
  habit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3 8-8" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  measure: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19l4-4 3 3 5-5 4 4" strokeLinecap="round" strokeLinejoin="round" /><circle cx="8" cy="15" r="0.6" fill="currentColor" stroke="none" /><circle cx="16" cy="13" r="0.6" fill="currentColor" stroke="none" /><path d="M3 5h18" strokeLinecap="round" /></svg>,
  email: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  question: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 113.6 2.3c-.8.4-1.1 1-1.1 1.7M12 17h.01" strokeLinecap="round" /></svg>,
  shield: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l7 3v6c0 4.2-3 7-7 9-4-2-7-4.8-7-9V6z" strokeLinejoin="round" /></svg>,
  document: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h7l5 5v13H6z" strokeLinejoin="round" /><path d="M13 3v5h5M9 13h6M9 16.5h6" strokeLinecap="round" /></svg>,
  chat: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16v11H9l-4 4v-4H4z" strokeLinejoin="round" /></svg>,
};

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M6 3l5 5-5 5" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── ROW + SECTION ──────────────────────────────────────────
function Row({ icon, label, onClick, right, isLast }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%',
        padding: '14px 0', boxSizing: 'border-box',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span style={{ width: 32, height: 32, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1, fontWeight: 500, fontSize: 15, color: 'var(--text-primary)' }}>{label}</span>
      {right !== undefined ? right : <Chevron />}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: 'normal', color: 'var(--text-primary)', padding: '16px 20px 8px', margin: 0 }}>
        {title}
      </p>
      <div className="card-flat" style={{ margin: '0 16px', padding: '0 20px', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

// ─── THEME BOTTOM SHEET ─────────────────────────────────────
function ThemeSheet({ open, onClose, theme, setTheme }) {
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

  const options = [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'System' }];

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', opacity: shown ? 1 : 0, transition: 'opacity 0.28s ease', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onTransitionEnd={() => { if (!shown) setMounted(false); }}
        style={{
          width: '100%', maxWidth: 480, background: 'var(--card)', borderRadius: '20px 20px 0 0',
          transform: shown ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', padding: '10px 0 32px',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 8px' }} />
        <p style={{ textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 12px' }}>App Appearance</p>
        {options.map(opt => (
          <div key={opt.id}
            onClick={() => { setTheme(opt.id); onClose(); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 24px', cursor: 'pointer' }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{opt.label}</span>
            {theme === opt.id && (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10l4 4 8-8" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}

// ─── PROFILE ────────────────────────────────────────────────
export default function Profile({ onOpenGoals = () => {}, onOpenAccount = () => {}, onOpenSubscription = () => {}, onOpenUnits = () => {}, onOpenEditDashboard = () => {}, onOpenPrivacy = () => {}, onOpenTerms = () => {}, onOpenHabits = () => {}, onOpenMeasurements = () => {}, user, theme, setTheme, metricSystem }) {
  const [toast, setToast] = useState('');
  const [themeOpen, setThemeOpen] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const comingSoon = () => {
    setToast('Coming soon');
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  };

  // Display name = the first name set at signup (user metadata) if present, else
  // the part of the email before "@", capitalized. Falls back to "User".
  const metaName = user?.user_metadata?.first_name;
  const emailLocalPart = user?.email ? user.email.split('@')[0] : '';
  const displayName = metaName
    ? metaName
    : emailLocalPart
      ? emailLocalPart.charAt(0).toUpperCase() + emailLocalPart.slice(1)
      : 'User';

  // "Baseline member since <Month Year>" from the account creation date, or just
  // "Baseline member" when no creation date is available.
  const memberSince = user?.created_at
    ? `Baseline member since ${new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
    : 'Baseline member';

  return (
    <div style={{ paddingTop: 32, paddingBottom: 100 }}>

      {/* Profile header — flush with the background (no card behind it) */}
      <div style={{ margin: '0 16px 16px', padding: '0 4px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6.5 8-6.5s8 2.5 8 6.5" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{displayName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{memberSince}</div>
          <span style={{ display: 'inline-block', marginTop: 8, fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#3B82F6', padding: '3px 10px', borderRadius: 20 }}>
            Free
          </span>
        </div>
      </div>

      {/* ACCOUNT */}
      <Section title="Account">
        <Row icon={ICONS.person} label="Account Information" onClick={onOpenAccount} />
        <Row icon={ICONS.crown} label="Subscription" onClick={onOpenSubscription} />
        <Row icon={ICONS.download} label="Data & Export" onClick={comingSoon} isLast />
      </Section>

      {/* PREFERENCES */}
      <Section title="Preferences">
        <Row icon={ICONS.ruler} label="Units" onClick={onOpenUnits} right={
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{metricSystem === 'metric' ? 'Metric' : 'Imperial'}</span>
            <Chevron />
          </span>
        } />
        <Row icon={ICONS.target} label="Goals" onClick={onOpenGoals} />
        <Row icon={ICONS.habit} label="Daily Habits" onClick={onOpenHabits} />
        <Row icon={ICONS.measure} label="Measurements" onClick={onOpenMeasurements} />
        <Row icon={ICONS.dumbbell} label="Workout Preferences" onClick={comingSoon} />
        <Row icon={ICONS.appearance} label="App Appearance" onClick={() => setThemeOpen(true)} />
        <Row icon={ICONS.grid} label="Edit Dashboard" onClick={onOpenEditDashboard} isLast />
      </Section>

      {/* SUPPORT */}
      <Section title="Support">
        <Row icon={ICONS.question} label="Help Center" onClick={comingSoon} />
        <Row icon={ICONS.shield} label="Privacy Policy" onClick={onOpenPrivacy} />
        <Row icon={ICONS.document} label="Terms of Service" onClick={onOpenTerms} />
        <Row icon={ICONS.chat} label="Feedback" onClick={comingSoon} isLast />
      </Section>

      {/* Sign Out — App.js redirects to AuthScreen via the onAuthStateChange listener */}
      <button
        onClick={() => supabase.auth.signOut()}
        style={{
          display: 'block', width: 'calc(100% - 32px)', margin: '24px 16px 0',
          padding: '14px', background: 'transparent', border: '1px solid var(--border)',
          borderRadius: 12, color: '#EF4444', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Sign Out
      </button>

      <ThemeSheet open={themeOpen} onClose={() => setThemeOpen(false)} theme={theme} setTheme={setTheme} />

      {/* Coming-soon toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'var(--text-primary)', color: 'var(--card)', padding: '10px 18px', borderRadius: 20, fontSize: 14, fontWeight: 600, zIndex: 800, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
