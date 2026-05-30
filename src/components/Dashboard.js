import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

// Animates an SVG line drawing itself in (stroke-dashoffset), then fades in the dots/fill.
// `ref` points at the line element; re-runs whenever `dep` (the path string) changes.
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

// ─── CIRCLE PROGRESS ────────────────────────────────────────
function CircleRing({ value, goal, size = 110, strokeWidth = 10, color, trackColor, children }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(goal > 0 ? value / goal : 0, 1);
  const offset = circumference - progress * circumference;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
}

// ─── MINI LINE CHART (SVG) ───────────────────────────────────
function LineChart({ data, color, height = 80 }) {
  const lineRef = useRef(null);
  const drawn = useChartDraw(lineRef, data ? data.map(d => `${d.date}:${d.value}`).join('|') : '');
  if (!data || data.length < 2) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No data yet</span>
    </div>
  );

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 320;
  const padX = 4;
  const padY = 8;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const pts = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * chartW;
    const y = padY + (1 - (d.value - min) / range) * chartH;
    return [x, y];
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const fillPath = `${linePath} L${pts[pts.length - 1][0]},${padY + chartH} L${pts[0][0]},${padY + chartH} Z`;

  const dateLabels = [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]];

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height, overflow: 'visible' }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill={`url(#grad-${color.replace('#', '')})`} style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.7s ease' }} />
        <path ref={lineRef} d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => i === pts.length - 1 && (
          <circle key={i} cx={x} cy={y} r={3} fill={color} style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.4s ease 0.5s' }} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        {dateLabels.map((d, i) => (
          <span key={i} style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── MEASUREMENT CHART SECTION ──────────────────────────────
function MeasurementSection({ title, measurementName, color, unit }) {
  const [range, setRange] = useState('7D');
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const days = range === '7D' ? 7 : 14;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    (async () => {
      const { data: mData } = await supabase
        .from('measurements')
        .select('id')
        .ilike('name', measurementName)
        .limit(1);
      if (!mData || mData.length === 0) return;

      const { data } = await supabase
        .from('measurement_entries')
        .select('value, created_at')
        .eq('measurement_id', mData[0].id)
        .gte('created_at', sinceStr)
        .order('created_at', { ascending: true });

      if (data) {
        setEntries(data.map(e => ({ value: parseFloat(e.value), date: e.created_at })));
      }
    })();
  }, [range, measurementName]);

  const latest = entries.length > 0 ? entries[entries.length - 1].value : null;
  const first = entries.length > 1 ? entries[0].value : null;

  // Only show trend if there are at least 2 entries and the earliest is at least 3 days ago
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDate = first !== null ? new Date(entries[0].date) : null;
  const daysSinceFirst = firstDate ? Math.round((today - firstDate) / 86400000) : 0;
  const showTrend = first !== null && daysSinceFirst >= 3;

  const diff = showTrend ? (latest - first) : null;
  const improving = diff !== null && diff < 0;
  const worsening = diff !== null && diff > 0;

  return (
    <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {['7D', '14D'].map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, border: 'none',
              background: range === r ? color : 'var(--bg)',
              color: range === r ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
            }}>{r}</button>
          ))}
        </div>
      </div>

      {latest !== null ? (
        <>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 2 }}>
            {latest} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>{unit}</span>
          </div>
          {diff !== null && (
            <div style={{ fontSize: 12, color: improving ? '#22C55E' : worsening ? '#EF4444' : 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
              {improving ? '▼' : worsening ? '▲' : '–'} {Math.abs(diff).toFixed(1)} {unit} vs {range === '7D' ? '7 days' : '14 days'} ago
            </div>
          )}
          <LineChart data={entries} color={color} height={72} />
        </>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', paddingTop: 8 }}>No data yet</div>
      )}
    </div>
  );
}

// ─── MACRO ROW ───────────────────────────────────────────────
function MacroRow({ label, consumed, goal, color, iconColor }) {
  const pct = Math.min(goal > 0 ? consumed / goal : 0, 1);
  const pctLabel = Math.round(pct * 100);
  const done = pct >= 1;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? color : 'var(--bg)', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {done && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{consumed}g / {goal}g</span>
            <span style={{ fontSize: 11, fontWeight: 700, color }}>{pctLabel}%</span>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: 'var(--bg)', overflow: 'hidden' }}>
          <div style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 4, background: color, transition: 'width 0.5s ease' }} />
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────
function Dashboard({ profileName, calorieGoal, proteinGoal, carbsGoal, fatsGoal }) {
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fats, setFats] = useState(0);
  const [streak, setStreak] = useState(0);
  const [weekWorkouts, setWeekWorkouts] = useState(0);

  const today = new Date().toLocaleDateString();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [today]);

  const loadData = async () => {
    // Today's food
    const { data: food } = await supabase
      .from('food_entries')
      .select('calories, protein, carbs, fats')
      .eq('date', today);

    if (food) {
      setCalories(Math.round(food.reduce((s, f) => s + Number(f.calories || 0), 0)));
      setProtein(Math.round(food.reduce((s, f) => s + Number(f.protein || 0), 0)));
      setCarbs(Math.round(food.reduce((s, f) => s + Number(f.carbs || 0), 0)));
      setFats(Math.round(food.reduce((s, f) => s + Number(f.fats || 0), 0)));
    }

    // Streak: consecutive days with at least one workout session
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('date')
      .order('date', { ascending: false });

    if (sessions && sessions.length > 0) {
      const uniqueDates = [...new Set(sessions.map(s => s.date))];
      let count = 0;
      let cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
      for (const d of uniqueDates) {
        const sd = new Date(d);
        sd.setHours(0, 0, 0, 0);
        const diff = Math.round((cursor - sd) / 86400000);
        if (diff === 0 || diff === 1) { count++; cursor = sd; }
        else break;
      }
      setStreak(count);
    }

    // Workouts this week (Monday–Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    // Build the set of this week's dates in the SAME format sessions are stored (toLocaleDateString)
    const weekDateStrs = new Set();
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      weekDateStrs.add(d.toLocaleDateString());
    }

    const { data: weekData } = await supabase
      .from('workout_sessions')
      .select('date');

    if (weekData) {
      setWeekWorkouts(weekData.filter(s => weekDateStrs.has(s.date)).length);
    }
  };

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const greeting = `Good ${timeOfDay}, ${profileName}`;

  const remaining = Math.max(calorieGoal - calories, 0);

  const chips = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#F97316"><path d="M12 2C8.5 6 6 9 6 13a6 6 0 0012 0c0-4-2.5-7-6-11z"/></svg>
      ),
      value: streak,
      label: 'Day streak',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="11" width="18" height="3" rx="1.5" fill="var(--accent)"/>
          <rect x="7" y="7" width="3" height="11" rx="1.5" fill="var(--accent)"/>
          <rect x="14" y="7" width="3" height="11" rx="1.5" fill="var(--accent)"/>
        </svg>
      ),
      value: weekWorkouts,
      label: 'This week',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#22C55E" strokeWidth="2"/>
          <circle cx="12" cy="12" r="4" stroke="#22C55E" strokeWidth="2"/>
          <circle cx="12" cy="12" r="1" fill="#22C55E"/>
        </svg>
      ),
      value: calorieGoal,
      label: 'Cal goal',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M8 18l2-8 3 4 2-6 3 10" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      value: '—',
      label: 'Steps taken',
    },
  ];

  return (
    <div style={{ paddingBottom: 8 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1.15 }}>
          {greeting}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, fontWeight: 400 }}>
          Let's crush your goals today.
        </div>
      </div>

      {/* At a Glance label */}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', padding: '0 20px', marginBottom: 4, marginTop: 16 }}>
        Today at a glance
      </div>

      {/* At a Glance chips */}
      <div style={{ display: 'flex', overflowX: 'auto', paddingTop: 4, paddingBottom: 8, paddingLeft: 20, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {chips.map((chip, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center',
            gap: 8, marginRight: 24, flexShrink: 0,
          }}>
            {chip.icon}
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{chip.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginTop: 1 }}>{chip.label}</div>
            </div>
          </div>
        ))}
        <div style={{ minWidth: 20, flexShrink: 0 }} />
      </div>

      {/* Two Circle Tiles */}
      <div style={{ display: 'flex', gap: 12, padding: '8px 16px' }}>
        {/* Calories Tile */}
        <div style={{ flex: 1, background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Calories</span>
            <span style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1 }}>›</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <CircleRing value={calories} goal={calorieGoal} size={110} strokeWidth={10} color="#3B82F6" trackColor="#DBEAFE">
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{calories}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>kcal</div>
            </CircleRing>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{remaining}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Remaining</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{calorieGoal}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Goal</div>
            </div>
          </div>
        </div>

        {/* Protein Tile */}
        <div style={{ flex: 1, background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Protein</span>
            <span style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1 }}>›</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <CircleRing value={protein} goal={proteinGoal} size={110} strokeWidth={10} color="#22C55E" trackColor="#DCFCE7">
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{protein}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>g</div>
            </CircleRing>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{protein}g</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Consumed</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{proteinGoal}g</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Goal</div>
            </div>
          </div>
        </div>
      </div>

      {/* Measurement Charts */}
      <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <MeasurementSection title="Weight" measurementName="weight" color="#3B82F6" unit="lbs" />
        <MeasurementSection title="Body Fat" measurementName="body fat" color="#F97316" unit="%" />
      </div>

      {/* Macro Progress */}
      <div style={{ margin: '8px 16px 0', background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Today's Macro Progress</span>
          <button style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MacroRow label="Protein" consumed={protein} goal={proteinGoal} color="#22C55E" />
          <MacroRow label="Fats" consumed={fats} goal={fatsGoal} color="#3B82F6" />
          <MacroRow label="Carbs" consumed={carbs} goal={carbsGoal} color="#EAB308" />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
