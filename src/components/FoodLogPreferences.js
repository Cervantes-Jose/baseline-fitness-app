// Food Log display preferences. All client-side view prefs (no security impact):
//   - autoCollapse: whether the food log's time blocks START collapsed
//   - timeFormat: '12h' | '24h', how hours/blocks are labelled
// Persisted in localStorage by App.js (like theme / metricSystem).

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

// iOS-style switch.
function Toggle({ on, onChange }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)}
      style={{
        width: 46, height: 28, borderRadius: 14, border: 'none', padding: 0, flexShrink: 0, cursor: 'pointer',
        background: on ? 'var(--accent)' : 'var(--border)', position: 'relative', transition: 'background 0.2s',
      }}>
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s',
      }} />
    </button>
  );
}

export default function FoodLogPreferences({ autoCollapse = false, setAutoCollapse = () => {}, timeFormat = '12h', setTimeFormat = () => {} }) {
  return (
    <div style={{ paddingTop: 4, paddingBottom: 100 }}>
      {/* TIME BLOCKS */}
      <Section title="Time Blocks">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 0' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Auto-collapse hours</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.4 }}>
              Start the food log with time blocks collapsed. Turn off to keep them expanded by default.
            </div>
          </div>
          <Toggle on={autoCollapse} onChange={setAutoCollapse} />
        </div>
      </Section>

      {/* TIME FORMAT */}
      <Section title="Time Format">
        <OptionRow label="12-hour (12 AM – 5 AM)" selected={timeFormat === '12h'} onClick={() => setTimeFormat('12h')} />
        <OptionRow label="24-hour (00:00 – 05:59)" selected={timeFormat === '24h'} onClick={() => setTimeFormat('24h')} isLast />
      </Section>

      <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', margin: '12px 20px 0', lineHeight: 1.4 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" strokeLinecap="round" /></svg>
        These preferences only affect how your food log is displayed.
      </p>
    </div>
  );
}
