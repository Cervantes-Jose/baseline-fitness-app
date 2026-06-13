import { useState, useRef, useEffect } from 'react';

// Subscription is DISPLAY-ONLY for now. None of these actions are wired to a
// payment provider or to any subscription state. Per the project security rules,
// when this becomes functional the plan/entitlement status must live server-side
// and never be client-writable — the hardcoded "Free Plan" here is just UI.

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M6 3l5 5-5 5" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Filled accent check used in the perks list.
const CheckFilled = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="10" cy="10" r="9" fill="var(--accent)" />
    <path d="M6 10l2.6 2.6L14 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PREMIUM_PERKS = [
  'Advanced analytics',
  'Custom workout plans',
  'Progress photos',
  'Priority support',
  'And more…',
];

const MANAGE_ROWS = ['Manage Subscription', 'Restore Purchases', 'Payment History'];

export default function Subscription() {
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const comingSoon = () => {
    setToast('Coming soon');
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  };

  return (
    <div style={{ paddingTop: 4, paddingBottom: 100 }}>
      {/* Current plan */}
      <div className="card-flat" style={{ margin: '0 16px 16px', padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M3 7l4.5 4L12 5l4.5 6L21 7v11H3z" strokeLinejoin="round" strokeLinecap="round" /></svg>
        </div>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Free Plan</span>
        <span style={{ fontSize: 12, fontWeight: 700, background: 'var(--accent-light)', color: 'var(--accent)', padding: '4px 12px', borderRadius: 20 }}>Current Plan</span>
      </div>

      {/* Upgrade */}
      <div className="card-flat" style={{ margin: '0 16px 16px', padding: 20 }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>Upgrade to Premium</p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 18px' }}>Unlock all features and tools.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 22 }}>
          {PREMIUM_PERKS.map(perk => (
            <div key={perk} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <CheckFilled />
              <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{perk}</span>
            </div>
          ))}
        </div>
        <button onClick={comingSoon} className="btn-primary">Subscribe to Premium</button>
      </div>

      {/* Manage */}
      <div className="card-flat" style={{ margin: '0 16px', padding: '0 20px', overflow: 'hidden' }}>
        {MANAGE_ROWS.map((label, i) => (
          <div key={label} onClick={comingSoon}
            style={{ display: 'flex', alignItems: 'center', padding: '15px 0', borderBottom: i === MANAGE_ROWS.length - 1 ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
            <Chevron />
          </div>
        ))}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'var(--text-primary)', color: 'var(--card)', padding: '10px 18px', borderRadius: 20, fontSize: 14, fontWeight: 600, zIndex: 800, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
