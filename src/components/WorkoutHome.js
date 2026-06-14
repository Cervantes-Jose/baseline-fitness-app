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
  workoutPaused,
  onTogglePause,
  appActiveTab,
  activeRest,
  restRemaining,
  completedRest,
  onStartRest,
  onSkipRest,
}) {
  const [tab, setTab] = useState(APP_TAB_MAP[appActiveTab] || 'Routines');
  const [weekStats, setWeekStats] = useState({ workouts: 0, volume: 0, duration: 0 });
  const [prevWeekStats, setPrevWeekStats] = useState(null);

  useEffect(() => {
    const mapped = APP_TAB_MAP[appActiveTab];
    if (mapped) setTab(mapped);
  }, [appActiveTab]);

  useEffect(() => {
    if (workoutExpanded) setTab('Routines');
  }, [workoutExpanded]);

  // Reload when a workout finishes (activeWorkout flips back to null), as well as on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadWeekStats(); }, [activeWorkout]);

  const loadWeekStats = async () => {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    const prevMonday = new Date(monday);
    prevMonday.setDate(monday.getDate() - 7);

    // Pull both this week and last week in one query, then split by date
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id, duration, created_at')
      .eq('user_id', uid)
      .gte('created_at', prevMonday.toISOString());

    if (!sessions) return;

    const allIds = sessions.map(s => s.id);
    const { data: sessionEx } = allIds.length
      ? await supabase.from('session_exercises').select('sets, session_id').eq('user_id', uid).in('session_id', allIds)
      : { data: [] };

    const volumeFor = (ids) => (sessionEx || [])
      .filter(e => ids.has(e.session_id))
      .reduce((total, e) => {
        const sets = Array.isArray(e.sets) ? e.sets
          : (typeof e.sets === 'string' ? JSON.parse(e.sets) : []);
        return total + sets.reduce((sum, s) =>
          sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);
      }, 0);

    const statsFor = (sess) => {
      const ids = new Set(sess.map(s => s.id));
      return {
        workouts: sess.length,
        duration: sess.reduce((sum, s) => sum + (Number(s.duration) || 0), 0),
        volume: volumeFor(ids),
      };
    };

    const currentSessions = sessions.filter(s => new Date(s.created_at) >= monday);
    const prevSessions = sessions.filter(s => new Date(s.created_at) < monday);

    setWeekStats(statsFor(currentSessions));
    setPrevWeekStats(prevSessions.length > 0 ? statsFor(prevSessions) : null);
  };

  const fmtDuration = (secs) => {
    const m = Math.round(secs / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const fmtVolume = (lbs) => Math.round(lbs).toLocaleString();

  // Build the "+X from last week" comparison line for a stat. When there's no
  // previous-week data yet (e.g. new users), we fall back to "+0 from last week"
  // so the line still shows and signals that it will populate over time.
  const zeroDelta = { text: '+0 from last week', color: 'var(--accent)' };
  const deltaInfo = (diff, fmt) => {
    if (diff === 0) return { text: 'Same as last week', color: 'var(--text-muted)' };
    const positive = diff > 0;
    return {
      text: `${positive ? '+' : '-'}${fmt(Math.abs(diff))} from last week`,
      color: positive ? '#22C55E' : '#EF4444',
    };
  };

  // The collapsed active-workout bar (rendered globally in App) overlaps the bottom of the
  // screen; lift the FAB above it when it's showing.
  const workoutBarVisible = !!activeWorkout && !workoutExpanded;

  const workoutProps = {
    activeWorkout,
    setActiveWorkout,
    workoutSeconds,
    workoutExpanded,
    onCollapse,
    onWorkoutStart,
    onExpand,
    showToast,
    metricSystem,
    workoutPaused,
    onTogglePause,
    activeRest,
    restRemaining,
    completedRest,
    onStartRest,
    onSkipRest,
  };

  const stats = [
    {
      value: String(weekStats.workouts),
      label: 'Workouts',
      delta: prevWeekStats ? deltaInfo(weekStats.workouts - prevWeekStats.workouts, n => String(n)) : zeroDelta,
    },
    {
      value: weekStats.duration > 0 ? fmtDuration(weekStats.duration) : '0m',
      label: 'Duration',
      delta: prevWeekStats ? deltaInfo(Math.round(weekStats.duration / 60) - Math.round(prevWeekStats.duration / 60), n => `${n}m`) : zeroDelta,
    },
    {
      value: weekStats.volume > 0 ? `${fmtVolume(weekStats.volume)} lbs` : '0',
      label: 'Volume',
      delta: prevWeekStats ? deltaInfo(weekStats.volume - prevWeekStats.volume, n => `${fmtVolume(n)} lbs`) : zeroDelta,
    },
  ];

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Weekly stats card */}
      <div style={{ padding: '16px 20px 0' }}>
        <div className="card-flat" style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
            This Week
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {stats.map(({ value, label, delta }, i) => (
              <div key={label} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                {i > 0 && (
                  <div style={{ position: 'absolute', left: '-4px', top: '-20%', bottom: '10%', width: '1px', background: 'var(--border)', opacity: 0.6 }} />
                )}
                <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '3px' }}>
                  {label}
                </div>
                {delta && (
                  <div style={{ fontSize: '11px', fontWeight: 500, color: delta.color, marginTop: '2px', lineHeight: 1.2 }}>
                    {delta.text}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab pills */}
      <style>{`
        .fl-tab-inactive { background: #F3F4F6; }
        [data-theme="dark"] .fl-tab-inactive { background: var(--border); }
      `}</style>
      <div style={{ display: 'flex', gap: '8px', padding: '12px 20px 4px', overflowX: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button
            key={t}
            className={tab === t ? '' : 'fl-tab-inactive'}
            onClick={() => setTab(t)}
            style={{
              padding: '7px 16px',
              borderRadius: 20,
              border: 'none',
              background: tab === t ? 'var(--accent)' : undefined,
              color: tab === t ? '#fff' : 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Routines' && (
        <Workouts key="wh-routines" resetKey={resetKey} workoutBarVisible={workoutBarVisible} {...workoutProps} />
      )}
      {tab === 'Exercises' && <ExerciseDatabase workoutBarVisible={workoutBarVisible} />}
      {tab === 'Measurements' && <Measurements metricSystem={metricSystem} workoutBarVisible={workoutBarVisible} />}
      {tab === 'History' && (
        <Workouts key="wh-history" initialView="history" {...workoutProps} />
      )}
    </div>
  );
}

export default WorkoutHome;
