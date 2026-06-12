import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { goalTrend } from './goalColor';

const BLUE = '#3B82F6';
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const fmtNum = (v) => { const n = Number(v); return n % 1 === 0 ? String(n) : n.toFixed(1); };

const fmtLongDate = (s) => {
  if (!s) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtMDY = (s) => {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split('-'); return `${m}/${d}/${y}`; }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? s : `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${dt.getFullYear()}`;
};

const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dateStrToDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);

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
        el.getBoundingClientRect(); // force reflow so the starting state paints
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

// Full-width detail trend chart: gradient fill + line + dots, matching the Dashboard chart style.
// Measures its own width so dots stay round at a fixed 120px height.
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
  const gradId = `mgrad-${color.replace('#', '')}`;
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

// Bottom-sheet calendar, same pattern as FoodLog's date picker.
function MeasurementCalendar({ selected, onSelect, onClose }) {
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstDay = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const todayStr = new Date().toDateString();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, monthIdx, d));

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: 'var(--card)', borderRadius: '24px 24px 0 0',
        padding: '12px 20px 44px', zIndex: 501,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={() => setMonth(new Date(year, monthIdx - 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 22, padding: '4px 10px', lineHeight: 1 }}>‹</button>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{MONTH_NAMES[monthIdx]} {year}</span>
          <button onClick={() => setMonth(new Date(year, monthIdx + 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 22, padding: '4px 10px', lineHeight: 1 }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, padding: '2px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const isToday = d.toDateString() === todayStr;
            const isSel = d.toDateString() === selected.toDateString();
            return (
              <button key={i} onClick={() => onSelect(d)} style={{
                aspectRatio: '1', borderRadius: '50%', border: 'none',
                background: isSel ? 'var(--accent)' : isToday ? 'var(--accent-light)' : 'transparent',
                color: isSel ? '#fff' : isToday ? 'var(--accent)' : 'var(--text-primary)',
                fontWeight: isSel || isToday ? 700 : 400, fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{d.getDate()}</button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export const DEFAULT_MEASUREMENT_NAMES = [
  'Weight', 'Body Fat', 'Neck', 'Chest', 'Left Bicep', 'Right Bicep',
  'Stomach', 'Hips', 'Left Thigh', 'Right Thigh',
];

// Lowercased set of the hardcoded names so a measurement is recognized as a
// default even when the stored defaultMeasurementIds list is missing/stale.
const DEFAULT_MEASUREMENT_NAME_SET = new Set(DEFAULT_MEASUREMENT_NAMES.map(n => n.toLowerCase()));

export function getDefaultUnit(name, metricSystem) {
  const lower = (name || '').toLowerCase();
  if (lower === 'body fat') return '%';
  if (lower === 'weight') return metricSystem === 'metric' ? 'kg' : 'lbs';
  return metricSystem === 'metric' ? 'cm' : 'in';
}

// One stable color per measurement, picked by its index in the list.
const CHART_COLORS = ['#3B82F6', '#22C55E', '#EAB308', '#A855F7', '#F97316', '#EF4444', '#06B6D4', '#EC4899'];

const parseEntryDate = s => s && /^\d{4}-\d{2}-\d{2}$/.test(s)
  ? new Date(s + 'T00:00:00').getTime()
  : new Date(s).getTime();

// Short "May 6" style date for the latest entry in the list view.
const fmtListDate = (s) => {
  if (!s) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Compact inline sparkline shown inside each measurement card (2+ entries).
// Measures its own width so dots stay round and the stroke stays 2px at a fixed 36px height.
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

function Measurements({ metricSystem = 'imperial' }) {
  const [view, setView] = useState('list');
  const [measurements, setMeasurements] = useState([]);
  const [activeMeasurement, setActiveMeasurement] = useState(null);
  const [newValue, setNewValue] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newDate, setNewDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  // Populated per-user by loadMeasurements (the localStorage key is scoped by uid).
  const [defaultIds, setDefaultIds] = useState(() => new Set());
  const [menuOpen, setMenuOpen] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [renamingMeasurement, setRenamingMeasurement] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [entryMenuOpen, setEntryMenuOpen] = useState(null);
  const [entryMenuPosition, setEntryMenuPosition] = useState({ top: 0, right: 0 });
  const [editingEntry, setEditingEntry] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [range, setRange] = useState('7D');
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDragY, setHistoryDragY] = useState(0);
  const historyDragStart = useRef(null);

  useEffect(() => {
    if (showAllHistory) {
      const id = requestAnimationFrame(() => setHistoryOpen(true));
      return () => cancelAnimationFrame(id);
    }
  }, [showAllHistory]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadMeasurements();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeMeasurement) setNewUnit(getDefaultUnit(activeMeasurement.name, metricSystem));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricSystem]);

  const loadMeasurements = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data: measurementData, error: measurementError } = await supabase
      .from('measurements')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: true });

    if (measurementError) { setLoading(false); return; }

    // Seed-tracking is per-user: a stale global key must never block a new account's
    // defaults. Seed whenever this user has no measurements of their own yet.
    const storageKey = `defaultMeasurementIds_${uid}`;
    let storedDefaultIds = JSON.parse(localStorage.getItem(storageKey) || '[]');

    if (measurementData.length === 0) {
      const { data: seeded, error: seedError } = await supabase
        .from('measurements')
        .insert(DEFAULT_MEASUREMENT_NAMES.map(name => ({ name, user_id: uid })))
        .select();
      if (!seedError && seeded) {
        storedDefaultIds = seeded.map(m => m.id);
        localStorage.setItem(storageKey, JSON.stringify(storedDefaultIds));
        setDefaultIds(new Set(storedDefaultIds));
        setMeasurements(seeded.map(m => ({ ...m, entries: [] })));
        setLoading(false);
        return;
      }
    }

    const validIds = storedDefaultIds.filter(id => measurementData.some(m => m.id === id));
    if (validIds.length !== storedDefaultIds.length) {
      localStorage.setItem(storageKey, JSON.stringify(validIds));
    }
    setDefaultIds(new Set(validIds));

    const { data: entryData, error: entryError } = await supabase
      .from('measurement_entries')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: true });

    if (entryError) { setLoading(false); return; }

    const measurementsWithEntries = measurementData.map(m => ({
      ...m,
      entries: entryData.filter(e => e.measurement_id === m.id)
    }));

    setMeasurements(measurementsWithEntries);
    setLoading(false);
  };

  // "+ Add Measurement": create a blank measurement and drop straight into its
  // detail page (like adding a custom food) — name it inline + log the first entry there.
  const createAndOpenMeasurement = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data, error } = await supabase
      .from('measurements')
      .insert([{ name: '', user_id: uid }])
      .select()
      .single();
    if (error) { return; }
    const m = { ...data, entries: [] };
    setMeasurements(prev => [...prev, m]);
    openMeasurement(m);
  };

  // Inline rename from the detail title.
  const updateActiveName = (name) => {
    setActiveMeasurement(prev => prev && { ...prev, name });
    setMeasurements(prev => prev.map(m => (activeMeasurement && m.id === activeMeasurement.id ? { ...m, name } : m)));
  };
  const persistActiveName = async () => {
    if (!activeMeasurement) return;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const name = (activeMeasurement.name || '').trim();
    updateActiveName(name);
    await supabase.from('measurements').update({ name }).eq('id', activeMeasurement.id).eq('user_id', uid);
  };

  const openMeasurement = (m) => {
    setActiveMeasurement(m);
    const lastUnit = m.entries.length ? m.entries[m.entries.length - 1].unit : '';
    setNewUnit(lastUnit || getDefaultUnit(m.name, metricSystem));
    setRange('7D');
    setView('detail');
  };

  const duplicateMeasurement = async (m) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data, error } = await supabase.from('measurements').insert([{ name: `${m.name} (copy)`, user_id: uid }]).select().single();
    if (error) { return; }
    setMeasurements(prev => [...prev, { ...data, entries: [] }]);
    setMenuOpen(null);
  };

  const deleteMeasurement = async (m) => {
    setMeasurements(prev => prev.filter(item => item.id !== m.id));
    setMenuOpen(null);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    await supabase.from('measurement_entries').delete().eq('user_id', uid).eq('measurement_id', m.id);
    await supabase.from('measurements').delete().eq('user_id', uid).eq('id', m.id);
  };

  const renameMeasurement = async () => {
    if (!renameValue.trim() || !renamingMeasurement) return;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { error } = await supabase.from('measurements').update({ name: renameValue.trim() }).eq('id', renamingMeasurement.id).eq('user_id', uid);
    if (error) { return; }
    setMeasurements(prev => prev.map(m => m.id === renamingMeasurement.id ? { ...m, name: renameValue.trim() } : m));
    setRenamingMeasurement(null);
    setRenameValue('');
  };

  const deleteEntry = async (entryId) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    setActiveMeasurement(prev => ({ ...prev, entries: prev.entries.filter(e => e.id !== entryId) }));
    setMeasurements(prev => prev.map(m =>
      m.id === activeMeasurement.id ? { ...m, entries: m.entries.filter(e => e.id !== entryId) } : m
    ));
    setEntryMenuOpen(null);
    await supabase.from('measurement_entries').delete().eq('id', entryId).eq('user_id', uid);
  };

  const saveEditEntry = async (entry) => {
    if (!editValue.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { error } = await supabase.from('measurement_entries').update({ value: editValue }).eq('id', entry.id).eq('user_id', uid);
    if (error) { return; }
    const updater = entries => entries.map(e => e.id === entry.id ? { ...e, value: editValue } : e);
    setActiveMeasurement(prev => ({ ...prev, entries: updater(prev.entries) }));
    setMeasurements(prev => prev.map(m =>
      m.id === activeMeasurement.id ? { ...m, entries: updater(m.entries) } : m
    ));
    setEditingEntry(null);
    setEditValue('');
  };

  const logEntry = async () => {
    if (!newValue.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data, error } = await supabase
      .from('measurement_entries')
      .insert([{
        measurement_id: activeMeasurement.id,
        value: newValue,
        unit: newUnit,
        date: newDate,
        user_id: uid
      }])
      .select()
      .single();

    if (error) { return; }

    const updated = measurements.map(m =>
      m.id === activeMeasurement.id ? { ...m, entries: [...m.entries, data] } : m
    );
    setMeasurements(updated);
    setActiveMeasurement(prev => ({ ...prev, entries: [...prev.entries, data] }));
    setNewValue('');
  };

  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>Loading...</p>;

  if (view === 'list') return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 0' }}>
        <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Measurements</p>
        <button onClick={createAndOpenMeasurement} aria-label="New measurement"
          style={{ background: 'var(--accent)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '13px', fontWeight: '500', lineHeight: 1, padding: '7px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          + Add Measurement
        </button>
      </div>

      {renamingMeasurement && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 300, padding: '16px',
        }} onClick={() => { setRenamingMeasurement(null); setRenameValue(''); }}>
          <div className="card" style={{ width: '100%', maxWidth: '448px', padding: '24px' }}
            onClick={e => e.stopPropagation()}>
            <p className="section-title" style={{ marginBottom: '16px' }}>Rename Measurement</p>
            <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && renameMeasurement()}
              className="input" style={{ width: '100%', marginBottom: '16px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setRenamingMeasurement(null); setRenameValue(''); }}
                style={{ flex: 1, padding: '14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={renameMeasurement}
                style={{ flex: 1, padding: '14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {menuOpen && <div onClick={() => setMenuOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 299 }} />}
      {menuOpen && measurements.find(m => m.id === menuOpen) && (() => {
        const m = measurements.find(m => m.id === menuOpen);
        // Only custom measurements expose this menu (default measurements have no ··· button).
        const options = [
          { label: 'Rename', action: () => { setRenamingMeasurement(m); setRenameValue(m.name); setMenuOpen(null); } },
          { label: 'Duplicate', action: () => duplicateMeasurement(m) },
          { label: 'Delete', action: () => deleteMeasurement(m), danger: true },
        ];
        return (
          <div style={{
            position: 'fixed', top: menuPosition.top, right: menuPosition.right,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 300, minWidth: '140px',
          }}>
            {options.map((item, i) => (
              <button key={item.label} onClick={item.action} style={{
                display: 'block', width: '100%', padding: '12px 16px', background: 'none',
                border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px',
                fontWeight: '500', color: item.danger ? '#ff4444' : 'var(--text-primary)',
                borderBottom: i < options.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                {item.label}
              </button>
            ))}
          </div>
        );
      })()}

      {measurements.map((m, idx) => {
        const isDefault = defaultIds.has(m.id) || DEFAULT_MEASUREMENT_NAME_SET.has((m.name || '').toLowerCase());
        const hasEntries = m.entries.length > 0;
        const last = m.entries[m.entries.length - 1];
        const color = CHART_COLORS[idx % CHART_COLORS.length];
        const badge = !isDefault && (
          <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: '8px' }}>Custom</span>
        );
        return (
          <div key={m.id} className="card-flat">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, minWidth: 0, paddingRight: '28px', cursor: 'pointer' }} onClick={() => openMeasurement(m)}>
                {hasEntries ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>{m.name}</span>
                      {badge}
                    </div>
                    {m.entries.length >= 2 && <MiniChart entries={m.entries} color={color} />}
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)' }}>{m.name}</span>
                      {badge}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>0 entries</div>
                  </>
                )}
              </div>
              {hasEntries && last && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {last.value}{last.unit ? <span style={{ fontSize: '0.72em', fontWeight: '600', marginLeft: '2px' }}>{last.unit}</span> : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {fmtListDate(last.date)}
                  </div>
                </div>
              )}
              {!isDefault && (
                <button onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                  setMenuOpen(menuOpen === m.id ? null : m.id);
                }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', letterSpacing: '2px', flexShrink: 0 }}>
                  ···
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (view === 'detail') {
    const colorIndex = measurements.findIndex(m => m.id === activeMeasurement.id);
    const color = CHART_COLORS[(colorIndex < 0 ? 0 : colorIndex) % CHART_COLORS.length];
    const sectionLabel = { fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 };

    const allEntries = [...activeMeasurement.entries].sort((a, b) => parseEntryDate(a.date) - parseEntryDate(b.date));
    const descEntries = [...allEntries].reverse();
    const latestEntry = allEntries[allEntries.length - 1] || null;
    const goal = activeMeasurement.goal == null || activeMeasurement.goal === '' ? null : Number(activeMeasurement.goal);

    const days = range === '7D' ? 7 : 14;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days);
    const sinceMs = since.getTime();
    const rangeEntries = allEntries.filter(e => parseEntryDate(e.date) >= sinceMs);

    // Trend delta. Once there's a full two weeks of data we compare weekly averages:
    // this week (last 7 days) vs last week (the 7 days before that), both anchored on
    // today. Averaging smooths out daily water-weight noise into a clean per-week rate
    // (e.g. "2 lbs down on average = 2 lbs/week"). Until both windows have entries we
    // fall back to the latest-vs-earlier-entry comparison.
    const dayMs = 24 * 60 * 60 * 1000;
    const todayMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
    const week1Start = todayMs - 7 * dayMs;   // this week: [today-7, today]
    const week2Start = todayMs - 14 * dayMs;  // last week: [today-14, today-7)
    const thisWeek = allEntries.filter(e => parseEntryDate(e.date) >= week1Start);
    const lastWeek = allEntries.filter(e => { const t = parseEntryDate(e.date); return t >= week2Start && t < week1Start; });
    const avg = arr => arr.reduce((s, e) => s + Number(e.value), 0) / arr.length;

    let diff = 0;
    let showDelta = false;
    let compareLabel = '';
    if (thisWeek.length > 0 && lastWeek.length > 0) {
      diff = avg(thisWeek) - avg(lastWeek);
      showDelta = true;
      compareLabel = 'vs last week avg';
    } else if (allEntries.length >= 2) {
      // Fallback: latest vs earliest-in-range, or the entry just before the latest.
      const compareEntry = rangeEntries.length >= 2 ? rangeEntries[0] : allEntries[allEntries.length - 2];
      diff = Number(latestEntry.value) - Number(compareEntry.value);
      showDelta = true;
      compareLabel = `vs ${fmtListDate(compareEntry.date)}`;
    }
    const last7 = descEntries.slice(0, 7);

    const closeAllHistory = () => { setHistoryOpen(false); setTimeout(() => setShowAllHistory(false), 350); };
    const onHistDown = (e) => { e.currentTarget.setPointerCapture(e.pointerId); historyDragStart.current = e.clientY; };
    const onHistMove = (e) => { if (historyDragStart.current === null) return; setHistoryDragY(Math.max(0, e.clientY - historyDragStart.current)); };
    const onHistUp = (e) => { if (historyDragStart.current === null) return; const dy = Math.max(0, e.clientY - historyDragStart.current); historyDragStart.current = null; setHistoryDragY(0); if (dy > 80) closeAllHistory(); };

    const renderEntryRow = (entry, i, arr, accent) => {
      const s = entry.date;
      const dateLabel = !s ? '' : /^\d{4}-\d{2}-\d{2}$/.test(s)
        ? new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : s;
      const isEditing = editingEntry === entry.id;
      return (
        <div key={entry.id} style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '12px',
          borderLeft: `3px solid ${accent ? BLUE : 'transparent'}`,
          borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{dateLabel}</div>
          </div>
          {isEditing ? (
            <>
              <input type="number" inputMode="decimal" value={editValue}
                onChange={e => setEditValue(e.target.value)} autoFocus
                style={{ width: '72px', padding: '4px 8px', borderRadius: '8px', border: `1.5px solid ${BLUE}`, background: 'var(--bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
              <button onClick={() => saveEditEntry(entry)} style={{ padding: '4px 10px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Save</button>
              <button onClick={() => { setEditingEntry(null); setEditValue(''); }} style={{ padding: '4px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {entry.value}{entry.unit ? <span style={{ fontSize: '0.75em', fontWeight: '600', marginLeft: '2px' }}>{entry.unit}</span> : ''}
              </span>
              <button onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setEntryMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                setEntryMenuOpen(entryMenuOpen === entry.id ? null : entry.id);
              }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', padding: '4px 6px', letterSpacing: '2px', flexShrink: 0, lineHeight: 1 }}>···</button>
            </>
          )}
        </div>
      );
    };

    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button onClick={() => setView('list')}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-start' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back
        </button>
        <input
          value={activeMeasurement.name}
          placeholder="Measurement name"
          autoFocus={!activeMeasurement.name}
          onChange={e => updateActiveName(e.target.value)}
          onBlur={persistActiveName}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={{ width: '100%', margin: 0, fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', outline: 'none', padding: '2px 0' }}
        />

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
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0 8px' }}>Log your first entry to see the trend</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginTop: '12px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                    {latestEntry.value}{latestEntry.unit ? <span style={{ fontSize: '0.7em', fontWeight: '600', marginLeft: '2px' }}>{latestEntry.unit}</span> : ''}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{fmtLongDate(latestEntry.date)}</div>
                  {showDelta && (() => {
                    const trend = goalTrend(diff, Number(latestEntry.value), goal);
                    return (
                      <div style={{ marginTop: '10px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: trend.soft, color: trend.color, fontSize: '13px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' }}>
                          {diff > 0 ? '↑' : diff < 0 ? '↓' : ''} {fmtNum(Math.abs(diff))}{latestEntry.unit ? <span style={{ fontSize: '0.85em', fontWeight: '600', marginLeft: '2px' }}>{latestEntry.unit}</span> : ''}
                        </span>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{compareLabel}</div>
                      </div>
                    );
                  })()}
                </div>
                {goal != null && (() => {
                  const toGo = Math.abs(goal - Number(latestEntry.value));
                  return (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={sectionLabel}>Goal</p>
                      <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent)', lineHeight: 1.1, marginTop: '6px' }}>
                        {fmtNum(goal)}{latestEntry.unit ? <span style={{ fontSize: '0.6em', fontWeight: '600', marginLeft: '2px' }}>{latestEntry.unit}</span> : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
                        {toGo === 0 ? 'At goal' : `${fmtNum(toGo)}${latestEntry.unit ? ' ' + latestEntry.unit : ''} to go`}
                      </div>
                    </div>
                  );
                })()}
              </div>
              {rangeEntries.length > 0
                ? <DetailChart entries={rangeEntries} color={color} />
                : <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0 4px' }}>No entries in the last {days} days</p>
              }
            </>
          )}
        </div>

        {/* LOG NEW ENTRY */}
        <div className="card-flat">
          <p style={sectionLabel}>Log New Entry</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            <button onClick={() => setShowCalendar(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer' }}>
              <span style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: '600' }}>{fmtMDY(newDate)}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent)', flexShrink: 0 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input value={newValue} onChange={e => setNewValue(e.target.value)} inputMode="decimal"
                placeholder="Value" className="input" style={{ flex: 2, minWidth: 0, textAlign: 'center' }} />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'center', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 4px', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', background: 'var(--bg)' }}>
                {newUnit}
              </div>
              <button onClick={logEntry} className="btn-primary" style={{ flex: 3, minWidth: 0, padding: '12px 8px', fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                + Add Entry
              </button>
            </div>
          </div>
        </div>

        {/* HISTORY */}
        {allEntries.length > 0 && (
          <div className="card-flat">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <p style={sectionLabel}>History</p>
              <button onClick={() => setShowAllHistory(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '13px', fontWeight: '600', padding: '2px 4px' }}>
                View All
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {last7.map((entry, i, arr) => renderEntryRow(entry, i, arr, i === 0))}
            </div>
          </div>
        )}

        {/* Entry edit/delete menu — shared by the history list and the View All sheet */}
        {entryMenuOpen && <div onClick={() => setEntryMenuOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 599 }} />}
        {entryMenuOpen && (
          <div style={{
            position: 'fixed', top: entryMenuPosition.top, right: entryMenuPosition.right,
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 600, minWidth: '120px',
          }}>
            <button onClick={() => {
              const entry = activeMeasurement.entries.find(e => e.id === entryMenuOpen);
              if (entry) { setEditingEntry(entry.id); setEditValue(String(entry.value)); }
              setEntryMenuOpen(null);
            }} style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>Edit</button>
            <button onClick={() => deleteEntry(entryMenuOpen)} style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: '#ff4444' }}>Delete</button>
          </div>
        )}

        {/* Calendar date picker */}
        {showCalendar && (
          <MeasurementCalendar
            selected={dateStrToDate(newDate)}
            onSelect={(d) => { setNewDate(toDateStr(d)); setShowCalendar(false); }}
            onClose={() => setShowCalendar(false)}
          />
        )}

        {/* View All — full-screen bottom sheet */}
        {showAllHistory && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg)',
            transform: historyOpen ? `translateY(${historyDragY}px)` : 'translateY(100%)',
            transition: historyDragY > 0 ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div onPointerDown={onHistDown} onPointerMove={onHistMove} onPointerUp={onHistUp}
              style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', flexShrink: 0, userSelect: 'none', touchAction: 'none' }}>
              <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
            </div>
            <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px' }}>{activeMeasurement.name}</h2>
              <p style={{ ...sectionLabel, marginTop: '6px' }}>History</p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 32px' }}>
              {descEntries.map((entry, i, arr) => renderEntryRow(entry, i, arr, i === 0))}
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default Measurements;