import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import DeleteAccountModal from './DeleteAccountModal';

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
  // View mode by default: rows are locked (no chevrons, not tappable). The Edit
  // Profile button flips this on so fields become editable.
  const [editMode, setEditMode] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
      if (error) { return; }
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
    if (error) { showToast('Could not save'); }
  };

  // Name lives in auth user_metadata. App.user refreshes via the onAuthStateChange
  // USER_UPDATED listener, so the Dashboard greeting / Profile header update too.
  const saveName = async (value) => {
    const v = (value || '').trim();
    if (!v) return;
    const { error } = await supabase.auth.updateUser({ data: { first_name: v } });
    if (error) { showToast('Could not save name'); }
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
  // Read-only: when the account was created, e.g. "June 2026". Never editable.
  const joinedDisplay = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div style={{ paddingTop: 4, paddingBottom: 100 }}>
      {/* Back to Profile */}
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: '4px 12px 8px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Profile
      </button>

      {/* Centered, enlarged avatar with a camera badge for changing the photo.
          Photo upload is deferred (needs storage), so the badge toasts for now. */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 24px' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6.5 8-6.5s8 2.5 8 6.5" strokeLinecap="round" />
            </svg>
          </div>
          <div onClick={photoComingSoon} style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', border: '3px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </div>
        </div>
      </div>

      {/* All fields live on a single tile (mockup order). Email + Joined stay
          read-only in every mode; the rest unlock when Edit Profile is on. */}
      <div className="card-flat" style={{ margin: '0 16px', padding: '0 20px', overflow: 'hidden' }}>
        <ValueRow label="Name" value={firstName} placeholder="Your name" readOnly={!editMode}
          onClick={() => setEditing({ key: 'name', label: 'Name', value: firstName, placeholder: 'Your name' })} />
        <ValueRow label="Email" value={email} placeholder="No email" readOnly />
        <ValueRow label="Date of Birth" value={dobDisplay} readOnly={!editMode}
          onClick={() => setEditing({ key: 'dob', label: 'Date of Birth', value: profile.dob, inputType: 'date' })} />
        <ValueRow label="Gender" value={profile.gender} readOnly={!editMode}
          onClick={() => setEditing({ key: 'gender', label: 'Gender', value: profile.gender, options: GENDER_OPTIONS })} />
        <ValueRow label="Height" value={profile.height ? `${profile.height} ${heightUnit}` : ''} readOnly={!editMode}
          onClick={() => setEditing({ key: 'height', label: `Height (${heightUnit})`, value: profile.height, inputType: 'number', inputMode: 'decimal', placeholder: heightUnit })} />
        <ValueRow label="Joined" value={joinedDisplay} placeholder="—" readOnly isLast />
      </div>

      {/* Edit Profile toggles the rows between locked (view) and editable. */}
      <div style={{ padding: '8px 16px 0' }}>
        <button onClick={() => setEditMode(e => !e)} className="btn-primary">
          {editMode ? 'Done' : 'Edit Profile'}
        </button>
      </div>

      {/* Danger zone — permanent account deletion (handled server-side) */}
      <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#EF4444', padding: '28px 20px 8px', margin: 0 }}>
        Danger Zone
      </p>
      <div className="card-flat" style={{ margin: '0 16px', padding: '0 20px', border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.06)' }}>
        <button
          onClick={() => setDeleteOpen(true)}
          style={{
            display: 'block', width: '100%', padding: '15px 0', background: 'transparent',
            border: 'none', color: '#EF4444', fontSize: 15, fontWeight: 700, textAlign: 'center', cursor: 'pointer',
          }}
        >
          Delete Account
        </button>
      </div>

      <EditSheet field={editing} onClose={() => setEditing(null)} onSave={saveField} />
      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />

      {toast && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'var(--text-primary)', color: 'var(--card)', padding: '10px 18px', borderRadius: 20, fontSize: 14, fontWeight: 600, zIndex: 800, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
