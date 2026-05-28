import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import Workouts from './Workouts';
import ExerciseDatabase from './ExerciseDatabase';
import Measurements from './Measurements';

const TABS = ['Routines', 'Exercises', 'Measurements', 'History'];

const APP_TAB_MAP = {
  'workout-exercises': 'Exercises',
  'workout-measurements': 'Measurements',
  'workout-history': 'History',
  'workout-start': 'Routines',
};

function WorkoutHome({
  activeWorkout,
  setActiveWorkout,
  workoutSeconds,
  workoutExpanded,
  onCollapse,
  onWorkoutStart,
  onExpand,
  showToast,
  resetKey,
  metricSystem,
  appActiveTab,
}) {
  const [tab, setTab] = useState(APP_TAB_MAP[appActiveTab] || 'Routines');
  const [weekStats, setWeekStats] = useState({ workouts: 0, volume: 0, duration: 0 });

  useEffect(() => {
    const mapped = APP_TAB_MAP[appActiveTab];
    if (mapped) setTab(mapped);
  }, [appActiveTab]);

  useEffect(() => {
    if (workoutExpanded) setTab('Routines');
  }, [workoutExpanded]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadWeekStats(); }, []);

  const loadWeekStats = async () => {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);

    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id, duration')
      .gte('created_at', monday.toISOString());

    if (!sessions || sessions.length === 0) return;

    const { data: sessionEx } = await supabase
      .from('session_exercises')
      .select('sets')
      .in('session_id', sessions.map(s => s.id));

    const volume = (sessionEx || []).reduce((total, e) => {
      const sets = Array.isArray(e.sets) ? e.sets
        : (typeof e.sets === 'string' ? JSON.parse(e.sets) : []);
      return total + sets.reduce((sum, s) =>
        sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);
    }, 0);

    setWeekStats({
      workouts: sessions.length,
      duration: sessions.reduce((sum, s) => sum + (Number(s.duration) || 0), 0),
      volume,
    });
  };

  const fmtDuration = (secs) => {
    const m = Math.round(secs / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const fmtVolume = (lbs) => Math.round(lbs).toLocaleString();

  const workoutProps = {
    activeWorkout,
    setActiveWorkout,
    workoutSeconds,
    workoutExpanded,
    onCollapse,
    onWorkoutStart,
    onExpand,
    showToast,
  };

  const stats = [
    { value: String(weekStats.workouts), label: 'Workouts' },
    { value: weekStats.duration > 0 ? fmtDuration(weekStats.duration) : '0m', label: 'Duration' },
    { value: weekStats.volume > 0 ? `${fmtVolume(weekStats.volume)} lbs` : '0', label: 'Volume' },
  ];

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Weekly stats card */}
      <div style={{ padding: '16px 20px 0' }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
            This Week
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {stats.map(({ value, label }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '3px' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab pills */}
      <div style={{ display: 'flex', gap: '8px', padding: '12px 20px 4px', overflowX: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: tab === t ? 'none' : '1px solid var(--border)',
              background: tab === t ? 'var(--accent)' : 'var(--card)',
              color: tab === t ? 'white' : 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: tab === t ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Routines' && (
        <Workouts key="wh-routines" resetKey={resetKey} {...workoutProps} />
      )}
      {tab === 'Exercises' && <ExerciseDatabase />}
      {tab === 'Measurements' && <Measurements metricSystem={metricSystem} />}
      {tab === 'History' && (
        <Workouts key="wh-history" initialView="history" {...workoutProps} />
      )}
    </div>
  );
}

export default WorkoutHome;
