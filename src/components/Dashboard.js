import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import AddWidgetSheet from './AddWidgetSheet';
import HabitsWidget from './HabitsWidget';
import { goalTrend } from './goalColor';
import { weeklyTrendDelta, entryTrendDelta, parseEntryDate } from './trendMath';
import { getMeasurementFrequency } from './Measurements';
import RangePopover from './RangePopover';
import { loadCompareCatalog } from './compareSources';
import { currentStreak } from './habitMath';

// Short "Jun 17" label that treats a 'YYYY-MM-DD' date as local midnight (so it
// never slips a day in negative-UTC timezones).
const fmtShort = (s) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

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
            {fmtShort(d.date)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── TREND CHART SECTION ────────────────────────────────────
// Generic trend card: title + 7D/14D range, latest value, weekly delta, mini line
// chart. Driven entirely by a passed-in `entries` array ({ value, date, unit? }), so
// the same card backs measurement, nutrition, and PR widgets alike.
function TrendSection({ title, color, unit: unitProp = '', goal = null, entries = [], frequency = 'daily' }) {
  const [range, setRange] = useState('7D');

  // Sort ascending by day so both the delta and the chart read chronologically.
  const sorted = [...entries].sort((a, b) => parseEntryDate(a.date) - parseEntryDate(b.date));

  // Unit comes from the latest entry when entries carry their own unit (measurements),
  // falling back to whatever the caller passed (nutrition/PR series).
  const unit = sorted.length ? (sorted[sorted.length - 1].unit || unitProp) : unitProp;
  const latest = sorted.length > 0 ? sorted[sorted.length - 1].value : null;

  // Chart shows just the selected range; the delta below uses the full history.
  const days = range === '7D' ? 7 : 14;
  const sinceMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() - days * 86400000; })();
  const rangeEntries = sorted.filter(e => parseEntryDate(e.date) >= sinceMs);

  // Trend delta by cadence, matching the measurement detail page: 'weekly' compares
  // the latest entry to the previous one; 'daily' uses the rolling 7-day delta
  // shared with Nutrition (see trendMath.js).
  const { diff, showDelta, compareLabel } = frequency === 'weekly' ? entryTrendDelta(sorted) : weeklyTrendDelta(sorted);
  // Direction of the arrow is just the sign of the change; the color is whether that
  // change moves toward the goal (green) or away (red) — neutral when no goal is set.
  const trend = goalTrend(diff, latest, goal);

  return (
    <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
        <RangePopover value={range} options={['7D', '14D']} onChange={setRange} />
      </div>

      {latest !== null ? (
        <>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 2 }}>
            {latest} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>{unit}</span>
          </div>
          {showDelta && (
            <div style={{ fontSize: 12, color: trend.color, marginBottom: 8, fontWeight: 600 }}>
              {diff < 0 ? '▼' : diff > 0 ? '▲' : '–'} {Math.abs(diff).toFixed(1)} {unit} {compareLabel}
            </div>
          )}
          <LineChart data={rangeEntries} color={color} height={72} />
        </>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', paddingTop: 8 }}>No data yet</div>
      )}
    </div>
  );
}

// ─── MEASUREMENT CHART SECTION ──────────────────────────────
// Fetches a measurement's full history once (range-independent), then renders it
// through TrendSection. The delta uses the full history; the chart slices the window.
function MeasurementSection({ title, measurementName, color, unit = '', goal = null, frequency = 'daily' }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      const { data: mData } = await supabase
        .from('measurements')
        .select('id')
        .eq('user_id', uid)
        .ilike('name', measurementName)
        .limit(1);
      if (!mData || mData.length === 0) return;

      const { data } = await supabase
        .from('measurement_entries')
        .select('value, date, created_at, unit')
        .eq('user_id', uid)
        .eq('measurement_id', mData[0].id)
        .order('created_at', { ascending: true });

      if (data) {
        // Prefer the logged `date` (what the in-app math keys off of); fall back to
        // created_at for any legacy rows missing it.
        setEntries(data.map(e => ({ value: parseFloat(e.value), date: e.date || e.created_at, unit: e.unit || '' })));
      }
    })();
  }, [measurementName]);

  return <TrendSection title={title} color={color} unit={unit} goal={goal} entries={entries} frequency={frequency} />;
}

// ─── DASHBOARD ───────────────────────────────────────────────
// Widgets shown on a fresh dashboard, in order. Everything else (Carbs, Fats, and
// the per-measurement trend charts) lives in the "Add Widget" pool until the user
// places it. The layout is just the ordered list of placed widget ids; deleting a
// widget removes it from the list and it returns to the pool.
// `glance` (the day-streak summary) is pinned at the top and rendered outside the
// orderable set — it isn't draggable, deletable, or in the Add Widget picker.
const DEFAULT_ORDER = ['calories', 'protein', 'weight', 'bodyfat'];

// Half-width tiles (the rest are full-width). Calories/Protein/Carbs/Fats are the
// small ring tiles that can pair two-per-row.
const HALF = new Set(['calories', 'protein', 'carbs', 'fats']);

// Stable color palette for dynamically-generated measurement trend widgets.
const MEAS_COLORS = ['#3B82F6', '#22C55E', '#EAB308', '#A855F7', '#F97316', '#EF4444', '#06B6D4', '#EC4899'];

// Default measurements get fixed ids so existing saved layouts keep working; all
// other measurements use a `meas:<id>` key.
function widgetIdForMeasurement(name, id) {
  const n = (name || '').trim().toLowerCase();
  if (n === 'weight') return 'weight';
  if (n === 'body fat') return 'bodyfat';
  return `meas:${id}`;
}

function loadDashboardLayout() {
  try {
    const s = JSON.parse(localStorage.getItem('dashboardLayout'));
    if (Array.isArray(s)) return { order: s, breaks: [] };                       // [ids] shape
    if (s && Array.isArray(s.order)) {
      if (Array.isArray(s.breaks)) return { order: s.order, breaks: s.breaks };   // current { order, breaks }
      const hidden = new Set(Array.isArray(s.hidden) ? s.hidden : []);            // legacy { order, hidden }
      return { order: s.order.filter(id => !hidden.has(id)), breaks: [] };
    }
  } catch {}
  return { order: DEFAULT_ORDER, breaks: [] };
}

// The blank "add" tile shown at the end of a section in edit mode: blue dashed
// border, faint grey fill, a blue plus in the middle. `full` makes it a full-width
// trend-sized card; otherwise it sizes to a half macro tile (filling its flex wrapper).
function AddCard({ full, onClick }) {
  return (
    <button onClick={onClick} aria-label="Add widget"
      style={{
        width: '100%', minHeight: full ? 140 : 200, alignSelf: 'stretch',
        border: '2px dashed var(--accent)', borderRadius: 20,
        background: 'rgba(148,163,184,0.12)', cursor: 'pointer', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// Wraps a placed widget in edit mode and overlays a red "−" remove button.
// `insetRemove` keeps the button inside the tile bounds (used inside the horizontal
// macro scroller, where a negative offset would be clipped); trends place it just
// outside the top-right corner.
function EditTile({ id, removable, onRemove, insetRemove, children }) {
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {children}
      {removable && (
        <button onClick={() => onRemove(id)} aria-label="Remove widget"
          style={{
            position: 'absolute', top: insetRemove ? 8 : -8, right: insetRemove ? 8 : -8,
            width: 24, height: 24, borderRadius: '50%', padding: 0,
            background: '#EF4444', border: '2px solid var(--card)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)', zIndex: 6,
          }}>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5h7" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      )}
    </div>
  );
}

function Dashboard({ user, calorieGoal, proteinGoal, carbsGoal, fatsGoal, editMode = false, onExitEdit = () => {}, showToast = () => {} }) {
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fats, setFats] = useState(0);
  const [streak, setStreak] = useState(0);
  const [weekWorkouts, setWeekWorkouts] = useState(0);
  const [habitStreak, setHabitStreak] = useState(0);   // highest current streak across all habits
  // Sticky greeting header: starts enlarged, shrinks to compact once the page
  // scrolls (mirrors the Food Log date header).
  const [headerScrolled, setHeaderScrolled] = useState(false);

  // Custom widget layout — just the ordered list of placed widget ids, persisted to
  // localStorage. (Drag-reordering and row breaks were removed: macros now scroll
  // horizontally and trends stack, so the layout is fixed.)
  const [order, setOrder] = useState(() => loadDashboardLayout().order);
  const [pickerCat, setPickerCat] = useState(null);   // 'food' | 'trend' | null — which add sheet is open
  const [measurements, setMeasurements] = useState([]);
  const [trendCatalog, setTrendCatalog] = useState([]);   // cross-domain trend series (Nutrition + PRs)
  const macroScrollRef = useRef(null);

  const persistLayout = async (nextOrder) => {
    // Write to localStorage immediately for instant feedback on next load.
    try { localStorage.setItem('dashboardLayout', JSON.stringify({ order: nextOrder, breaks: [] })); } catch {}
    // Also write to Supabase so it survives browser storage eviction (iOS clears
    // localStorage after ~7 days of inactivity).
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { error } = await supabase.from('profiles')
      .upsert({ user_id: uid, dashboard_layout: { order: nextOrder } }, { onConflict: 'user_id' });
    // localStorage already holds the order (so the layout survives locally); don't revert
    // the UI, just surface the failed cloud backup instead of discarding it silently.
    if (error) { showToast('Couldn\'t save — check your connection.'); }
  };
  const saveOrder = (next) => { setOrder(next); persistLayout(next); };

  // Daily Habits is a removable widget. Hidden state persists on its own key; we also
  // need to know whether the user has any habits at all (no habits → nothing to show).
  const [habitsHidden, setHabitsHidden] = useState(() => {
    try { return localStorage.getItem('dashboardHabitsHidden') === '1'; } catch { return false; }
  });
  const [hasHabits, setHasHabits] = useState(false);
  const setHabits = (hidden) => {
    setHabitsHidden(hidden);
    try { localStorage.setItem('dashboardHabitsHidden', hidden ? '1' : '0'); } catch {}
  };

  const today = new Date().toLocaleDateString();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [today]);

  // Restore layout from Supabase if localStorage was cleared (e.g. iOS 7-day eviction).
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      const { data } = await supabase.from('profiles').select('dashboard_layout').eq('user_id', uid).single();
      if (!data?.dashboard_layout?.order) return;
      // Only apply the server copy if localStorage is missing or empty — if localStorage
      // has a value it was written more recently (same session) and should win.
      const local = (() => { try { return localStorage.getItem('dashboardLayout'); } catch { return null; } })();
      if (!local) {
        const serverOrder = data.dashboard_layout.order;
        setOrder(serverOrder);
        try { localStorage.setItem('dashboardLayout', JSON.stringify({ order: serverOrder, breaks: [] })); } catch {}
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // All measurements the user tracks — each becomes an available trend widget.
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      supabase.from('measurements').select('id, name, goal, frequency').eq('user_id', uid).order('created_at', { ascending: true })
        .then(({ data }) => { if (data) setMeasurements(data); });
      // Habits drive two things: whether to show the Daily Habits widget, and the
      // highest current streak across all habits (shown in the glance bar). Fetch all
      // habits + logs once, group logged dates per habit, and take the best streak.
      const [{ data: hs }, { data: logs }] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', uid),
        supabase.from('habit_logs').select('habit_id, date').eq('user_id', uid),
      ]);
      setHasHabits(!!(hs && hs.length));
      if (hs && hs.length) {
        const byHabit = {};
        for (const l of logs || []) (byHabit[l.habit_id] || (byHabit[l.habit_id] = new Set())).add(l.date);
        let best = 0;
        for (const h of hs) { const s = currentStreak(h, byHabit[h.id] || new Set()); if (s > best) best = s; }
        setHabitStreak(best);
      } else {
        setHabitStreak(0);
      }
    })();
  }, []);

  // Cross-domain trend series (Nutrition daily totals + Personal Records 1RM history),
  // reused from the Compare catalog so every surface plots the same data.
  useEffect(() => { loadCompareCatalog().then(setTrendCatalog).catch(() => {}); }, []);

  // Shrink the sticky greeting once the page scrolls down, expand it back near the
  // top. Uses HYSTERESIS (shrink at >64, expand at <8) so the layout shift from the
  // resize — which scroll anchoring then nudges scrollY by — can't re-cross the
  // threshold and make the header oscillate. The dead-zone (8–64) is wider than the
  // collapsing greeting's height delta. rAF-throttled to one read per frame.
  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      setHeaderScrolled(prev => (prev ? y >= 8 : y > 64));
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Entering edit mode, nudge the macro row slightly left so the trailing "add" card
  // peeks in from the right — the placed macros stay the visible default.
  useEffect(() => {
    if (editMode && macroScrollRef.current) {
      macroScrollRef.current.scrollTo({ left: 72, behavior: 'smooth' });
    }
  }, [editMode]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    // Today's food
    const { data: food } = await supabase
      .from('food_entries')
      .select('calories, protein, carbs, fats')
      .eq('user_id', uid)
      .eq('date', today);

    if (food) {
      setCalories(Math.round(food.reduce((s, f) => s + Number(f.calories || 0), 0)));
      setProtein(Math.round(food.reduce((s, f) => s + Number(f.protein || 0), 0)));
      setCarbs(Math.round(food.reduce((s, f) => s + Number(f.carbs || 0), 0)));
      setFats(Math.round(food.reduce((s, f) => s + Number(f.fats || 0), 0)));
    }

    // Streak: consecutive days with any activity — a logged food OR a workout
    // session counts that day as active. Both tables store `date` as a
    // toLocaleDateString() string, so the date strings are directly comparable.
    const [{ data: sessions }, { data: foodDays }] = await Promise.all([
      supabase.from('workout_sessions').select('date').eq('user_id', uid),
      supabase.from('food_entries').select('date').eq('user_id', uid),
    ]);

    // Merge both sources into a set of unique active days (as midnight timestamps),
    // then walk back from today counting consecutive days.
    const activeDayTimes = [...new Set([
      ...(sessions || []).map(s => s.date),
      ...(foodDays || []).map(f => f.date),
    ])]
      .map(d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); })
      .filter(t => !Number.isNaN(t))
      .sort((a, b) => b - a);

    let count = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    let cursorTime = cursor.getTime();
    for (const t of activeDayTimes) {
      const diff = Math.round((cursorTime - t) / 86400000);
      if (diff === 0 || diff === 1) { count++; cursorTime = t; }
      else break;
    }
    setStreak(count);

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
      .select('date')
      .eq('user_id', uid);

    if (weekData) {
      setWeekWorkouts(weekData.filter(s => weekDateStrs.has(s.date)).length);
    }
  };

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  // Display name: the first name set at signup (user metadata), else the email's
  // local part, else a neutral fallback.
  const metaName = user?.user_metadata?.first_name;
  const emailPrefix = user?.email ? user.email.split('@')[0] : '';
  const displayName = metaName || emailPrefix || 'there';

  const remaining = Math.max(calorieGoal - calories, 0);

  const chips = [
    {
      // Unique two-tone flame — outer orange body with a lighter inner flame.
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C9 6 7.5 8.5 7.5 11.5c0 1 .3 1.9.8 2.6-1.1-.3-2-1.1-2.5-2.2C4.6 13.4 4 15.1 4 16.5a8 8 0 0 0 16 0c0-3.2-1.8-5.7-3.6-8C14.8 6.7 13.6 4.6 12 2z" fill="#F97316"/>
          <path d="M12 21a3.3 3.3 0 0 0 3.3-3.3c0-1.6-1-2.7-1.9-3.8-.4 1.1-1.1 1.5-1.7 1.7.2-1.5-.5-2.5-1.1-3.2-.6.9-1.5 1.9-1.5 4A3.3 3.3 0 0 0 12 21z" fill="#FDBA74"/>
        </svg>
      ),
      value: streak,
      label: 'Day streak',
    },
    {
      // Dumbbell — matches the bottom-tab workout icon (bigger inner plates).
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="9" y1="12" x2="15" y2="12" />
          <line x1="5" y1="9" x2="5" y2="15" />
          <line x1="7" y1="8" x2="7" y2="16" />
          <line x1="19" y1="9" x2="19" y2="15" />
          <line x1="17" y1="8" x2="17" y2="16" />
        </svg>
      ),
      value: weekWorkouts,
      label: 'This week',
    },
    {
      // Highest current habit streak — just the number + label, no icon.
      icon: null,
      value: habitStreak,
      label: 'Habit Streak',
    },
  ];

  // Each widget keyed by id, as a bare card. Calories/Protein/Carbs/Fats are the
  // half-width ring tiles; everything else is full-width.
  const widgetMap = {
    glance: (
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', padding: '0 20px', marginBottom: 4, marginTop: 8 }}>
          Today at a glance
        </div>
        <div style={{ display: 'flex', overflowX: 'auto', paddingTop: 4, paddingBottom: 8, paddingLeft: 20, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {chips.map((chip, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24, flexShrink: 0 }}>
              {chip.icon}
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{chip.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginTop: 1 }}>{chip.label}</div>
              </div>
            </div>
          ))}
          <div style={{ minWidth: 20, flexShrink: 0 }} />
        </div>
      </div>
    ),
    calories: (
      <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', height: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Calories</span>
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
    ),
    protein: (
      <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', height: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Protein</span>
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
    ),
    carbs: (
      <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', height: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Carbs</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <CircleRing value={carbs} goal={carbsGoal} size={110} strokeWidth={10} color="#EAB308" trackColor="#FEF9C3">
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{carbs}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>g</div>
          </CircleRing>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{carbs}g</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Consumed</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{carbsGoal}g</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Goal</div>
          </div>
        </div>
      </div>
    ),
    fats: (
      <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', height: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Fats</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <CircleRing value={fats} goal={fatsGoal} size={110} strokeWidth={10} color="#3B82F6" trackColor="#DBEAFE">
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{fats}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>g</div>
          </CircleRing>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fats}g</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Consumed</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fatsGoal}g</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Goal</div>
          </div>
        </div>
      </div>
    ),
  };

  // One trend widget per measurement the user tracks, merged into the widget map.
  // Weight/Body Fat keep their fixed ids; the rest are keyed `meas:<id>`.
  const measurementItems = measurements.map((m, i) => ({
    id: widgetIdForMeasurement(m.name, m.id),
    label: m.name,
    node: <MeasurementSection title={m.name} measurementName={m.name} color={MEAS_COLORS[i % MEAS_COLORS.length]} goal={m.goal} frequency={getMeasurementFrequency(m)} />,
  }));
  measurementItems.forEach(({ id, node }) => { widgetMap[id] = node; });

  // Nutrition + Personal Records trend widgets, sourced from the shared Compare
  // catalog. (Its Measurements group is ignored here — those already come through
  // measurementItems above, with goal coloring and the fixed weight/bodyfat ids.)
  const nutItems = (trendCatalog.find(g => g.group === 'Nutrition')?.items) || [];
  const prItems = (trendCatalog.find(g => g.group === 'Personal Records')?.items) || [];
  [...nutItems, ...prItems].forEach(it => {
    widgetMap[it.id] = <TrendSection title={it.label} color={it.color} unit={it.unit} entries={it.entries} />;
  });

  // Every trend the user can add, across domains.
  const trendItems = [...measurementItems, ...nutItems, ...prItems];

  // `placed` = the widgets currently rendered (valid ids only — drops stale ones, e.g.
  // a deleted measurement, or trend series still loading). `glance` is pinned and
  // rendered separately. `order` is the source of truth for placement (add/remove key
  // off it, not `placed`, so a still-loading trend isn't accidentally dropped).
  const placed = order.filter(id => widgetMap[id] && id !== 'glance');
  const orderSet = new Set(order);
  // Macros scroll horizontally; everything else (trends) stacks full-width.
  const placedMacros = placed.filter(id => HALF.has(id));
  const placedTrends = placed.filter(id => !HALF.has(id));

  // Scoped catalogs for the two add sheets — each looks like the old Add Widget sheet,
  // just pre-filtered to the section whose + card was tapped. Trends span all domains.
  const FOOD_ITEMS = [
    { id: 'calories', label: 'Calories' },
    { id: 'protein', label: 'Protein' },
    { id: 'carbs', label: 'Carbs' },
    { id: 'fats', label: 'Fats' },
  ];
  const trendGroups = [
    { category: 'Measurements', items: measurementItems.map(({ id, label }) => ({ id, label })) },
    { category: 'Nutrition', items: nutItems.map(({ id, label }) => ({ id, label })) },
    { category: 'Personal Records', items: prItems.map(({ id, label }) => ({ id, label })) },
  ].filter(g => g.items.length > 0);
  const pickerCatalog = pickerCat === 'food'
    ? [{ category: 'Food', items: FOOD_ITEMS }]
    : pickerCat === 'trend'
      ? trendGroups
      : [];

  // Hide a section's + card once everything in it is already placed.
  const macroAddable = FOOD_ITEMS.some(it => !orderSet.has(it.id));
  const trendAddable = trendItems.some(it => !orderSet.has(it.id));

  const addWidgets = (ids) => {
    const toAdd = ids.filter(id => !orderSet.has(id));
    if (toAdd.length) saveOrder([...order, ...toAdd]);
    setPickerCat(null);
  };
  const removeWidget = (id) => saveOrder(order.filter(x => x !== id));

  if (editMode) {
    return (
      <div style={{ paddingBottom: 80 }}>
        {/* Edit bar — title only; adding happens via the inline + cards in each section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 4px' }}>
          <button onClick={onExitEdit} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 15, fontWeight: 600, padding: 0 }}>Done</button>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Edit Dashboard</span>
          <span style={{ width: 40 }} />
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 8px' }}>Tap + to add a widget · tap − to remove</p>

        {/* Pinned summary — always at the top, not movable */}
        {widgetMap.glance}

        {/* Daily Habits — removable; when removed it collapses to a blue + card */}
        {hasHabits && (habitsHidden ? (
          <div style={{ padding: '12px 16px 0' }}>
            <AddCard full onClick={() => setHabits(false)} />
          </div>
        ) : (
          <div style={{ position: 'relative', marginTop: 4 }}>
            <HabitsWidget showToast={showToast} />
            <button onClick={() => setHabits(true)} aria-label="Remove widget"
              style={{
                position: 'absolute', top: -8, right: 8, width: 24, height: 24, borderRadius: '50%', padding: 0,
                background: '#EF4444', border: '2px solid var(--card)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)', zIndex: 6,
              }}>
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5h7" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        ))}

        {/* Macros — horizontal scroll row with a trailing "add" card */}
        <div ref={macroScrollRef}
          style={{ display: 'flex', gap: 12, padding: '12px 16px', overflowX: 'auto', alignItems: 'stretch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {placedMacros.map(id => (
            <div key={id} style={{ flex: '0 0 calc(50% - 6px)', boxSizing: 'border-box' }}>
              <EditTile id={id} removable onRemove={removeWidget} insetRemove>
                {widgetMap[id]}
              </EditTile>
            </div>
          ))}
          {macroAddable && (
            <div style={{ flex: '0 0 calc(50% - 6px)', boxSizing: 'border-box', display: 'flex' }}>
              <AddCard onClick={() => setPickerCat('food')} />
            </div>
          )}
        </div>

        {/* Trends — stacked full-width, each removable, with a trailing "add" card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 8px' }}>
          {placedTrends.map(id => (
            <EditTile key={id} id={id} removable onRemove={removeWidget}>
              {widgetMap[id]}
            </EditTile>
          ))}
          {trendAddable && <AddCard full onClick={() => setPickerCat('trend')} />}
        </div>

        <AddWidgetSheet
          open={!!pickerCat}
          onClose={() => setPickerCat(null)}
          catalog={pickerCatalog}
          placedSet={orderSet}
          renderPreview={(id) => widgetMap[id]}
          isHalf={(id) => HALF.has(id)}
          onAdd={addWidgets}
        />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 8 }}>
      {/* Header / greeting — stays frozen at the top and shrinks once scrolled,
          like the Food Log date header. The subtitle collapses away when compact. */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 150, background: 'var(--bg)',
        boxShadow: headerScrolled ? '0 2px 12px rgba(0,0,0,0.06)' : 'none',
        padding: headerScrolled ? '14px 20px 10px' : '32px 20px 8px',
        transition: 'padding 0.22s ease, box-shadow 0.2s ease',
      }}>
        <div style={{
          fontSize: headerScrolled ? 19 : 26, fontWeight: 800, color: 'var(--text-primary)',
          letterSpacing: '-0.5px', lineHeight: 1.15, transition: 'font-size 0.22s ease',
        }}>
          Good {timeOfDay}, <span style={{ color: 'var(--accent)' }}>{displayName}</span>
        </div>
        <div style={{
          fontSize: 14, color: 'var(--text-muted)', fontWeight: 400, overflow: 'hidden',
          maxHeight: headerScrolled ? 0 : 24, opacity: headerScrolled ? 0 : 1,
          marginTop: headerScrolled ? 0 : 4,
          transition: 'max-height 0.22s ease, opacity 0.18s ease, margin-top 0.22s ease',
        }}>
          Let's crush your goals today.
        </div>
      </div>
      {/* Pinned summary */}
      {widgetMap.glance}

      {/* Daily Habits — directly under the glance bar; hidden if the user removed it */}
      {hasHabits && !habitsHidden && (
        <div style={{ marginTop: 4 }}>
          <HabitsWidget showToast={showToast} />
        </div>
      )}

      {/* Macros — horizontal scroll row */}
      {placedMacros.length > 0 && (
        <div style={{ display: 'flex', gap: 12, padding: '12px 16px', overflowX: 'auto', alignItems: 'stretch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {placedMacros.map(id => (
            <div key={id} style={{ flex: '0 0 calc(50% - 6px)', boxSizing: 'border-box' }}>
              {widgetMap[id]}
            </div>
          ))}
        </div>
      )}

      {/* Trends — stacked full-width */}
      {placedTrends.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 8px' }}>
          {placedTrends.map(id => (
            <div key={id}>{widgetMap[id]}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
