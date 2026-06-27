import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fmtNum } from './prMath';

// Post-workout celebration screen. Pops up centered after a workout is saved,
// styled like the history/PR detail cards. Shows:
//   - a subtle blue shimmer glow at the top
//   - "Workout Complete!" / "Great Work"
//   - an expandable card with the routine name + completed/total exercises;
//     expanded, it lists every exercise and its logged sets (scrollable)
//   - any new weight PRs as "prev → next"
//   - a Finish button to dismiss
// `summary` is built in Workouts.confirmFinishWorkout:
//   { routineName, completedCount, totalCount, exercises: [{name, completed, sets}], prs, unit }
function WorkoutSummary({ summary, metricSystem = 'imperial', onFinish = () => {} }) {
  const [shown, setShown] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { routineName, completedCount, totalCount, exercises = [], prs = [] } = summary;
  const unit = summary.unit || (metricSystem === 'metric' ? 'kg' : 'lbs');

  // Fade/scale in on mount; lock background scroll while open (same pattern as
  // PersonalRecordDetail).
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(id); document.body.style.overflow = prev; };
  }, []);

  const checkIcon = (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="7" fill="var(--accent)" />
      <path d="M4 7l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      opacity: shown ? 1 : 0, transition: 'opacity 0.28s ease',
    }}>
      <style>{`@keyframes wsGlow {
        0%   { transform: translateX(-62%) translateY(-10px) scale(0.92); opacity: 0.55; }
        50%  { transform: translateX(-38%) translateY(6px)   scale(1.18); opacity: 1; }
        100% { transform: translateX(-62%) translateY(-10px) scale(0.92); opacity: 0.55; }
      }`}</style>
      <div style={{
        width: '100%', maxWidth: '380px', maxHeight: '86vh',
        background: 'var(--card)', borderRadius: '20px', border: '1px solid var(--border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', position: 'relative',
        display: 'flex', flexDirection: 'column',
        transform: shown ? 'none' : 'translateY(16px) scale(0.96)',
        transition: 'transform 0.34s cubic-bezier(0.32,0.72,0,1), opacity 0.28s ease',
      }}>
        {/* Blue glow at the top — a soft accent pool that gently drifts/breathes,
            like a subtle sun ray. No sweeping wave. */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '130px', pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: '-70px', left: '50%',
            width: '150%', height: '150px',
            background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.48), rgba(59,130,246,0) 70%)',
            animation: 'wsGlow 4.5s ease-in-out infinite',
          }} />
        </div>

        {/* Header */}
        <div style={{ padding: '30px 20px 14px', textAlign: 'center', position: 'relative', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '23px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>
            Workout Complete!
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>Great Work</p>
        </div>

        {/* Scrollable body — minHeight:0 lets this flex child shrink below its content
            height so overflow-y:auto actually scrolls (without it the expanded exercise
            list grows the body and the card just clips it). */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Card 1: routine name + completed/total, expandable */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
            <div onClick={() => setExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', cursor: 'pointer' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{routineName}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Tap to {expanded ? 'hide' : 'view'} details</div>
              </div>
              <span style={{ flexShrink: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {completedCount}/{totalCount} exercises
              </span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease', color: 'var(--text-muted)' }}>
                <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {expanded && (
              <div style={{ padding: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {exercises.map((ex, i) => (
                  <div key={i} style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                      {ex.completed && checkIcon}
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{ex.name}</span>
                    </div>
                    {ex.sets.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No sets completed</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {ex.sets.map((s, si) => (
                          <div key={si} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', padding: '7px 10px', background: 'var(--card)', borderRadius: '8px' }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Set {si + 1}</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{fmtNum(s.weight || 0)} {unit} × {s.reps || 0}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* New PRs */}
          {prs.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '4px 4px 8px' }}>
                New Personal Records
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {prs.map((pr, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.name}</span>
                    <span style={{ flexShrink: 0, fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{fmtNum(pr.prev)}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
                      <span style={{ color: '#22C55E' }}>{fmtNum(pr.next)} {unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Finish */}
        <div style={{ padding: '12px 16px 18px', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
          <button onClick={onFinish} className="btn-primary" style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 700 }}>
            Finish
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default WorkoutSummary;
