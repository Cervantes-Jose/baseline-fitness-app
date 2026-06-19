import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { goalTrend } from './goalColor';
import { weeklyTrendDelta } from './trendMath';
import RangePopover from './RangePopover';
import { Sparkline } from './Sparkline';
import TrendCompareChart from './TrendCompareChart';
import CompareSheet from './CompareSheet';
import { loadCompareCatalog, findCatalogItem } from './compareSources';
import MonthOverviewCalendar from './MonthOverviewCalendar';
import { ymd } from './habitMath';
import useSwipeToDismiss from './useSwipeToDismiss';
import Fab from './Fab';

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

  // Lock background scroll while the sheet is open so the page behind can't move under it.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

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
  // Only the seeded body-measurement defaults get a length unit. Custom
  // measurements start blank so the user can type whatever unit they want.
  if (DEFAULT_MEASUREMENT_NAME_SET.has(lower)) return metricSystem === 'metric' ? 'cm' : 'in';
  return '';
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

function Measurements({ metricSystem = 'imperial', autoCreateSignal = 0, onAutoCreate = () => {}, onBack = null }) {
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
  // Trend comparison: a cross-domain series (measurement / nutrition / PR) overlaid
  // on the detail chart. Cleared whenever you leave detail so it never "sticks".
  const [compareId, setCompareId] = useState(null);
  const [compareSheetOpen, setCompareSheetOpen] = useState(false);
  const [compareCatalog, setCompareCatalog] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // View All sheet: toggle between the flat history list and a month-overview
  // calendar of logged days; tapping a logged day reveals that day's entry.
  const [historyCalendar, setHistoryCalendar] = useState(false);
  const [dayModal, setDayModal] = useState(null); // { label, entries } | null
  const closeAllHistory = () => { setHistoryOpen(false); setHistoryCalendar(false); setDayModal(null); setTimeout(() => setShowAllHistory(false), 350); };
  // Swipe-to-dismiss for the View All history sheet: drag the handle, or swipe
  // down anywhere on the list once it's scrolled to the top.
  const hist = useSwipeToDismiss({ onDismiss: closeAllHistory });

  useEffect(() => {
    if (showAllHistory) {
      const id = requestAnimationFrame(() => setHistoryOpen(true));
      return () => cancelAnimationFrame(id);
    }
  }, [showAllHistory]);

  // Leaving the detail screen drops any active comparison (and its loaded catalog).
  useEffect(() => {
    if (view !== 'detail') { setCompareId(null); setCompareSheetOpen(false); setCompareCatalog(null); }
  }, [view]);

  // Load the cross-domain compare catalog the first time the picker is opened in
  // this detail session; the active measurement is excluded from the list.
  useEffect(() => {
    if (!compareSheetOpen || compareCatalog || !activeMeasurement) return;
    let cancelled = false;
    setCompareLoading(true);
    loadCompareCatalog({ excludeId: `meas:${activeMeasurement.id}` })
      .then(cat => { if (!cancelled) setCompareCatalog(cat); })
      .finally(() => { if (!cancelled) setCompareLoading(false); });
    return () => { cancelled = true; };
  }, [compareSheetOpen, compareCatalog, activeMeasurement]);

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

  // Create + open a new measurement when the parent FAB requests it (signal = a bumped
  // nonce). The ref guards against re-firing for the same nonce (e.g. StrictMode
  // double-invoke), which would otherwise insert a duplicate blank row.
  const autoCreateHandled = useRef(0);
  useEffect(() => {
    if (autoCreateSignal && autoCreateSignal !== autoCreateHandled.current) {
      autoCreateHandled.current = autoCreateSignal;
      createAndOpenMeasurement();
      onAutoCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreateSignal]);

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
    setCompareId(null);
    setCompareCatalog(null);
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

  // Defaults render in their canonical order regardless of created_at (a bulk
  // seed insert doesn't reliably preserve array order); custom measurements
  // keep their existing (created_at) order after the defaults.
  const defaultOrder = name => {
    const i = DEFAULT_MEASUREMENT_NAMES.findIndex(n => n.toLowerCase() === (name || '').toLowerCase());
    return i === -1 ? Infinity : i;
  };
  const orderedMeasurements = [...measurements].sort((a, b) => defaultOrder(a.name) - defaultOrder(b.name));

  if (view === 'list') return (
    <div style={{ paddingBottom: onBack ? 100 : 0 }}>
      {onBack ? (
        <div style={{ padding: '16px 20px 0' }}>
          <button onClick={onBack} aria-label="Back"
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, display: 'flex', marginBottom: 16 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>Measurements</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '28px 0 0', lineHeight: 1.4 }}>
            Keep track of all your measurements.
          </p>
        </div>
      ) : null}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {!onBack && (
          <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0 0' }}>
            <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Measurements</p>
          </div>
        )}

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

      {orderedMeasurements.map((m, idx) => {
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
                    {m.entries.length >= 2 && <Sparkline entries={m.entries} color={color} />}
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
      {onBack && (
        <Fab label="Add Measurement" actions={[{ label: 'Add Measurement', onClick: createAndOpenMeasurement }]} />
      )}
    </div>
  );

  if (view === 'detail') {
    const colorIndex = measurements.findIndex(m => m.id === activeMeasurement.id);
    const color = CHART_COLORS[(colorIndex < 0 ? 0 : colorIndex) % CHART_COLORS.length];
    const sectionLabel = { fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 };

    const allEntries = [...activeMeasurement.entries].sort((a, b) => parseEntryDate(a.date) - parseEntryDate(b.date));
    const descEntries = [...allEntries].reverse();
    const latestEntry = allEntries[allEntries.length - 1] || null;

    // Group entries by calendar day for the View All month-overview calendar.
    const entryDayKey = (e) => ymd(new Date(parseEntryDate(e.date)));
    const entriesByDay = {};
    allEntries.forEach(e => { (entriesByDay[entryDayKey(e)] = entriesByDay[entryDayKey(e)] || []).push(e); });
    const entryDays = new Set(Object.keys(entriesByDay));
    const goal = activeMeasurement.goal == null || activeMeasurement.goal === '' ? null : Number(activeMeasurement.goal);

    const days = range === '7D' ? 7 : 14;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days);
    const sinceMs = since.getTime();
    const rangeEntries = allEntries.filter(e => parseEntryDate(e.date) >= sinceMs);

    // Comparison overlay: any series from the cross-domain catalog (measurement /
    // nutrition / PR), sliced to the same window and normalized independently in
    // the chart (different units are expected — we compare shape, not magnitude).
    const compareItem = compareId ? findCatalogItem(compareCatalog, compareId) : null;
    const compareData = compareItem ? {
      entries: [...compareItem.entries]
        .sort((a, b) => parseEntryDate(a.date) - parseEntryDate(b.date))
        .filter(e => parseEntryDate(e.date) >= sinceMs),
      color: compareItem.color,
      unit: compareItem.unit,
      label: compareItem.label,
    } : null;

    // Weekly trend delta — shared with Nutrition and the dashboard trend widgets
    // (see trendMath.js) so all three always show the identical number.
    const { diff, showDelta, compareLabel } = weeklyTrendDelta(allEntries);
    const last7 = descEntries.slice(0, 7);

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
        {(defaultIds.has(activeMeasurement.id) || DEFAULT_MEASUREMENT_NAME_SET.has((activeMeasurement.name || '').toLowerCase())) ? (
          // Default (hardcoded) measurements can't be renamed — show a static title.
          <h2 style={{ width: '100%', margin: 0, fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', padding: '2px 0' }}>
            {activeMeasurement.name}
          </h2>
        ) : (
          <input
            value={activeMeasurement.name}
            placeholder="Measurement name"
            autoFocus={!activeMeasurement.name}
            onChange={e => updateActiveName(e.target.value)}
            onBlur={persistActiveName}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            style={{ width: '100%', margin: 0, fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', outline: 'none', padding: '2px 0' }}
          />
        )}

        {/* TREND */}
        <div className="card-flat">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={sectionLabel}>Trend</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setCompareSheetOpen(true)} style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px',
                border: compareItem ? `1px solid ${compareData.color}` : '1px solid var(--border)',
                background: 'var(--bg)', color: compareItem ? compareData.color : 'var(--text-secondary)',
                fontSize: '12px', fontWeight: '700', cursor: 'pointer', maxWidth: '150px',
              }}>
                {compareItem ? (
                  <>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: compareData.color, flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{compareData.label}</span>
                    <span onClick={(e) => { e.stopPropagation(); setCompareId(null); }} style={{ marginLeft: '2px', fontSize: '14px', lineHeight: 1, flexShrink: 0 }}>×</span>
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 19V9M10 19V5M16 19v-7M20 19H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Compare
                  </>
                )}
              </button>
              <RangePopover value={range} options={['7D', '14D']} onChange={setRange} />
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
                ? <TrendCompareChart
                    base={{ entries: rangeEntries, color, unit: latestEntry.unit, label: activeMeasurement.name || 'This' }}
                    compare={compareData}
                  />
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
              <input value={newUnit} onChange={e => setNewUnit(e.target.value)}
                placeholder="Unit" className="input" style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '12px 4px', fontSize: '14px', fontWeight: '600' }} />
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

        {/* Compare picker */}
        {compareSheetOpen && (
          <CompareSheet
            catalog={compareCatalog}
            loading={compareLoading}
            selectedId={compareId}
            onSelect={setCompareId}
            onRemove={() => setCompareId(null)}
            onClose={() => setCompareSheetOpen(false)}
          />
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
          <div ref={hist.sheetRef} onPointerDown={hist.onPointerDown} style={{
            position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg)',
            transform: historyOpen ? `translateY(${hist.dragY}px)` : 'translateY(100%)',
            transition: hist.dragging ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, userSelect: 'none' }}>
              <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
            </div>
            <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px' }}>{activeMeasurement.name}</h2>
                {/* Calendar toggle — switches the list for a month-overview of logged days. */}
                <button onClick={() => setHistoryCalendar(v => !v)} aria-label="Toggle calendar"
                  style={{ background: historyCalendar ? 'var(--accent-light)' : 'none', border: historyCalendar ? '1px solid var(--border)' : '1px solid transparent', borderRadius: '8px', cursor: 'pointer', padding: '6px', color: 'var(--accent)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              <p style={{ ...sectionLabel, marginTop: '6px' }}>History</p>
            </div>
            <div ref={hist.scrollRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 32px' }}>
              {historyCalendar ? (
                <div className="card-flat" style={{ padding: '16px' }}>
                  <MonthOverviewCalendar
                    markedDays={entryDays}
                    onSelectDay={(key) => {
                      const dayEntries = entriesByDay[key];
                      if (dayEntries && dayEntries.length) {
                        const d = new Date(key + 'T00:00:00');
                        setDayModal({ label: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), entries: dayEntries });
                      }
                    }}
                  />
                </div>
              ) : (
                descEntries.map((entry, i, arr) => renderEntryRow(entry, i, arr, i === 0))
              )}
            </div>

            {/* Day detail — tapping a logged day in the calendar shows that day's entry. */}
            {dayModal && (
              <div onClick={() => setDayModal(null)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '20px' }}>
                <div onClick={e => e.stopPropagation()}
                  style={{ background: 'var(--card)', border: '1.5px solid var(--accent)', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '320px', animation: 'restTileIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }}>{dayModal.label}</span>
                    <button onClick={() => setDayModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                  {dayModal.entries.map((entry) => (
                    <div key={entry.id} style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', padding: '4px 0' }}>
                      {entry.value}{entry.unit ? <span style={{ fontSize: '0.7em', fontWeight: '600', marginLeft: '2px' }}>{entry.unit}</span> : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}

export default Measurements;