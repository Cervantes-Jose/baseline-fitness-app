import React, { useState } from 'react';

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const hour = i % 12 === 0 ? 12 : i % 12;
  const ampm = i < 12 ? 'AM' : 'PM';
  return { label: `${hour}:00 ${ampm}`, value: i };
});

// ─── FOOD LOG ───────────────────────────────────────────────
function FoodLog() {
  const currentHour = new Date().getHours();
  const [foods, setFoods] = useState({});
  const [selectedHour, setSelectedHour] = useState(currentHour);
  const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fats: '' });

  const addFood = () => {
    if (!form.name || !form.calories) return;
    const existing = foods[selectedHour] || [];
    setFoods({ ...foods, [selectedHour]: [...existing, form] });
    setForm({ name: '', calories: '', protein: '', carbs: '', fats: '' });
  };

  const allFoods = Object.values(foods).flat();
  const totals = allFoods.reduce((acc, f) => ({
    calories: acc.calories + Number(f.calories),
    protein: acc.protein + Number(f.protein),
    carbs: acc.carbs + Number(f.carbs),
    fats: acc.fats + Number(f.fats),
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Food Log</h2>
      {allFoods.length > 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 10px', fontWeight: 'bold', fontSize: '13px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Daily Totals</p>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {Object.entries(totals).map(([key, val]) => (
              <div key={key} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4CAF50' }}>{val}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>{key}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 10px', fontWeight: 'bold', fontSize: '13px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Add Food</p>
        <select value={selectedHour} onChange={e => setSelectedHour(Number(e.target.value))}
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #333', background: '#222', color: 'white', fontSize: '14px', marginBottom: '10px' }}>
          {HOURS.map(h => (
            <option key={h.value} value={h.value}>{h.label}{h.value === currentHour ? ' (Now)' : ''}</option>
          ))}
        </select>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {['name', 'calories', 'protein', 'carbs', 'fats'].map(field => (
            <input key={field} placeholder={field.charAt(0).toUpperCase() + field.slice(1)} value={form[field]}
              onChange={e => setForm({ ...form, [field]: e.target.value })}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #333', background: '#222', color: 'white', fontSize: '14px' }} />
          ))}
          <button onClick={addFood}
            style={{ padding: '12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold' }}>
            + Add Food
          </button>
        </div>
      </div>
      <p style={{ margin: '0 0 10px', fontWeight: 'bold', fontSize: '13px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Today</p>
      {HOURS.map(h => {
        const hourFoods = foods[h.value] || [];
        const isNow = h.value === currentHour;
        return (
          <div key={h.value} style={{ marginBottom: '4px', borderRadius: '8px', border: isNow ? '1px solid #4CAF50' : '1px solid #222', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: '#1a1a1a' }}>
              <span style={{ fontSize: '13px', color: isNow ? '#4CAF50' : '#555', width: '80px', fontWeight: isNow ? 'bold' : 'normal' }}>{h.label}</span>
              {hourFoods.length === 0 ? <span style={{ fontSize: '12px', color: '#333' }}>—</span> : (
                <div style={{ flex: 1 }}>
                  {hourFoods.map((f, i) => (
                    <div key={i} style={{ marginBottom: i < hourFoods.length - 1 ? '6px' : 0 }}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{f.name}</span>
                      <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>{f.calories} cal · {f.protein}g P · {f.carbs}g C · {f.fats}g F</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── WORKOUTS ───────────────────────────────────────────────
function Workouts() {
  const [view, setView] = useState('routines');
  const [routines, setRoutines] = useState([]);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [sessionLog, setSessionLog] = useState({});
  const [history, setHistory] = useState([]);

  const addRoutine = () => {
    if (!newRoutineName.trim()) return;
    setRoutines([...routines, { id: Date.now(), name: newRoutineName.trim(), exercises: [] }]);
    setNewRoutineName('');
  };

  const addExercise = () => {
    if (!newExerciseName.trim() || !activeRoutine) return;
    const newEx = { id: Date.now(), name: newExerciseName.trim(), lastSession: null };
    setRoutines(routines.map(r => r.id === activeRoutine.id ? { ...r, exercises: [...r.exercises, newEx] } : r));
    setActiveRoutine(prev => ({ ...prev, exercises: [...prev.exercises, newEx] }));
    setNewExerciseName('');
  };

  const openRoutine = (routine) => { setActiveRoutine(routine); setSessionLog({}); setView('exercises'); };

  const startLogging = () => {
    const initial = {};
    activeRoutine.exercises.forEach(ex => { initial[ex.id] = [{ sets: '', reps: '', weight: '' }]; });
    setSessionLog(initial);
    setView('logging');
  };

  const updateSet = (exId, setIdx, field, value) => {
    setSessionLog(prev => {
      const sets = [...(prev[exId] || [])];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      return { ...prev, [exId]: sets };
    });
  };

  const addSet = (exId) => {
    setSessionLog(prev => ({ ...prev, [exId]: [...(prev[exId] || []), { sets: '', reps: '', weight: '' }] }));
  };

  const finishWorkout = () => {
    const session = {
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      routineName: activeRoutine.name,
      exercises: activeRoutine.exercises.map(ex => ({ name: ex.name, sets: sessionLog[ex.id] || [] }))
    };
    setHistory([session, ...history]);
    setRoutines(routines.map(r =>
      r.id === activeRoutine.id
        ? { ...r, exercises: r.exercises.map(ex => ({ ...ex, lastSession: { sets: sessionLog[ex.id] || [] } })) }
        : r
    ));
    setView('routines');
    setActiveRoutine(null);
  };

  if (view === 'routines') return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>Workouts</h2>
        <button onClick={() => setView('history')}
          style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
          History
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)}
          placeholder="New routine name (e.g. Push)"
          onKeyDown={e => e.key === 'Enter' && addRoutine()}
          style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #333', background: '#222', color: 'white', fontSize: '14px' }} />
        <button onClick={addRoutine}
          style={{ padding: '10px 16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', fontSize: '20px', cursor: 'pointer' }}>+</button>
      </div>
      {routines.length === 0 && <p style={{ color: '#444', textAlign: 'center', marginTop: '40px' }}>No routines yet. Create one above.</p>}
      {routines.map(r => (
        <div key={r.id} onClick={() => openRoutine(r)}
          style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '16px', marginBottom: '10px', cursor: 'pointer' }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{r.name}</div>
          <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>{r.exercises.length} exercise{r.exercises.length !== 1 ? 's' : ''}</div>
        </div>
      ))}
    </div>
  );

  if (view === 'exercises') return (
    <div>
      <button onClick={() => setView('routines')} style={{ background: 'transparent', border: 'none', color: '#4CAF50', cursor: 'pointer', fontSize: '14px', padding: '0 0 16px 0' }}>← Back</button>
      <h2 style={{ marginTop: 0 }}>{activeRoutine.name}</h2>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input value={newExerciseName} onChange={e => setNewExerciseName(e.target.value)}
          placeholder="Add exercise (e.g. Bench Press)"
          onKeyDown={e => e.key === 'Enter' && addExercise()}
          style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #333', background: '#222', color: 'white', fontSize: '14px' }} />
        <button onClick={addExercise}
          style={{ padding: '10px 16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', fontSize: '20px', cursor: 'pointer' }}>+</button>
      </div>
      {activeRoutine.exercises.map(ex => (
        <div key={ex.id} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '14px', marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold' }}>{ex.name}</div>
          {ex.lastSession && (
            <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>
              Last: {ex.lastSession.sets.map(s => `${s.weight}lb × ${s.reps}`).join(' · ')}
            </div>
          )}
        </div>
      ))}
      {activeRoutine.exercises.length > 0 && (
        <button onClick={startLogging}
          style={{ width: '100%', padding: '14px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>
          Start Workout
        </button>
      )}
    </div>
  );

  if (view === 'logging') return (
    <div>
      <h2 style={{ marginTop: 0 }}>{activeRoutine.name}</h2>
      {activeRoutine.exercises.map(ex => (
        <div key={ex.id} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{ex.name}</div>
          {ex.lastSession && (
            <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px' }}>
              Last: {ex.lastSession.sets.map(s => `${s.weight}lb × ${s.reps}`).join(' · ')}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <div></div>
            {['Weight', 'Reps', 'Sets'].map(h => (
              <div key={h} style={{ fontSize: '11px', color: '#555', textAlign: 'center' }}>{h}</div>
            ))}
          </div>
          {(sessionLog[ex.id] || []).map((set, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
              <div style={{ fontSize: '13px', color: '#555', display: 'flex', alignItems: 'center' }}>{idx + 1}</div>
              {['weight', 'reps', 'sets'].map(field => (
                <input key={field} value={set[field]} onChange={e => updateSet(ex.id, idx, field, e.target.value)}
                  placeholder="0"
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid #333', background: '#222', color: 'white', fontSize: '14px', textAlign: 'center' }} />
              ))}
            </div>
          ))}
          <button onClick={() => addSet(ex.id)}
            style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginTop: '4px' }}>
            + Add Set
          </button>
        </div>
      ))}
      <button onClick={finishWorkout}
        style={{ width: '100%', padding: '14px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>
        Finish Workout
      </button>
    </div>
  );

  if (view === 'history') return (
    <div>
      <button onClick={() => setView('routines')} style={{ background: 'transparent', border: 'none', color: '#4CAF50', cursor: 'pointer', fontSize: '14px', padding: '0 0 16px 0' }}>← Back</button>
      <h2 style={{ marginTop: 0 }}>Workout History</h2>
      {history.length === 0 && <p style={{ color: '#444', textAlign: 'center', marginTop: '40px' }}>No completed workouts yet.</p>}
      {history.map(session => (
        <div key={session.id} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '14px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: 'bold' }}>{session.routineName}</span>
            <span style={{ fontSize: '12px', color: '#555' }}>{session.date}</span>
          </div>
          {session.exercises.map((ex, i) => (
            <div key={i} style={{ fontSize: '13px', color: '#888', marginBottom: '4px' }}>
              {ex.name}: {ex.sets.map(s => `${s.weight}lb × ${s.reps}`).join(' · ')}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── MEASUREMENTS ───────────────────────────────────────────
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

  const addMeasurement = () => {
    if (!newName.trim()) return;
    setMeasurements([...measurements, { id: Date.now(), name: newName.trim(), entries: [] }]);
    setNewName('');
  };

  const openMeasurement = (m) => { setActiveMeasurement(m); setView('detail'); };

  const logEntry = () => {
    if (!newValue.trim()) return;
    const entry = { date: new Date().toLocaleDateString(), value: newValue, unit: newUnit };
    const updated = measurements.map(m =>
      m.id === activeMeasurement.id ? { ...m, entries: [...m.entries, entry] } : m
    );
    setMeasurements(updated);
    setActiveMeasurement(prev => ({ ...prev, entries: [...prev.entries, entry] }));
    setNewValue('');
  };

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

// ─── APP ────────────────────────────────────────────────────
function App() {
  const [activeTab, setActiveTab] = useState('food');

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#111', minHeight: '100vh', color: 'white' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #333' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Fitness Tracker</h1>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
        {['food', 'workouts', 'measurements'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '14px',
              background: activeTab === tab ? '#222' : 'transparent',
              color: activeTab === tab ? 'white' : '#888',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #4CAF50' : '2px solid transparent',
              cursor: 'pointer', fontSize: '14px', textTransform: 'capitalize'
            }}>
            {tab}
          </button>
        ))}
      </div>
      <div style={{ padding: '20px' }}>
        {activeTab === 'food' && <FoodLog />}
        {activeTab === 'workouts' && <Workouts />}
        {activeTab === 'measurements' && <Measurements />}
      </div>
    </div>
  );
}

export default App;