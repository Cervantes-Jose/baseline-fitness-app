import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';

// Account fields are per-user: Name lives in Supabase auth user_metadata
// (`first_name`), Email is the read-only auth login email, and Gender/DOB/Height
// live in the `profiles` table (one row per user, RLS-scoped to auth.uid()).
// Profile-photo upload is deferred (needs storage); the row toasts for now.

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M6 3l5 5-5 5" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '16px 20px 8px', margin: 0 }}>
        {title}
      </p>
      <div className="card-flat" style={{ margin: '0 16px', padding: '0 20px', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

// label + current value + chevron (taps to edit). Value greys out as a placeholder
// when unset.
function ValueRow({ label, value, placeholder, onClick, isLast, readOnly }) {
  const empty = value == null || value === '';
  return (
    <div onClick={readOnly ? undefined : onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: isLast ? 'none' : '1px solid var(--border)', cursor: readOnly ? 'default' : 'pointer' }}>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
      <span style={{ fontSize: 15, color: empty ? 'var(--text-muted)' : 'var(--text-secondary)', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {empty ? (placeholder || 'Not set') : value}
      </span>
      {!readOnly && <Chevron />}
    </div>
  );
}

// ─── EDIT SHEET ─────────────────────────────────────────────
// One bottom sheet for all fields. `field` (null = closed) describes what to edit;
// `options` makes it a tap-to-pick list, otherwise it's a single input + Save.
function EditSheet({ field, onClose, onSave }) {
  const [active, setActive] = useState(field);
  const [shown, setShown] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (field) {
      setActive(field);
      setDraft(field.value ?? '');
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
  }, [field]);

  if (!active) return null;

  const isOptions = !!active.options;

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', opacity: shown ? 1 : 0, transition: 'opacity 0.28s ease', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onTransitionEnd={() => { if (!shown) setActive(null); }}
        style={{
          width: '100%', maxWidth: 480, background: 'var(--card)', borderRadius: '20px 20px 0 0',
          transform: shown ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', padding: '10px 20px 32px',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 12px' }} />
        <p style={{ textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px' }}>{active.label}</p>

        {isOptions ? (
          <div>
            {active.options.map(opt => (
              <div key={opt}
                onClick={() => { onSave(active.key, opt); onClose(); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px', cursor: 'pointer', borderBottom: opt === active.options[active.options.length - 1] ? 'none' : '1px solid var(--border)' }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{opt}</span>
                {active.value === opt && (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            <input
              autoFocus
              type={active.inputType || 'text'}
              inputMode={active.inputMode}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { onSave(active.key, draft); onClose(); } }}
              placeholder={active.placeholder}
              className="input"
              style={{ marginBottom: 16, textAlign: active.inputType === 'date' ? 'left' : 'center' }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={() => { onSave(active.key, draft); onClose(); }} className="btn-primary" style={{ flex: 1 }}>Save</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── ACCOUNT INFORMATION ────────────────────────────────────
export default function AccountInformation({ onBack = () => {}, user = null, metricSystem = 'imperial' }) {
  // gender/dob/height come from this user's `profiles` row; name + email come from auth.
  const [profile, setProfile] = useState({ gender: '', dob: '', height: '' });
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const uid = user?.id;
  const firstName = user?.user_metadata?.first_name || '';
  const email = user?.email || '';

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Load this user's profile fields. RLS guarantees only their own row is returned.
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('gender, dob, height')
        .eq('user_id', uid)
        .maybeSingle();
      if (cancelled) return;
      if (error) { console.error(error); return; }
      if (data) {
        setProfile({
          gender: data.gender || '',
          dob: data.dob || '',
          height: data.height != null ? String(data.height) : '',
        });
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  };

  // Upsert gender/dob/height into the user's single profiles row (unique on user_id).
  const saveProfile = async (key, value) => {
    if (!uid) return;
    const v = typeof value === 'string' ? value.trim() : value;
    const next = { ...profile, [key]: v };
    setProfile(next);
    const { error } = await supabase.from('profiles').upsert({
      user_id: uid,
      gender: next.gender || null,
      dob: next.dob || null,
      height: next.height === '' ? null : Number(next.height),
    }, { onConflict: 'user_id' });
    if (error) { console.error(error); showToast('Could not save'); }
  };

  // Name lives in auth user_metadata. App.user refreshes via the onAuthStateChange
  // USER_UPDATED listener, so the Dashboard greeting / Profile header update too.
  const saveName = async (value) => {
    const v = (value || '').trim();
    if (!v) return;
    const { error } = await supabase.auth.updateUser({ data: { first_name: v } });
    if (error) { console.error(error); showToast('Could not save name'); }
  };

  const saveField = (key, value) => {
    if (key === 'name') { saveName(value); return; }
    saveProfile(key, value);
  };

  const photoComingSoon = () => showToast('Coming soon');

  const heightUnit = metricSystem === 'metric' ? 'cm' : 'in';
  const dobDisplay = profile.dob
    ? new Date(profile.dob + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div style={{ paddingTop: 4, paddingBottom: 100 }}>
      {/* Back to Profile */}
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: '4px 12px 8px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Profile
      </button>

      {/* PROFILE */}
      <Section title="Profile">
        <div onClick={photoComingSoon} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6.5 8-6.5s8 2.5 8 6.5" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Profile Photo</span>
          <Chevron />
        </div>
        <ValueRow label="Name" value={firstName} placeholder="Your name"
          onClick={() => setEditing({ key: 'name', label: 'Name', value: firstName, placeholder: 'Your name' })} />
        <ValueRow label="Email" value={email} placeholder="No email" readOnly isLast />
      </Section>

      {/* PERSONAL */}
      <Section title="Personal">
        <ValueRow label="Gender" value={profile.gender}
          onClick={() => setEditing({ key: 'gender', label: 'Gender', value: profile.gender, options: GENDER_OPTIONS })} />
        <ValueRow label="Date of Birth" value={dobDisplay}
          onClick={() => setEditing({ key: 'dob', label: 'Date of Birth', value: profile.dob, inputType: 'date' })} />
        <ValueRow label="Height" value={profile.height ? `${profile.height} ${heightUnit}` : ''} isLast
          onClick={() => setEditing({ key: 'height', label: `Height (${heightUnit})`, value: profile.height, inputType: 'number', inputMode: 'decimal', placeholder: heightUnit })} />
      </Section>

      <EditSheet field={editing} onClose={() => setEditing(null)} onSave={saveField} />

      {toast && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'var(--text-primary)', color: 'var(--card)', padding: '10px 18px', borderRadius: 20, fontSize: 14, fontWeight: 600, zIndex: 800, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
