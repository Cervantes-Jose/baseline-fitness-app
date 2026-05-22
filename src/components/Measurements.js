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
      <polyline points={points} fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {entries.map((e, i) => {
        const x = pad + (i / (entries.length - 1)) * (w - pad * 2);
        const y = h - pad - ((Number(e.value) - min) / range) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="3" fill="#4CAF50" />;
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

  if (loading) return <p style={{ color: '#888', textAlign: 'center', marginTop: '40px' }}>Loading...</p>;

  if (view === 'list') return (
    <div>
      <h2 style={{ marginTop: 0 }}>Measurements</h2>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="New measurement (e.g. Weight)"
          onKeyDown={e => e.key === 'Enter' && addMeasurement()}
          style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #333', background: '#222', color: 'white', fontSize: '14px' }} />
        <button onClick={addMeasurement}
          style={{ padding: '10px 16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', fontSize: '20px', cursor: 'pointer' }}>+</button>
      </div>
      {measurements.length === 0 && <p style={{ color: '#444', textAlign: 'center', marginTop: '40px' }}>No measurements yet. Create one above.</p>}
      {measurements.map(m => {
        const last = m.entries[m.entries.length - 1];
        return (
          <div key={m.id} onClick={() => openMeasurement(m)}
            style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '16px', marginBottom: '10px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{m.name}</div>
              {last && <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4CAF50' }}>{last.value}{last.unit && ` ${last.unit}`}</div>}
            </div>
            <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>{m.entries.length} entr{m.entries.length !== 1 ? 'ies' : 'y'}</div>
          </div>
        );
      })}
    </div>
  );

  if (view === 'detail') return (
    <div>
      <button onClick={() => setView('list')} style={{ background: 'transparent', border: 'none', color: '#4CAF50', cursor: 'pointer', fontSize: '14px', padding: '0 0 16px 0' }}>← Back</button>
      <h2 style={{ marginTop: 0 }}>{activeMeasurement.name}</h2>
      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 10px', fontWeight: 'bold', fontSize: '13px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Log Entry</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={newValue} onChange={e => setNewValue(e.target.value)}
            placeholder="Value"
            style={{ flex: 2, padding: '10px', borderRadius: '6px', border: '1px solid #333', background: '#222', color: 'white', fontSize: '14px' }} />
          <input value={newUnit} onChange={e => setNewUnit(e.target.value)}
            placeholder="Unit (lbs, in...)"
            style={{ flex: 2, padding: '10px', borderRadius: '6px', border: '1px solid #333', background: '#222', color: 'white', fontSize: '14px' }} />
          <button onClick={logEntry}
            style={{ flex: 1, padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', fontSize: '20px', cursor: 'pointer' }}>+</button>
        </div>
      </div>
      {activeMeasurement.entries.length > 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 4px', fontWeight: 'bold', fontSize: '13px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Trend</p>
          <MiniChart entries={activeMeasurement.entries} />
        </div>
      )}
      <p style={{ margin: '0 0 10px', fontWeight: 'bold', fontSize: '13px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>History</p>
      {[...activeMeasurement.entries].reverse().map((entry, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '12px 14px', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', color: '#666' }}>{entry.date}</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{entry.value}{entry.unit && ` ${entry.unit}`}</span>
        </div>
      ))}
    </div>
  );
}

export default Measurements;