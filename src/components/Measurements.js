import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function TrendChart({ entries }) {
  if (entries.length === 0) return null;

  const parseDate = s => s && /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(s + 'T00:00:00').getTime()
    : new Date(s).getTime();

  const sorted = [...entries].sort((a, b) => parseDate(a.date) - parseDate(b.date));

  const values = sorted.map(e => Number(e.value));
  const min = Math.min(...values);
  const max = Math.max(...values);

  const W = 320, H = 160, padL = 44, padR = 16, padT = 16, padB = 28;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const toX = i => padL + (sorted.length === 1 ? cW / 2 : (i / (sorted.length - 1)) * cW);
  const toY = v => max === min ? padT + cH / 2 : padT + cH - ((v - min) / (max - min)) * cH;

  const points = sorted.map((e, i) => `${toX(i)},${toY(Number(e.value))}`).join(' ');

  const fmtVal = v => v % 1 === 0 ? String(v) : v.toFixed(1);
  const fmtDate = s => {
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [, m, d] = s.split('-');
      return `${Number(m)}/${Number(d)}`;
    }
    const p = s.split('/');
    return p.length >= 2 ? `${p[0]}/${p[1]}` : s;
  };

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', marginTop: '8px' }}>
      <line x1={padL} y1={padT} x2={W - padR} y2={padT} stroke="var(--border)" strokeWidth="1" />
      <line x1={padL} y1={padT + cH} x2={W - padR} y2={padT + cH} stroke="var(--border)" strokeWidth="1" />
      <text x={padL - 6} y={padT + (max === min ? cH / 2 + 4 : 4)} textAnchor="end" fontSize="11" fill="var(--text-muted)">{fmtVal(max)}</text>
      {max !== min && <text x={padL - 6} y={padT + cH + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{fmtVal(min)}</text>}
      {sorted.length > 1 && <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {sorted.map((e, i) => <circle key={i} cx={toX(i)} cy={toY(Number(e.value))} r="4" fill="var(--accent)" />)}
      <text x={toX(0)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{fmtDate(sorted[0].date)}</text>
      {sorted.length > 1 && <text x={toX(sorted.length - 1)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{fmtDate(sorted[sorted.length - 1].date)}</text>}
    </svg>
  );
}

const DEFAULT_MEASUREMENT_NAMES = [
  'Weight', 'Body Fat', 'Neck', 'Chest', 'Left Bicep', 'Right Bicep',
  'Stomach', 'Hips', 'Glutes', 'Left Thigh', 'Right Thigh',
];

function getDefaultUnit(name, metricSystem) {
  if (name === 'Weight' || name === 'Body Fat') return metricSystem === 'metric' ? 'kg' : 'lbs';
  return metricSystem === 'metric' ? 'cm' : 'in';
}

function Measurements({ metricSystem = 'imperial' }) {
  const [view, setView] = useState('list');
  const [measurements, setMeasurements] = useState([]);
  const [newName, setNewName] = useState('');
  const [activeMeasurement, setActiveMeasurement] = useState(null);
  const [newValue, setNewValue] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newDate, setNewDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [defaultIds, setDefaultIds] = useState(() => new Set(JSON.parse(localStorage.getItem('defaultMeasurementIds') || '[]')));
  const [menuOpen, setMenuOpen] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [renamingMeasurement, setRenamingMeasurement] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    loadMeasurements();
  }, []);

  useEffect(() => {
    if (activeMeasurement) setNewUnit(getDefaultUnit(activeMeasurement.name, metricSystem));
  }, [metricSystem]);

  const loadMeasurements = async () => {
    setLoading(true);
    const { data: measurementData, error: measurementError } = await supabase
      .from('measurements')
      .select('*')
      .order('created_at', { ascending: true });

    if (measurementError) { console.error(measurementError); setLoading(false); return; }

    let storedDefaultIds = JSON.parse(localStorage.getItem('defaultMeasurementIds') || '[]');

    if (storedDefaultIds.length === 0 && measurementData.length === 0) {
      const { data: seeded, error: seedError } = await supabase
        .from('measurements')
        .insert(DEFAULT_MEASUREMENT_NAMES.map(name => ({ name })))
        .select();
      if (!seedError && seeded) {
        storedDefaultIds = seeded.map(m => m.id);
        localStorage.setItem('defaultMeasurementIds', JSON.stringify(storedDefaultIds));
        setDefaultIds(new Set(storedDefaultIds));
        setMeasurements(seeded.map(m => ({ ...m, entries: [] })));
        setLoading(false);
        return;
      }
    }

    const validIds = storedDefaultIds.filter(id => measurementData.some(m => m.id === id));
    if (validIds.length !== storedDefaultIds.length) {
      localStorage.setItem('defaultMeasurementIds', JSON.stringify(validIds));
    }
    setDefaultIds(new Set(validIds));

    const { data: entryData, error: entryError } = await supabase
      .from('measurement_entries')
      .select('*')
      .order('created_at', { ascending: true });

    if (entryError) { console.error(entryError); setLoading(false); return; }

    const measurementsWithEntries = measurementData.map(m => ({
      ...m,
      entries: entryData.filter(e => e.measurement_id === m.id)
    }));

    setMeasurements(measurementsWithEntries);
    setLoading(false);
  };

  const addMeasurement = async () => {
    if (!newName.trim()) return;
    const { data, error } = await supabase
      .from('measurements')
      .insert([{ name: newName.trim() }])
      .select()
      .single();

    if (error) { console.error(error); return; }
    setMeasurements([...measurements, { ...data, entries: [] }]);
    setNewName('');
    setShowModal(false);
  };

  const openMeasurement = (m) => {
    setActiveMeasurement(m);
    setNewUnit(getDefaultUnit(m.name, metricSystem));
    setView('detail');
  };

  const duplicateMeasurement = async (m) => {
    const { data, error } = await supabase.from('measurements').insert([{ name: `${m.name} (copy)` }]).select().single();
    if (error) { console.error(error); return; }
    setMeasurements(prev => [...prev, { ...data, entries: [] }]);
    setMenuOpen(null);
  };

  const deleteMeasurement = async (m) => {
    setMeasurements(prev => prev.filter(item => item.id !== m.id));
    setMenuOpen(null);
    await supabase.from('measurement_entries').delete().eq('measurement_id', m.id);
    await supabase.from('measurements').delete().eq('id', m.id);
  };

  const renameMeasurement = async () => {
    if (!renameValue.trim() || !renamingMeasurement) return;
    const { error } = await supabase.from('measurements').update({ name: renameValue.trim() }).eq('id', renamingMeasurement.id);
    if (error) { console.error(error); return; }
    setMeasurements(prev => prev.map(m => m.id === renamingMeasurement.id ? { ...m, name: renameValue.trim() } : m));
    setRenamingMeasurement(null);
    setRenameValue('');
  };

  const logEntry = async () => {
    if (!newValue.trim()) return;
    const { data, error } = await supabase
      .from('measurement_entries')
      .insert([{
        measurement_id: activeMeasurement.id,
        value: newValue,
        unit: newUnit,
        date: newDate
      }])
      .select()
      .single();

    if (error) { console.error(error); return; }

    const updated = measurements.map(m =>
      m.id === activeMeasurement.id ? { ...m, entries: [...m.entries, data] } : m
    );
    setMeasurements(updated);
    setActiveMeasurement(prev => ({ ...prev, entries: [...prev.entries, data] }));
    setNewValue('');
  };

  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>Loading...</p>;

  if (view === 'list') return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <button onClick={() => setShowModal(true)} style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        background: 'var(--accent-light)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '16px', cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)', width: '100%', textAlign: 'left',
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ color: 'white', fontSize: '24px', fontWeight: '300', lineHeight: 1 }}>+</span>
        </div>
        <div>
          <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-primary)' }}>Add Custom Measurement</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>e.g. Waist, Forearm, Calf</div>
        </div>
      </button>

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 300, padding: '16px',
        }} onClick={() => { setShowModal(false); setNewName(''); }}>
          <div className="card" style={{ width: '100%', maxWidth: '448px', padding: '24px' }}
            onClick={e => e.stopPropagation()}>
            <p className="section-title" style={{ marginBottom: '16px' }}>New Measurement</p>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMeasurement()}
              placeholder="e.g. Waist, Forearm, Calf"
              className="input" style={{ width: '100%', marginBottom: '16px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowModal(false); setNewName(''); }}
                style={{ flex: 1, padding: '14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={addMeasurement}
                style={{ flex: 1, padding: '14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
                Create
              </button>
            </div>
          </div>
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
        const isDefault = defaultIds.has(m.id);
        const options = [
          { label: 'Rename', action: () => { setRenamingMeasurement(m); setRenameValue(m.name); setMenuOpen(null); } },
          ...(!isDefault ? [
            { label: 'Duplicate', action: () => duplicateMeasurement(m) },
            { label: 'Delete', action: () => deleteMeasurement(m), danger: true },
          ] : []),
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

      {measurements.map(m => {
        const isDefault = defaultIds.has(m.id);
        const last = m.entries[m.entries.length - 1];
        return (
          <div key={m.id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openMeasurement(m)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-primary)' }}>{m.name}</span>
                  {!isDefault && (
                    <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: '8px' }}>Custom</span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {m.entries.length} entr{m.entries.length !== 1 ? 'ies' : 'y'}
                </div>
              </div>
              {last && (
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent)', flexShrink: 0 }}>
                  {last.value}{last.unit && ` ${last.unit}`}
                </div>
              )}
              <button onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                setMenuOpen(menuOpen === m.id ? null : m.id);
              }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', letterSpacing: '2px', flexShrink: 0 }}>
                ···
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (view === 'detail') return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <button onClick={() => setView('list')}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', textAlign: 'left', padding: 0 }}>
        ← Back
      </button>
      <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{activeMeasurement.name}</h2>
      <div className="card">
        <p className="section-title">Trend</p>
        {activeMeasurement.entries.length === 0
          ? <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0 8px' }}>Log your first entry to see the trend</p>
          : <TrendChart entries={activeMeasurement.entries} />
        }
      </div>
      <div className="card">
        <p className="section-title">Log Entry</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            className="input" style={{ width: '100%' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={newValue} onChange={e => setNewValue(e.target.value)}
              placeholder="Value" className="input" style={{ flex: 2 }} />
            <input value={newUnit} onChange={e => setNewUnit(e.target.value)}
              placeholder="Unit (lbs, in...)" className="input" style={{ flex: 2 }} />
            <button onClick={logEntry}
              style={{ flex: 1, padding: '10px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '20px', cursor: 'pointer' }}>+</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Measurements;