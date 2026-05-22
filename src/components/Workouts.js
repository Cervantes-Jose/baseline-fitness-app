import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableExercise({ ex, sessionLog, updateSet, addSet, deleteSet }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ex.id });
  const [expanded, setExpanded] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: 'var(--card)', borderRadius: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid var(--border)',
    overflow: 'hidden'
  };

  const sets = sessionLog ? (sessionLog[ex.id] || []) : [];

  return (
    <div ref={setNodeRef} style={style}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '18px 16px', gap: '12px' }}>
        <div {...attributes} {...listeners}
          style={{ cursor: 'grab', color: 'var(--text-muted)', padding: '4px', touchAction: 'none', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/>
            <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
            <circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }}>{ex.name}</div>
          {!expanded && ex.lastSession && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Last: {ex.lastSession.sets.map(s => `${s.weight}lb × ${s.reps}`).join(' · ')}
            </div>
          )}
        </div>
        <button onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: '4px', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d={expanded ? "M5 12l5-5 5 5" : "M5 8l5 5 5-5"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Expanded sets */}
      <div style={{
       maxHeight: expanded ? '600px' : '0',
        overflow: 'hidden',
        transition: expanded ? 'max-height 0.3s ease' : 'max-height 0.2s ease-in',
        padding: expanded ? '0 16px 16px' : '0 16px 0',
      }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 36px', gap: '8px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Set</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Weight</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Reps</div>
            <div></div>
          </div>

          {/* Set rows */}
          {sets.map((set, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 36px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600' }}>{idx + 1}</div>
              <input value={set.weight} onChange={e => updateSet(ex.id, idx, 'weight', e.target.value)}
                placeholder="0" className="input"
                style={{ padding: '10px', textAlign: 'center' }} />
              <input value={set.reps} onChange={e => updateSet(ex.id, idx, 'reps', e.target.value)}
                placeholder="0" className="input"
                style={{ padding: '10px', textAlign: 'center' }} />
              <button onClick={() => deleteSet(ex.id, idx)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          ))}

          <button onClick={() => addSet(ex.id)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
            + Add Set
          </button>
        </div>
    </div>
  );
}

function Workouts({ activeWorkout, setActiveWorkout, workoutSeconds }) {
  const [view, setView] = useState(activeWorkout ? 'logging' : 'routines');
  const [routines, setRoutines] = useState([]);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [activeRoutine, setActiveRoutine] = useState(activeWorkout?.routine || null);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [sessionLog, setSessionLog] = useState(activeWorkout?.sessionLog || {});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(null);
  const [renamingRoutine, setRenamingRoutine] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  

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
    setShowCreateModal(false);
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
    setShowAddExerciseModal(false);
  };

  const openRoutine = (routine) => { setActiveRoutine(routine); setSessionLog({}); setView('exercises'); };

  const sensors = useSensors(useSensor(PointerSensor));

const handleDragEnd = (event) => {
  const { active, over } = event;
  if (active.id !== over?.id) {
    const oldIndex = activeRoutine.exercises.findIndex(e => e.id === active.id);
    const newIndex = activeRoutine.exercises.findIndex(e => e.id === over.id);
    const reordered = arrayMove(activeRoutine.exercises, oldIndex, newIndex);
    setActiveRoutine(prev => ({ ...prev, exercises: reordered }));
    setRoutines(routines.map(r => r.id === activeRoutine.id ? { ...r, exercises: reordered } : r));
  }
};

  const startLogging = () => {
    const initial = {};
    activeRoutine.exercises.forEach(ex => { initial[ex.id] = [{ sets: '', reps: '', weight: '' }]; });
    setSessionLog(initial);
    setView('logging');
    setActiveWorkout({ routineName: activeRoutine.name, startTime: Date.now(), routine: activeRoutine, sessionLog: initial });
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
  const deleteSet = (exId, setIdx) => {
  setSessionLog(prev => {
    const sets = [...(prev[exId] || [])];
    sets.splice(setIdx, 1);
    return { ...prev, [exId]: sets };
  });
};

 const finishWorkout = async () => {
    const { data: session, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert([{ routine_id: activeRoutine.id, routine_name: activeRoutine.name, date: new Date().toLocaleDateString(), duration: workoutSeconds }])
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
    setActiveWorkout(null);
    setView('routines');
    setActiveRoutine(null);
  };

  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>Loading...</p>;

  if (view === 'routines') return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      
      {/* Create New Routine Card */}
      <button onClick={() => setShowCreateModal(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: '16px',
          background: 'var(--accent-light)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '16px', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)', width: '100%', textAlign: 'left'
        }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px',
          background: 'var(--accent)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0
        }}>
          <span style={{ color: 'white', fontSize: '24px', lineHeight: 1 }}>+</span>
        </div>
        <div>
          <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-primary)' }}>Create New Routine</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>e.g. Push, Pull, Legs</div>
        </div>
      </button>

      {/* My Routines */}
      {routines.length > 0 && (
        <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '8px 0 0' }}>My Routines</p>
      )}

      {routines.map(r => (
        <div key={r.id}
          style={{
            background: 'var(--card)', borderRadius: '16px', padding: '18px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
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
                <div style={{ fontWeight: '700', fontSize: '18px', color: 'var(--text-primary)' }}>{r.name}</div>
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

      {/* Click outside to close menu */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
      )}

      {/* Create Routine Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500
        }} onClick={() => setShowCreateModal(false)}>
          <div style={{ background: 'var(--card)', borderRadius: '16px', padding: '24px', width: '300px' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: '600', marginBottom: '16px', fontSize: '16px', color: 'var(--text-primary)' }}>New Routine</p>
            <input value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)}
              placeholder="e.g. Push, Pull, Legs"
              className="input" style={{ marginBottom: '16px' }}
              onKeyDown={e => e.key === 'Enter' && addRoutine()}
              autoFocus />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={addRoutine} className="btn-primary" style={{ flex: 1 }}>Create</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  if (view === 'exercises') return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <button onClick={() => setView('routines')}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '15px', fontWeight: '600', textAlign: 'left', padding: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
        ← Back
      </button>

      <button onClick={() => setShowAddExerciseModal(true)}
  style={{
    display: 'flex', alignItems: 'center', gap: '16px',
    background: 'var(--accent-light)', border: '1px solid var(--border)',
    borderRadius: '16px', padding: '16px', cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', width: '100%', textAlign: 'left', marginBottom: '4px'
  }}>
  <div style={{
    width: '48px', height: '48px', borderRadius: '12px',
    background: 'var(--accent)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0
  }}>
    <span style={{ color: 'white', fontSize: '24px', lineHeight: 1 }}>+</span>
  </div>
  <div>
    <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-primary)' }}>Add Exercise</div>
    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>e.g. Bench Press, Squat</div>
  </div>
</button>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeRoutine.exercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
  {activeRoutine.exercises.map(ex => (
    <SortableExercise key={ex.id} ex={ex} sessionLog={sessionLog} updateSet={updateSet} addSet={addSet} deleteSet={deleteSet} />
  ))}
</SortableContext>
      </DndContext>

      {activeRoutine.exercises.length > 0 && (
        <button onClick={startLogging}
          style={{
            width: '100%', padding: '18px', background: 'var(--accent)', color: 'white',
            border: 'none', borderRadius: '16px', fontSize: '17px', cursor: 'pointer',
            fontWeight: '700', marginTop: '8px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '10px'
          }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
            <path d="M3 2l10 6-10 6V2z"/>
          </svg>
          Start Workout
        </button>
      )}
    {showAddExerciseModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500
        }} onClick={() => setShowAddExerciseModal(false)}>
          <div style={{ background: 'var(--card)', borderRadius: '16px', padding: '24px', width: '300px' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: '600', marginBottom: '16px', fontSize: '16px', color: 'var(--text-primary)' }}>Add Exercise</p>
            <input value={newExerciseName} onChange={e => setNewExerciseName(e.target.value)}
              placeholder="e.g. Bench Press"
              className="input" style={{ marginBottom: '16px' }}
              onKeyDown={e => e.key === 'Enter' && addExercise()}
              autoFocus />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAddExerciseModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={addExercise} className="btn-primary" style={{ flex: 1 }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (view === 'logging') return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{activeRoutine.name}</h2>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeRoutine.exercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
          {activeRoutine.exercises.map(ex => (
            <SortableExercise key={ex.id} ex={ex} sessionLog={sessionLog} updateSet={updateSet} addSet={addSet} deleteSet={deleteSet} />
          ))}
        </SortableContext>
      </DndContext>
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

if (view === 'editing') return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <button onClick={() => setView('routines')}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', textAlign: 'left', padding: 0 }}>
        ← Back
      </button>
      <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{activeRoutine.name}</h2>
      {activeRoutine.exercises.map(ex => (
        <div key={ex.id} className="card">
          <div style={{ fontWeight: '600', marginBottom: '10px', color: 'var(--text-primary)' }}>{ex.name}</div>
          {ex.lastSession ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                <div></div>
                {['Weight', 'Reps', 'Sets'].map(h => (
                  <div key={h} style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                ))}
              </div>
              {ex.lastSession.sets.map((set, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>{idx + 1}</div>
                  {['weight', 'reps', 'sets'].map(field => (
                    <input key={field} defaultValue={set[field]}
                      onChange={e => {
                        const updated = activeRoutine.exercises.map(exercise =>
                          exercise.id === ex.id ? {
                            ...exercise,
                            lastSession: {
                              sets: exercise.lastSession.sets.map((s, i) =>
                                i === idx ? { ...s, [field]: e.target.value } : s
                              )
                            }
                          } : exercise
                        );
                        setActiveRoutine(prev => ({ ...prev, exercises: updated }));
                      }}
                      placeholder="0" className="input"
                      style={{ padding: '8px', textAlign: 'center' }} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No previous session data.</p>
          )}
        </div>
      ))}
      <button onClick={() => {
        setRoutines(routines.map(r => r.id === activeRoutine.id ? activeRoutine : r));
        setView('routines');
      }} className="btn-primary">Save Changes</button>
    </div>
  );
}

export default Workouts;