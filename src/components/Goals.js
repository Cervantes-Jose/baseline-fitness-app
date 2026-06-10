import { useState } from 'react';
import NutritionGoals from './NutritionGoals';

// Goals shell: shared header + Nutrition / Body tab switcher. Each tab owns its own
// data and Edit/Save flow. Body tab is built in a later phase.
function Goals({ onGoalsUpdate = () => {}, onBack = () => {} }) {
  const [tab, setTab] = useState('nutrition');

  // Individual rounded pills matching the Workout tabs (inactive = light grey, active
  // = accent), just larger since there are only two.
  const pill = (id, label) => (
    <button onClick={() => setTab(id)}
      className={tab === id ? '' : 'goals-pill-inactive'}
      style={{
        flex: 1, padding: '11px 0', borderRadius: 22, border: 'none', cursor: 'pointer',
        fontSize: 15, fontWeight: 600,
        background: tab === id ? 'var(--accent)' : undefined,
        color: tab === id ? '#fff' : 'var(--text-primary)',
        transition: 'background 0.15s, color 0.15s',
      }}>
      {label}
    </button>
  );

  return (
    <div className="content" style={{ paddingBottom: 120 }}>
      <style>{`
        .goals-pill-inactive { background: #F3F4F6; }
        [data-theme="dark"] .goals-pill-inactive { background: var(--border); }
      `}</style>

      <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 4px' }}>Set targets and track your progress.</p>

      {/* Back to Profile */}
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: '0 0 4px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back
      </button>

      {/* Nutrition / Body switcher */}
      <div style={{ display: 'flex', gap: 8 }}>
        {pill('nutrition', 'Nutrition')}
        {pill('body', 'Body')}
      </div>

      {tab === 'nutrition' ? (
        <NutritionGoals onGoalsUpdate={onGoalsUpdate} />
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          Body goals coming soon.
        </div>
      )}
    </div>
  );
}

export default Goals;
