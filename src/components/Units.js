// Units is driven by the single app-wide `metricSystem` ('imperial' | 'metric').
// Weight reflects that one setting. (Height and Energy/Calories sections were removed —
// the app currently only acts on the weight unit.)

const Check = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
    <path d="M4 10l4 4 8-8" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: 'normal', color: 'var(--text-primary)', padding: '16px 20px 8px', margin: 0 }}>
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

export default function Units({ metricSystem = 'imperial', setMetricSystem = () => {} }) {
  const isImperial = metricSystem === 'imperial';

  return (
    <div style={{ paddingTop: 4, paddingBottom: 100 }}>
      {/* WEIGHT */}
      <Section title="Weight">
        <OptionRow label="Imperial (lbs)" selected={isImperial} onClick={() => setMetricSystem('imperial')} />
        <OptionRow label="Metric (kg)" selected={!isImperial} onClick={() => setMetricSystem('metric')} isLast />
      </Section>

      <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', margin: '12px 20px 0', lineHeight: 1.4 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" strokeLinecap="round" /></svg>
        These units will be used throughout the app.
      </p>
    </div>
  );
}
