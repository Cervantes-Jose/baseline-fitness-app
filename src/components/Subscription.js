import { useState, useRef, useEffect } from 'react';
import SettingsPageHeader from './SettingsPageHeader';

// Subscription is DISPLAY-ONLY for now. None of these actions are wired to a
// payment provider or to any subscription state. Per the project security rules,
// when this becomes functional the plan/entitlement status must live server-side
// and never be client-writable — the `isPremium` flag below is just UI.

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M6 3l5 5-5 5" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// White check used in the gradient plan card's feature list.
const Check = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
    <path d="M4 10l3.4 3.4L16 5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Plan presentation. Each plan shows three headline features in the gradient card.
const PLANS = {
  free: {
    name: 'Free Plan',
    price: '$0',
    features: ['Up to 3 routines', 'Food tracking', 'Measurement tracking'],
  },
  premium: {
    name: 'Premium Plan',
    price: '$7.99',
    features: ['Barcode scanner', 'Custom measurements', 'Unlimited routines'],
  },
};

const MANAGE_ROWS = ['Manage Subscription', 'Restore Purchases', 'Payment History'];

export default function Subscription({ onBack = () => {} }) {
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  // Placeholder entitlement — swap for server-side subscription status when wired up.
  const isPremium = false;
  const plan = isPremium ? PLANS.premium : PLANS.free;

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const comingSoon = () => {
    setToast('Coming soon');
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  };

  return (
    <div style={{ paddingBottom: 100 }}>
      <SettingsPageHeader title="Subscription" onBack={onBack} />

      {/* Combined current-plan card: three-blue gradient (top-left → bottom-right),
          a grey "Current Plan" pill, the plan name + monthly price, and the three
          headline features for whichever plan the user is on. */}
      <div style={{
        margin: '4px 16px 16px', padding: 22, borderRadius: 16, color: '#fff',
        background: 'linear-gradient(145deg, var(--blue-400) 0%, var(--blue-500) 48%, var(--blue-600) 100%)',
        boxShadow: '0 8px 24px rgba(5,79,247,0.28)',
      }}>
        <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, background: '#E8EAED', color: '#4B5563', padding: '4px 12px', borderRadius: 20, marginBottom: 16 }}>
          Current Plan
        </span>
        <p style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>{plan.name}</p>
        <p style={{ fontSize: 16, margin: '4px 0 18px', color: 'rgba(255,255,255,0.85)' }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{plan.price}</span> / month
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {plan.features.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Check />
              <span style={{ fontSize: 15, fontWeight: 500 }}>{f}</span>
            </div>
          ))}
        </div>

        {/* White subscribe tile, nested inside the gradient card — blue text;
            becomes a non-actionable "Premium Member" label once on Premium. */}
        <button
          onClick={isPremium ? undefined : comingSoon}
          disabled={isPremium}
          style={{ display: 'block', width: '100%', marginTop: 20, padding: '15px 0', background: '#fff', border: 'none', borderRadius: 12, color: 'var(--accent)', fontSize: 16, fontWeight: 700, textAlign: 'center', cursor: isPremium ? 'default' : 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
        >
          {isPremium ? 'Premium Member' : 'Subscribe to Premium'}
        </button>
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
