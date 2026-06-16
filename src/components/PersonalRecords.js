import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CATEGORIES } from './ExerciseDatabase';
import { exerciseCategory } from './routineMeta';
import { setStats, sessionDate, fmtShortDate, fmtVolume } from './prMath';
import PersonalRecordDetail from './PersonalRecordDetail';

// Animates an SVG line drawing itself in (stroke-dashoffset). Same pattern as
// Measurements' charts; re-runs when `dep` changes.
function useChartDraw(ref, dep) {
  const [drawn, setDrawn] = useState(false);
  useLayoutEffect(() => {
    setDrawn(false);
    const el = ref.current;
    let len = 0;
    if (el) {
      try { len = el.getTotalLength(); } catch { len = 0; }
      if (len) {
        el.style.transition = 'none';
        el.style.strokeDasharray = String(len);
        el.style.strokeDashoffset = String(len);
        el.getBoundingClientRect();
      }
    }
    const raf = requestAnimationFrame(() => {
      if (el && len) {
        el.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1)';
        el.style.strokeDashoffset = '0';
      }
      setDrawn(true);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
  return drawn;
}

// Compact inline sparkline of volume-per-session shown on each PR list card.
function Sparkline({ values, color = '#3B82F6' }) {
  const wrapRef = useRef(null);
  const lineRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const H = 36, pad = 4;
  const cW = Math.max(0, width - pad * 2);
  const cH = H - pad * 2;
  const toX = i => pad + (values.length === 1 ? cW / 2 : (i / (values.length - 1)) * cW);
  const toY = v => max === min ? pad + cH / 2 : pad + cH - ((v - min) / (max - min)) * cH;
  const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');

  const drawn = useChartDraw(lineRef, `${width}:${points}`);

  return (
    <div ref={wrapRef} style={{ width: '100%', marginTop: '8px' }}>
      {width > 0 && (
        <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }}>
          <polyline ref={lineRef} points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {values.map((v, i) => <circle key={i} cx={toX(i)} cy={toY(v)} r="3" fill={color} style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.4s ease', transitionDelay: `${0.25 + i * 0.05}s` }} />)}
        </svg>
      )}
    </div>
  );
}

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

  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>Loading…</p>;

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

  const sectionLabel = { fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' };

  const activeExercise = activeName ? history[activeName] : null;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {byCategory.map(({ cat, items }) => (
        <div key={cat}>
          <p style={sectionLabel}>{cat}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map(ex => {
              const values = ex.sessions.map(s => s.sets.volume);
              return (
                <div key={ex.name} className="card-flat" onClick={() => setActiveName(ex.name)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>{ex.name}</span>
                      {values.length >= 2 && <Sparkline values={values} color="#3B82F6" />}
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
