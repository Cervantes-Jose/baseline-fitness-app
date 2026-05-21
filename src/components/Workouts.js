import React, { useState } from 'react';

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

export default Workouts;