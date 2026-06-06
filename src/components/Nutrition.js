import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

// Standard micronutrients we surface trends for. We match these against the
// nutrient names stored on each logged food's snapshot (food_entries.food.nutrients,
// each: { name, value, unit }) by case-insensitive substring, so e.g. "fiber"
// matches "Fiber, total dietary".
const MICRONUTRIENTS = [
  { name: 'Fiber', unit: 'g' },
  { name: 'Sugar', unit: 'g' },
  { name: 'Sodium', unit: 'mg' },
  { name: 'Cholesterol', unit: 'mg' },
  { name: 'Potassium', unit: 'mg' },
  { name: 'Calcium', unit: 'mg' },
  { name: 'Iron', unit: 'mg' },
  { name: 'Magnesium', unit: 'mg' },
  { name: 'Zinc', unit: 'mg' },
  { name: 'Vitamin C', unit: 'mg' },
  { name: 'Vitamin A', unit: 'mcg' },
  { name: 'Vitamin D', unit: 'mcg' },
  { name: 'Vitamin B12', unit: 'mcg' },
  { name: 'Vitamin B6', unit: 'mg' },
  { name: 'Folate', unit: 'mcg' },
  { name: 'Phosphorus', unit: 'mg' },
  { name: 'Selenium', unit: 'mcg' },
];

// One stable color per nutrient, picked by its index in the list (same palette as Measurements).
const CHART_COLORS = ['#3B82F6', '#22C55E', '#EAB308', '#A855F7', '#F97316', '#EF4444', '#06B6D4', '#EC4899'];

// Accent used for the most-recent row in the history list (matches Measurements).
const BLUE = '#3B82F6';

// Macronutrients come straight off the food_entries columns (the per-row adjusted totals),
// not the nutrient snapshot. Colors match the rest of the app: protein green, fat blue, carbs yellow.
const MACRONUTRIENTS = [
  { name: 'Protein', key: 'protein', unit: 'g', color: '#22C55E' },
  { name: 'Fat', key: 'fats', unit: 'g', color: '#3B82F6' },
  { name: 'Carbs', key: 'carbs', unit: 'g', color: '#EAB308' },
];

const fmtNum = (v) => { const n = Number(v); return n % 1 === 0 ? String(n) : n.toFixed(1); };

// food_entries.date is a locale string (e.g. "6/4/2026"); handle ISO too just in case.
const parseEntryDate = s => s && /^\d{4}-\d{2}-\d{2}$/.test(s)
  ? new Date(s + 'T00:00:00').getTime()
  : new Date(s).getTime();

const fmtListDate = (s) => {
  if (!s) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const fmtLongDate = (s) => {
  if (!s) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const hourLabel = (h) => { const x = h % 12 === 0 ? 12 : h % 12; return `${x} ${h < 12 ? 'AM' : 'PM'}`; };

// Sum the value of every nutrient on a food snapshot whose name contains `nameLower`.
const nutrientAmount = (food, nameLower) =>
  (Array.isArray(food?.nutrients) ? food.nutrients : [])
    .filter(n => String(n.name || '').toLowerCase().includes(nameLower))
    .reduce((s, n) => s + (Number(n.value) || 0), 0);

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

// Compact inline sparkline shown inside each nutrient card (2+ entries).
function MiniChart({ entries, color }) {
  const wrapRef = useRef(null);
  const lineRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sorted = [...entries].sort((a, b) => parseEntryDate(a.date) - parseEntryDate(b.date));
  const values = sorted.map(e => Number(e.value));
  const min = Math.min(...values);
  const max = Math.max(...values);

  const H = 36, pad = 4;
  const cW = Math.max(0, width - pad * 2);
  const cH = H - pad * 2;
  const toX = i => pad + (sorted.length === 1 ? cW / 2 : (i / (sorted.length - 1)) * cW);
  const toY = v => max === min ? pad + cH / 2 : pad + cH - ((v - min) / (max - min)) * cH;
  const points = sorted.map((e, i) => `${toX(i)},${toY(Number(e.value))}`).join(' ');

  const drawn = useChartDraw(lineRef, `${width}:${points}`);

  return (
    <div ref={wrapRef} style={{ width: '100%', marginTop: '8px' }}>
      {width > 0 && (
        <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }}>
          <polyline ref={lineRef} points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {sorted.map((e, i) => <circle key={i} cx={toX(i)} cy={toY(Number(e.value))} r="3" fill={color} style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.4s ease', transitionDelay: `${0.25 + i * 0.05}s` }} />)}
        </svg>
      )}
    </div>
  );
}

// Full-width detail trend chart: gradient fill + line + dots.
function DetailChart({ entries, color }) {
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

  const H = 120, padX = 6, padTop = 12, padBottom = 10;
  const cW = Math.max(0, width - padX * 2);
  const cH = H - padTop - padBottom;
  const values = entries.map(e => Number(e.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = (max - min) || 1;
  const pts = entries.map((e, i) => {
    const x = padX + (entries.length === 1 ? cW / 2 : (i / (entries.length - 1)) * cW);
    const y = padTop + (1 - (Number(e.value) - min) / range) * cH;
    return [x, y];
  });
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const fillPath = pts.length ? `${linePath} L${pts[pts.length - 1][0]},${padTop + cH} L${pts[0][0]},${padTop + cH} Z` : '';
  const gradId = `ngrad-${color.replace('#', '')}`;
  const labelEntries = entries.length <= 1
    ? entries
    : [entries[0], entries[Math.floor((entries.length - 1) / 2)], entries[entries.length - 1]];

  const drawn = useChartDraw(lineRef, `${width}:${linePath}`);

  return (
    <div ref={wrapRef} style={{ width: '100%', marginTop: '14px' }}>
      {width > 0 && (
        <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {entries.length > 1 && <path d={fillPath} fill={`url(#${gradId})`} style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.7s ease' }} />}
          {entries.length > 1 && <path ref={lineRef} d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill={color} style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.4s ease', transitionDelay: `${0.3 + i * 0.05}s` }} />)}
        </svg>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        {labelEntries.map((e, i) => (
          <span key={i} style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fmtListDate(e.date)}</span>
        ))}
      </div>
    </div>
  );
}

function Nutrition({ selectedDate }) {
  const [view, setView] = useState('list');
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState({});      // { nutrientName: [{ date, value }] } ascending by date
  const [rows, setRows] = useState([]);          // raw windowed food_entries rows ({ date, hour, food, name })
  const [selectedNutrient, setSelectedNutrient] = useState(null); // { name, unit, color }
  const [range, setRange] = useState('7D');
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);

  // Food-log mini view (bottom sheet) for a tapped history date.
  const [miniDate, setMiniDate] = useState(null);
  const [miniOpen, setMiniOpen] = useState(false);
  const [miniDragY, setMiniDragY] = useState(0);
  const miniDragStart = useRef(null);

  // The 14-day window is anchored to the date selected in the Food Log header, so
  // navigating the date moves the trends with it. Default to today.
  const anchor = selectedDate ? new Date(selectedDate) : new Date();
  anchor.setHours(0, 0, 0, 0);
  const anchorMs = anchor.getTime();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [anchorMs]);

  useEffect(() => {
    if (miniDate) {
      const id = requestAnimationFrame(() => setMiniOpen(true));
      return () => cancelAnimationFrame(id);
    }
  }, [miniDate]);

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    // Window by meal date: the 14 days ending at the anchored (selected) date.
    // food_entries.date is a locale string, so we filter client-side rather than in SQL.
    const sinceMs = anchorMs - 14 * 24 * 60 * 60 * 1000;

    const { data, error } = await supabase
      .from('food_entries')
      .select('date, hour, food, name, protein, carbs, fats')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (error) { console.error(error); setLoading(false); return; }

    const within = (data || []).filter(r => {
      const t = parseEntryDate(r.date);
      return !isNaN(t) && t >= sinceMs && t <= anchorMs;
    });

    // Aggregate daily totals per nutrient: { name: { dateStr: total } }
    const totals = {};
    MACRONUTRIENTS.forEach(m => { totals[m.name] = {}; });
    MICRONUTRIENTS.forEach(m => { totals[m.name] = {}; });
    for (const r of within) {
      // Macros: straight off the row columns (every food row contributes).
      for (const macro of MACRONUTRIENTS) {
        totals[macro.name][r.date] = (totals[macro.name][r.date] || 0) + (Number(r[macro.key]) || 0);
      }
      // Micros: summed from the food snapshot's nutrients array (substring match).
      const nutrients = Array.isArray(r.food?.nutrients) ? r.food.nutrients : [];
      if (!nutrients.length) continue;
      for (const micro of MICRONUTRIENTS) {
        const ln = micro.name.toLowerCase();
        let sum = 0, matched = false;
        for (const n of nutrients) {
          if (String(n.name || '').toLowerCase().includes(ln)) { sum += Number(n.value) || 0; matched = true; }
        }
        if (matched) totals[micro.name][r.date] = (totals[micro.name][r.date] || 0) + sum;
      }
    }

    const built = {};
    [...MACRONUTRIENTS, ...MICRONUTRIENTS].forEach(m => {
      built[m.name] = Object.entries(totals[m.name])
        .map(([date, total]) => ({ date, value: Math.round(total * 10) / 10 }))
        .sort((a, b) => parseEntryDate(a.date) - parseEntryDate(b.date));
    });

    setSeries(built);
    setRows(within);
    setLoading(false);
  };

  // macroKey is the food_entries column for macros (protein/carbs/fats), or null for micros.
  const openItem = ({ name, unit, color, macroKey = null }) => {
    setSelectedNutrient({ name, unit, color, macroKey });
    setRange('7D');
    setView('detail');
  };

  const closeMini = () => { setMiniOpen(false); setTimeout(() => setMiniDate(null), 350); };
  const onMiniDown = (e) => { e.currentTarget.setPointerCapture(e.pointerId); miniDragStart.current = e.clientY; };
  const onMiniMove = (e) => { if (miniDragStart.current === null) return; setMiniDragY(Math.max(0, e.clientY - miniDragStart.current)); };
  const onMiniUp = (e) => { if (miniDragStart.current === null) return; const dy = Math.max(0, e.clientY - miniDragStart.current); miniDragStart.current = null; setMiniDragY(0); if (dy > 80) closeMini(); };

  const sectionLabel = { fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 };

  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>Loading...</p>;

  // ─── FOOD LOG MINI VIEW (bottom sheet) ──────────────────────
  const miniSheet = miniDate && selectedNutrient && (() => {
    const nameLower = selectedNutrient.name.toLowerCase();
    const macroKey = selectedNutrient.macroKey;
    // Macros read the row's column; micros sum the matching nutrients in the snapshot.
    const foodAmount = (r) => macroKey ? (Number(r[macroKey]) || 0) : nutrientAmount(r.food, nameLower);
    const dayRows = rows.filter(r => r.date === miniDate);
    const byHour = {};
    dayRows.forEach(r => { (byHour[r.hour] = byHour[r.hour] || []).push(r); });
    const hours = Object.keys(byHour).map(Number).sort((a, b) => a - b);
    return (
      <>
        <div onClick={closeMini} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 600 }} />
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: `translateX(-50%) translateY(${miniOpen ? miniDragY : window.innerHeight}px)`,
          transition: miniDragY > 0 ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          width: '100%', maxWidth: 480, maxHeight: '75vh',
          background: 'var(--bg)', borderRadius: '24px 24px 0 0', zIndex: 601,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column',
        }}>
          <div onPointerDown={onMiniDown} onPointerMove={onMiniMove} onPointerUp={onMiniUp}
            style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', flexShrink: 0, userSelect: 'none', touchAction: 'none' }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
          </div>
          <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px' }}>Foods on {fmtLongDate(miniDate)}</h2>
            <p style={{ ...sectionLabel, marginTop: '6px' }}>{selectedNutrient.name}</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 32px' }}>
            {hours.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>No foods logged this day</p>
            ) : hours.map(h => (
              <div key={h} className="card-flat" style={{ marginBottom: '8px' }}>
                <p style={{ ...sectionLabel, marginBottom: '8px' }}>{hourLabel(h)}</p>
                {byHour[h].map((r, i, arr) => {
                  const amt = foodAmount(r);
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                      padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.name || r.food?.name || 'Food'}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {fmtNum(amt)}<span style={{ fontSize: '0.78em', fontWeight: '600', marginLeft: '2px' }}>{selectedNutrient.unit}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </>
    );
  })();

  // ─── DETAIL VIEW ────────────────────────────────────────────
  if (view === 'detail' && selectedNutrient) {
    const { name, unit, color } = selectedNutrient;
    const allEntries = series[name] || []; // live from series so it follows the selected date
    const descEntries = [...allEntries].reverse();
    const latestEntry = allEntries[allEntries.length - 1] || null;

    const days = range === '7D' ? 7 : 14;
    const sinceMs = anchorMs - days * 24 * 60 * 60 * 1000;
    const rangeEntries = allEntries.filter(e => parseEntryDate(e.date) >= sinceMs);
    const history = descEntries.slice(0, 14);

    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button onClick={() => setView('list')}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', textAlign: 'left', padding: 0 }}>
          ← Back
        </button>
        <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{name}</h2>

        {/* TREND */}
        <div className="card-flat">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={sectionLabel}>Trend</p>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setRangeMenuOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                {range}
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" style={{ transform: rangeMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {rangeMenuOpen && (
                <>
                  <div onClick={() => setRangeMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 11, minWidth: '70px' }}>
                    {['7D', '14D'].map(opt => (
                      <button key={opt} onClick={() => { setRange(opt); setRangeMenuOpen(false); }}
                        style={{ display: 'block', width: '100%', padding: '8px 14px', background: opt === range ? 'var(--accent-light)' : 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: opt === range ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {allEntries.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0 8px' }}>No {name.toLowerCase()} logged in the last 14 days</p>
          ) : (
            <>
              <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.1, marginTop: '12px' }}>
                {fmtNum(latestEntry.value)}<span style={{ fontSize: '0.7em', fontWeight: '600', marginLeft: '2px' }}>{unit}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{fmtLongDate(latestEntry.date)}</div>
              {rangeEntries.length > 0
                ? <DetailChart entries={rangeEntries} color={color} />
                : <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0 4px' }}>No entries in the last {days} days</p>
              }
            </>
          )}
        </div>

        {/* HISTORY */}
        {allEntries.length > 0 && (
          <div className="card-flat">
            <p style={{ ...sectionLabel, marginBottom: '4px' }}>History</p>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {history.map((entry, i, arr) => (
                <div key={entry.date} onClick={() => setMiniDate(entry.date)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px',
                  borderLeft: `3px solid ${i === 0 ? BLUE : 'transparent'}`,
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer',
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{fmtLongDate(entry.date)}</span>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {fmtNum(entry.value)}<span style={{ fontSize: '0.75em', fontWeight: '600', marginLeft: '2px' }}>{unit}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {miniSheet}
      </div>
    );
  }

  // ─── MAIN LIST VIEW ─────────────────────────────────────────
  // One card renderer shared by both sections. `item` is { name, unit, key? }
  // (key set for macros → food_entries column); `color` is the assigned chart color.
  const renderCard = (item, color) => {
    const data = series[item.name] || [];
    const hasData = data.length > 0;
    const last = data[data.length - 1];
    const open = () => openItem({ name: item.name, unit: item.unit, color, macroKey: item.key || null });
    return (
      <div key={item.name} className="card-flat">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: '28px', cursor: 'pointer' }} onClick={open}>
            {hasData ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)' }}>{item.name}</span>
                </div>
                {data.length >= 2 && <MiniChart entries={data} color={color} />}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)' }}>{item.name}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>0 entries</div>
              </>
            )}
          </div>
          {hasData && last && (
            <div style={{ textAlign: 'right', flexShrink: 0, cursor: 'pointer' }} onClick={open}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {fmtNum(last.value)}<span style={{ fontSize: '0.72em', fontWeight: '600', marginLeft: '2px' }}>{item.unit}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {fmtListDate(last.date)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '8px 0 0' }}>Macronutrients</p>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 4px' }}>Daily totals from your logged foods, last 14 days.</p>
      {MACRONUTRIENTS.map(macro => renderCard(macro, macro.color))}

      <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '16px 0 4px' }}>Micronutrients</p>
      {MICRONUTRIENTS.map((micro, idx) => renderCard(micro, CHART_COLORS[idx % CHART_COLORS.length]))}
    </div>
  );
}

export default Nutrition;
