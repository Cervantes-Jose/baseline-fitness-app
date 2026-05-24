import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function MiniChart({ entries }) {
  if (entries.length < 2) return null;
  const values = entries.map(e => Number(e.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 280, h = 60, pad = 8;

  const points = entries.map((e, i) => {
    const x = pad + (i / (entries.length - 1)) * (w - pad * 2);
    const y = h - pad - ((Number(e.value) - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} style={{ display: 'block', marginTop: '8px' }}>
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {entries.map((e, i) => {
        const x = pad + (i / (entries.length - 1)) * (w - pad * 2);
        const y = h - pad - ((Number(e.value) - min) / range) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="3" fill="var(--accent)" />;
      })}
    </svg>
  );
}

function Measurements() {
  const [view, setView] = useState('list');
  const [measurements, setMeasurements] = useState([]);
  const [newName, setNewName] = useState('');
  const [activeMeasurement, setActiveMeasurement] = useState(null);
  const [newValue, setNewValue] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadMeasurements();
  }, []);

  const loadMeasurements = async () => {
    setLoading(true);
    const { data: measurementData, error: measurementError } = await supabase
      .from('measurements')
      .select('*')
      .order('created_at', { ascending: true });

    if (measurementError) { console.error(measurementError); setLoading(false); return; }

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

  const openMeasurement = (m) => { setActiveMeasurement(m); setView('detail'); };

  const logEntry = async () => {
    if (!newValue.trim()) return;
    const { data, error } = await supabase
      .from('measurement_entries')
      .insert([{
        measurement_id: activeMeasurement.id,
        value: newValue,
        unit: newUnit,
        date: new Date().toLocaleDateString()
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
          <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-primary)' }}>Add Measurement</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>e.g. Weight, Body Fat, Arms</div>
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
              placeholder="e.g. Weight, Body Fat, Arms"
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

      {measurements.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>No measurements yet. Add one above.</p>
      )}
      {measurements.map(m => {
        const last = m.entries[m.entries.length - 1];
        return (
          <div key={m.id} className="card" onClick={() => openMeasurement(m)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-primary)' }}>{m.name}</div>
              {last && (
                <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent)' }}>
                  {last.value}{last.unit && ` ${last.unit}`}
                </div>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {m.entries.length} entr{m.entries.length !== 1 ? 'ies' : 'y'}
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
        <p className="section-title">Log Entry</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <input value={newValue} onChange={e => setNewValue(e.target.value)}
            placeholder="Value" className="input" style={{ flex: 2 }} />
          <input value={newUnit} onChange={e => setNewUnit(e.target.value)}
            placeholder="Unit (lbs, in...)" className="input" style={{ flex: 2 }} />
          <button onClick={logEntry}
            style={{ flex: 1, padding: '10px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '20px', cursor: 'pointer' }}>+</button>
        </div>
      </div>
      {activeMeasurement.entries.length > 0 && (
        <div className="card">
          <p className="section-title">Trend</p>
          <MiniChart entries={activeMeasurement.entries} />
        </div>
      )}
      <div className="card">
        <p className="section-title">History</p>
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...activeMeasurement.entries].reverse().map((entry, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < activeMeasurement.entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{entry.date}</span>
              <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {entry.value}{entry.unit && ` ${entry.unit}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Measurements;