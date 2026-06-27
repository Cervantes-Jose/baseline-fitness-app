import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CATEGORIES } from './ExerciseDatabase';
import { exerciseCategory } from './routineMeta';
import { setStats, sessionDate, fmtShortDate, fmtVolume, dayKey, periodRange, PERIOD_OPTIONS } from './prMath';
import { Sparkline } from './Sparkline';
import TrendCompareChart from './TrendCompareChart';
import PersonalRecordDetail, { DropdownPill } from './PersonalRecordDetail';
import { Skeleton, SkeletonListRow, SkeletonSectionLabel } from './Skeleton';
import useDelayedFlag from './useDelayedFlag';

// Per-exercise trend lines pull from a curated palette indexed by position, so each
// exercise gets a distinct color that stays stable across reloads (same convention as
// the measurement/dashboard PR trend palette). Starts on purple so it doesn't clash
// with the blue Total Volume aggregate chart above the list.
const PR_COLORS = ['#8B5CF6', '#0EA5E9', '#F43F5E', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#14B8A6'];


// Builds the per-exercise history map from raw session + session_exercise rows.
// Returns: { [name]: { name, category, sessions: [...asc], totalVolume, lastDate } }
function buildExerciseHistory(sessions, sessionEx) {
  const sessById = {};
  for (const s of sessions || []) sessById[s.id] = s;

  const byName = {};
  for (const se of sessionEx || []) {
    const sess = sessById[se.session_id];
    if (!sess) continue;
    const stats = setStats(se.sets);
    const d = sessionDate(sess);
    const name = se.exercise_name;
    (byName[name] || (byName[name] = [])).push({
      id: se.session_id,
      date: d,
      routineName: sess.routine_name,
      duration: sess.duration,
      sets: stats,
    });
  }

  const result = {};
  for (const [name, entries] of Object.entries(byName)) {
    entries.sort((a, b) => a.date - b.date);
    const totalVolume = entries.reduce((sum, e) => sum + e.sets.volume, 0);
    result[name] = {
      name,
      category: exerciseCategory(name),
      sessions: entries,
      totalVolume,
      lastDate: entries[entries.length - 1].date,
    };
  }
  return result;
}

function PersonalRecords({ metricSystem = 'imperial' }) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState({});      // name -> exercise history
  const [prs, setPrs] = useState([]);              // exercise_prs rows
  const [activeName, setActiveName] = useState(null);
  const [volPeriod, setVolPeriod] = useState('all'); // Total Volume trend window

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) { setLoading(false); return; }

    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id, created_at, date, routine_name, duration')
      .eq('user_id', uid);

    const ids = (sessions || []).map(s => s.id);
    const { data: sessionEx } = ids.length
      ? await supabase.from('session_exercises').select('exercise_name, sets, session_id').eq('user_id', uid).in('session_id', ids)
      : { data: [] };

    const { data: prRows } = await supabase
      .from('exercise_prs').select('*').eq('user_id', uid).order('recorded_at', { ascending: true });

    setHistory(buildExerciseHistory(sessions, sessionEx));
    setPrs(prRows || []);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // Optimistically append a freshly-logged 1RM so the detail sheet updates without a reload.
  const addPr = (row) => setPrs(prev => [...prev, row]);

  const showSkeleton = useDelayedFlag(loading);
  if (loading) return !showSkeleton ? null : (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card-flat">
        <Skeleton width="40%" height={11} />
        <Skeleton height={120} radius={8} style={{ marginTop: 12 }} />
      </div>
      {[0, 1].map(g => (
        <div key={g}>
          <SkeletonSectionLabel />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[0, 1].map(i => <SkeletonListRow key={i} />)}
          </div>
        </div>
      ))}
    </div>
  );

  const exercises = Object.values(history);

  if (exercises.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.5 }}>
          No personal records yet. Finish a workout to start tracking your progress here.
        </p>
      </div>
    );
  }

  // Group by category in canonical order; only categories with history appear.
  const byCategory = CATEGORIES
    .map(cat => ({ cat, items: exercises.filter(e => e.category === cat).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter(g => g.items.length > 0);
  // Anything that didn't map to a known category (e.g. custom exercises).
  const other = exercises.filter(e => !CATEGORIES.includes(e.category)).sort((a, b) => a.name.localeCompare(b.name));
  if (other.length) byCategory.push({ cat: 'Other', items: other });

  // Assign each exercise a distinct trend color by its flat position in render order.
  const colorByName = {};
  byCategory.flatMap(g => g.items).forEach((ex, i) => { colorByName[ex.name] = PR_COLORS[i % PR_COLORS.length]; });

  const sectionLabel = { fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' };

  const activeExercise = activeName ? history[activeName] : null;

  // Aggregate total training volume per workout day (all exercises combined),
  // shown as a trend chart at the top — parallel to the calorie trend in Nutrition.
  const volumeByDay = {};
  exercises.forEach(ex => ex.sessions.forEach(s => {
    const k = dayKey(s.date);
    if (!k) return;
    (volumeByDay[k] || (volumeByDay[k] = { date: s.date, value: 0 })).value += s.sets.volume;
  }));
  const volumePoints = Object.values(volumeByDay).sort((a, b) => a.date - b.date);
  // Narrow the trend to the selected window (This Week / This Month / All Time).
  const { start: volStart } = periodRange(volPeriod, new Date());
  const periodPoints = volumePoints.filter(p => p.date >= volStart);

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {volumePoints.length >= 2 && (
        <div className="card-flat" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
            <p style={{ ...sectionLabel, margin: 0 }}>Total Volume</p>
            <DropdownPill value={volPeriod} options={PERIOD_OPTIONS} onChange={setVolPeriod} />
          </div>
          {periodPoints.length >= 2 ? (
            <TrendCompareChart base={{ entries: periodPoints, color: '#3B82F6', unit: 'lbs', label: 'Total Volume' }} />
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px 0 8px' }}>
              Not enough workouts in this period.
            </p>
          )}
        </div>
      )}
      {byCategory.map(({ cat, items }) => (
        <div key={cat}>
          <p style={sectionLabel}>{cat}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map(ex => {
              const sparkEntries = ex.sessions.map(s => ({ date: s.date, value: s.sets.volume }));
              return (
                <div key={ex.name} className="card-flat" onClick={() => setActiveName(ex.name)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>{ex.name}</span>
                      {sparkEntries.length >= 2 && <Sparkline entries={sparkEntries} color={colorByName[ex.name]} />}
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                        Last recorded {fmtShortDate(ex.lastDate)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {fmtVolume(ex.totalVolume)}<span style={{ fontSize: '0.66em', fontWeight: '600', marginLeft: '2px' }}>lbs</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Total Volume</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {activeExercise && (
        <PersonalRecordDetail
          exercise={activeExercise}
          prs={prs.filter(p => p.exercise_name === activeExercise.name)}
          metricSystem={metricSystem}
          onAddPr={addPr}
          onClose={() => setActiveName(null)}
        />
      )}
    </div>
  );
}

export default PersonalRecords;
