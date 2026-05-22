import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function Workouts() {
  const [view, setView] = useState('routines');
  const [routines, setRoutines] = useState([]);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [sessionLog, setSessionLog] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(null);
  const [renamingRoutine, setRenamingRoutine] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    loadRoutines();
    loadHistory();
  }, []);

  const loadRoutines = async () => {
    setLoading(true);
    const { data: routineData, error: routineError } = await supabase
      .from('routines')
      .select('*')
      .order('created_at', { ascending: true });

    if (routineError) { console.error(routineError); setLoading(false); return; }

    const { data: exerciseData, error: exerciseError } = await supabase
      .from('exercises')
      .select('*')
      .order('created_at', { ascending: true });

    if (exerciseError) { console.error(exerciseError); setLoading(false); return; }

    const routinesWithExercises = routineData.map(r => ({
      ...r,
      exercises: exerciseData.filter(e => e.routine_id === r.id).map(e => ({
        ...e,
        lastSession: null
      }))
    }));

    setRoutines(routinesWithExercises);
    setLoading(false);
  };

  const loadHistory = async () => {
    const { data: sessions, error } = await supabase
      .from('workout_sessions')
      .select('*, session_exercises(*)')
      .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }

    const formatted = sessions.map(s => ({
      id: s.id,
      date: s.date,
      routineName: s.routine_name,
      exercises: s.session_exercises.map(e => ({
        name: e.exercise_name,
        sets: e.sets
      }))
    }));

    setHistory(formatted);
  };

  const addRoutine = async () => {
    if (!newRoutineName.trim()) return;
    const { data, error } = await supabase
      .from('routines')
      .insert([{ name: newRoutineName.trim() }])
      .select()
      .single();

    if (error) { console.error(error); return; }
    setRoutines([...routines, { ...data, exercises: [] }]);
    setNewRoutineName('');
  };

  const deleteRoutine = async (id) => {
    const { error } = await supabase.from('routines').delete().eq('id', id);
    if (error) { console.error(error); return; }
    setRoutines(routines.filter(r => r.id !== id));
  };
  const renameRoutine = (routine) => {
  setRenamingRoutine(routine);
  setRenameValue(routine.name);
  setMenuOpen(null);
};

const submitRename = async () => {
  if (!renameValue.trim() || !renamingRoutine) return;
  const { error } = await supabase
    .from('routines')
    .update({ name: renameValue.trim() })
    .eq('id', renamingRoutine.id);

  if (error) { console.error(error); return; }
  setRoutines(routines.map(r => r.id === renamingRoutine.id ? { ...r, name: renameValue.trim() } : r));
  setRenamingRoutine(null);
  setRenameValue('');
};

const duplicateRoutine = async (routine) => {
  setMenuOpen(null);
  const { data: newRoutine, error: routineError } = await supabase
    .from('routines')
    .insert([{ name: `${routine.name} (copy)` }])
    .select()
    .single();

  if (routineError) { console.error(routineError); return; }

  if (routine.exercises.length > 0) {
    const exerciseCopies = routine.exercises.map(ex => ({
      routine_id: newRoutine.id,
      name: ex.name
    }));
    const { data: newExercises, error: exError } = await supabase
      .from('exercises')
      .insert(exerciseCopies)
      .select();

    if (exError) { console.error(exError); return; }
    setRoutines([...routines, { ...newRoutine, exercises: newExercises.map(e => ({ ...e, lastSession: null })) }]);
  } else {
    setRoutines([...routines, { ...newRoutine, exercises: [] }]);
  }
};

  const addExercise = async () => {
    if (!newExerciseName.trim() || !activeRoutine) return;
    const { data, error } = await supabase
      .from('exercises')
      .insert([{ routine_id: activeRoutine.id, name: newExerciseName.trim() }])
      .select()
      .single();

    if (error) { console.error(error); return; }
    const newEx = { ...data, lastSession: null };
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

  const finishWorkout = async () => {
    const { data: session, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert([{ routine_id: activeRoutine.id, routine_name: activeRoutine.name, date: new Date().toLocaleDateString() }])
      .select()
      .single();

    if (sessionError) { console.error(sessionError); return; }

    const exerciseInserts = activeRoutine.exercises.map(ex => ({
      session_id: session.id,
      exercise_name: ex.name,
      sets: sessionLog[ex.id] || []
    }));

    const { error: exError } = await supabase.from('session_exercises').insert(exerciseInserts);
    if (exError) { console.error(exError); return; }

    await loadHistory();
    setView('routines');
    setActiveRoutine(null);
  };

  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>Loading...</p>;

  if (view === 'routines') return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)}
          placeholder="New routine (e.g. Push)"
          onKeyDown={e => e.key === 'Enter' && addRoutine()}
          className="input" style={{ flex: 1 }} />
        <button onClick={addRoutine}
          style={{ padding: '12px 18px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '20px', cursor: 'pointer' }}>+</button>
      </div>
      {routines.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>No routines yet. Create one above.</p>
      )}
      {routines.map(r => (
  <div key={r.id} className="card"
    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ flex: 1, cursor: renamingRoutine?.id === r.id ? 'default' : 'pointer' }}
  onClick={() => renamingRoutine?.id !== r.id && openRoutine(r)}>
  {renamingRoutine?.id === r.id ? (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
        className="input" style={{ flex: 1, padding: '8px 12px', fontSize: '15px' }}
        onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenamingRoutine(null); }}
        autoFocus />
      <button onClick={submitRename} className="btn-secondary">Save</button>
    </div>
  ) : (
    <>
      <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-primary)' }}>{r.name}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
        {r.exercises.length} exercise{r.exercises.length !== 1 ? 's' : ''}
      </div>
    </>
  )}
</div>
    <div style={{ position: 'relative' }}>
      <button onClick={() => setMenuOpen(menuOpen === r.id ? null : r.id)}
        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', padding: '8px 0 8px 16px', minWidth: '44px', textAlign: 'center', letterSpacing: '2px' }}>
        ···
      </button>
      {menuOpen === r.id && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', background: 'var(--card)',
          border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, minWidth: '140px'
        }}>
          {[
            { label: 'Rename', action: () => renameRoutine(r) },
            { label: 'Duplicate', action: () => duplicateRoutine(r) },
            { label: 'Delete', action: () => { deleteRoutine(r.id); setMenuOpen(null); }, danger: true },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              style={{
                display: 'block', width: '100%', padding: '12px 16px', background: 'none',
                border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px',
                fontWeight: '500', color: item.danger ? '#ff4444' : 'var(--text-primary)',
                borderBottom: item.label !== 'Delete' ? '1px solid var(--border)' : 'none'
              }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
))}

    </div>
  );

  if (view === 'exercises') return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <button onClick={() => setView('routines')}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', textAlign: 'left', padding: 0 }}>
        ← Back
      </button>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input value={newExerciseName} onChange={e => setNewExerciseName(e.target.value)}
          placeholder="Add exercise (e.g. Bench Press)"
          onKeyDown={e => e.key === 'Enter' && addExercise()}
          className="input" style={{ flex: 1 }} />
        <button onClick={addExercise}
          style={{ padding: '12px 18px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '20px', cursor: 'pointer' }}>+</button>
      </div>
      {activeRoutine.exercises.map(ex => (
        <div key={ex.id} className="card">
          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{ex.name}</div>
          {ex.lastSession && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Last: {ex.lastSession.sets.map(s => `${s.weight}lb × ${s.reps}`).join(' · ')}
            </div>
          )}
        </div>
      ))}
      {activeRoutine.exercises.length > 0 && (
        <button onClick={startLogging} className="btn-primary">Start Workout</button>
      )}
    </div>
  );

  if (view === 'logging') return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{activeRoutine.name}</h2>
      {activeRoutine.exercises.map(ex => (
        <div key={ex.id} className="card">
          <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>{ex.name}</div>
          {ex.lastSession && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Last: {ex.lastSession.sets.map(s => `${s.weight}lb × ${s.reps}`).join(' · ')}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <div></div>
            {['Weight', 'Reps', 'Sets'].map(h => (
              <div key={h} style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
            ))}
          </div>
          {(sessionLog[ex.id] || []).map((set, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>{idx + 1}</div>
              {['weight', 'reps', 'sets'].map(field => (
                <input key={field} value={set[field]} onChange={e => updateSet(ex.id, idx, field, e.target.value)}
                  placeholder="0" className="input"
                  style={{ padding: '8px', textAlign: 'center' }} />
              ))}
            </div>
          ))}
          <button onClick={() => addSet(ex.id)} className="btn-secondary" style={{ marginTop: '6px' }}>
            + Add Set
          </button>
        </div>
      ))}
      <button onClick={finishWorkout} className="btn-primary">Finish Workout</button>
    </div>
  );

  if (view === 'history') return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <button onClick={() => setView('routines')}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', textAlign: 'left', padding: 0 }}>
        ← Back
      </button>
      <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Workout History</h2>
      {history.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>No completed workouts yet.</p>
      )}
      {history.map(session => (
        <div key={session.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{session.routineName}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{session.date}</span>
          </div>
          {session.exercises.map((ex, i) => (
            <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {ex.name}: {ex.sets.map(s => `${s.weight}lb × ${s.reps}`).join(' · ')}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default Workouts;