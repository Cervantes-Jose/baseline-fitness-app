import { useState, useRef, useEffect } from 'react';

// Units is driven by the single app-wide `metricSystem` ('imperial' | 'metric').
// Weight and Height both reflect that one setting (they switch together). Energy is
// kcal-only for now — the kJ option is shown for parity with the design but toasts
// "Coming soon" rather than persisting, since the app has no kJ conversion yet.

const Check = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
    <path d="M4 10l4 4 8-8" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
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

// label + checkmark when selected. Taps select the option.
function OptionRow({ label, selected, onClick, isLast }) {
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', padding: '15px 0', borderBottom: isLast ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
      {selected && <Check />}
    </div>
  );
}

export default function Units({ onBack = () => {}, metricSystem = 'imperial', setMetricSystem = () => {} }) {
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const comingSoon = () => {
    setToast('Coming soon');
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  };

  const isImperial = metricSystem === 'imperial';

  return (
    <div style={{ paddingTop: 4, paddingBottom: 100 }}>
      {/* Back to Profile */}
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: '4px 12px 8px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Profile
      </button>

      {/* WEIGHT */}
      <Section title="Weight">
        <OptionRow label="Imperial (lbs)" selected={isImperial} onClick={() => setMetricSystem('imperial')} />
        <OptionRow label="Metric (kg)" selected={!isImperial} onClick={() => setMetricSystem('metric')} isLast />
      </Section>

      {/* HEIGHT */}
      <Section title="Height">
        <OptionRow label="Imperial (ft/in)" selected={isImperial} onClick={() => setMetricSystem('imperial')} />
        <OptionRow label="Metric (cm)" selected={!isImperial} onClick={() => setMetricSystem('metric')} isLast />
      </Section>

      {/* ENERGY / CALORIES */}
      <Section title="Energy / Calories">
        <OptionRow label="Calories (kcal)" selected onClick={() => {}} />
        <OptionRow label="Kilojoules (kJ)" selected={false} onClick={comingSoon} isLast />
      </Section>

      <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', margin: '12px 20px 0', lineHeight: 1.4 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" strokeLinecap="round" /></svg>
        These units will be used throughout the app.
      </p>

      {toast && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'var(--text-primary)', color: 'var(--card)', padding: '10px 18px', borderRadius: 20, fontSize: 14, fontWeight: 600, zIndex: 800, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
