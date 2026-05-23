import React, { useState, useEffect, useRef } from 'react';
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
import SwipeToDelete from './SwipeToDelete';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function SortableExercise({ ex, sessionLog, updateSet, addSet, deleteSet, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ex.id });
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [expanded, sessionLog]);

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
      <SwipeToDelete onDelete={onDelete}>
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
        </div>
        <button onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: '4px', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}>
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div style={{
        height: expanded ? `${contentHeight}px` : '0px',
        overflow: 'hidden',
        transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <div ref={contentRef} style={{ padding: '0 16px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 36px', gap: '8px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Set</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Weight</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Reps</div>
            <div></div>
          </div>
          {sets.map((set, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 36px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600' }}>{idx + 1}</div>
              <input value={set.weight} onChange={e => updateSet(ex.id, idx, 'weight', e.target.value)}
                placeholder="0" className="input" style={{ padding: '10px', textAlign: 'center' }} />
              <input value={set.reps} onChange={e => updateSet(ex.id, idx, 'reps', e.target.value)}
                placeholder="0" className="input" style={{ padding: '10px', textAlign: 'center' }} />
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
      </SwipeToDelete>
    </div>
  );
}

function LoggingExerciseCard({ ex, sessionLog, updateSet, addSet, deleteSet, checkedSets, toggleCheck, isExpanded, onToggleExpand }) {
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) setContentHeight(contentRef.current.scrollHeight);
  }, [isExpanded, sessionLog, checkedSets]);

  const sets = sessionLog ? (sessionLog[ex.id] || []) : [];
  const doneCount = checkedSets.filter(Boolean).length;

  return (
    <div style={{ background: 'var(--card)', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div onClick={onToggleExpand} style={{ display: 'flex', alignItems: 'center', padding: '16px', gap: '12px', cursor: 'pointer' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }}>{ex.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{doneCount}/{sets.length} sets done</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', color: 'var(--accent)', flexShrink: 0 }}>
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{ height: isExpanded ? `${contentHeight}px` : '0px', overflow: 'hidden', transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <div ref={contentRef} style={{ padding: '0 16px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 32px 36px', gap: '8px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Set</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Weight</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Reps</div>
            <div /><div />
          </div>
          {sets.map((set, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 32px 36px', gap: '8px', marginBottom: '8px', alignItems: 'center', opacity: checkedSets[idx] ? 0.45 : 1, transition: 'opacity 0.2s' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600' }}>{idx + 1}</div>
              <input value={set.weight} onChange={e => updateSet(ex.id, idx, 'weight', e.target.value)}
                placeholder="0" className="input" style={{ padding: '10px', textAlign: 'center' }} />
              <input value={set.reps} onChange={e => updateSet(ex.id, idx, 'reps', e.target.value)}
                placeholder="0" className="input" style={{ padding: '10px', textAlign: 'center' }} />
              <button onClick={() => deleteSet(ex.id, idx)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button onClick={() => toggleCheck(idx)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {checkedSets[idx]
                  ? <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  : <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid var(--border)' }} />
                }
              </button>
            </div>
          ))}
          <button onClick={() => addSet(ex.id)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
            + Add Set
          </button>
        </div>
      </div>
    </div>
  );
}

function Workouts({ activeWorkout, setActiveWorkout, workoutSeconds, initialView, workoutExpanded = false, onCollapse = () => {}, onWorkoutStart = () => {}, onExpand = () => {} }) {
  const [view, setView] = useState(initialView || (activeWorkout ? 'logging' : 'routines'));
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
  const sessionLogRef = useRef(sessionLog);
  const [checkedSets, setCheckedSets] = useState({});
  const [expandedExId, setExpandedExId] = useState(null);
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState(new Set());
  const [calendarView, setCalendarView] = useState(false);
  const [calendarDayModal, setCalendarDayModal] = useState(null);

  useEffect(() => {
    sessionLogRef.current = sessionLog;
  }, [sessionLog]);

  useEffect(() => {
    loadRoutines();
    loadHistory();
  }, []);

  const loadRoutines = async () => {
    setLoading(true);
    const { data: routineData, error: routineError } = await supabase
      .from('routines').select('*').order('created_at', { ascending: true });
    if (routineError) { console.error(routineError); setLoading(false); return; }

    const { data: exerciseData, error: exerciseError } = await supabase
      .from('exercises').select('*').order('created_at', { ascending: true });
    if (exerciseError) { console.error(exerciseError); setLoading(false); return; }

    const { data: sessionExData } = await supabase
      .from('session_exercises')
      .select('exercise_name, sets, workout_sessions(routine_id, created_at)');

    const lastSessionMap = {};
    if (sessionExData) {
      const sorted = [...sessionExData].sort((a, b) =>
        new Date(b.workout_sessions?.created_at) - new Date(a.workout_sessions?.created_at)
      );
      sorted.forEach(e => {
        const routineId = e.workout_sessions?.routine_id;
        const key = `${routineId}::${e.exercise_name}`;
        if (!lastSessionMap[key]) {
          const sets = Array.isArray(e.sets) ? e.sets : (typeof e.sets === 'string' ? JSON.parse(e.sets) : []);
          const filled = sets.filter(s => s.weight || s.reps);
          if (filled.length > 0) lastSessionMap[key] = { sets: filled };
        }
      });
    }

    const routinesWithExercises = routineData.map(r => ({
      ...r,
      exercises: exerciseData.filter(e => e.routine_id === r.id).map(e => ({ ...e, lastSession: lastSessionMap[`${r.id}::${e.name}`] || null }))
    }));
    setRoutines(routinesWithExercises);
    setLoading(false);
  };

  const loadHistory = async () => {
    const { data: sessions, error } = await supabase
      .from('workout_sessions').select('*, session_exercises(*)').order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    setHistory(sessions.map(s => ({
      id: s.id, date: s.date, routineName: s.routine_name,
      exercises: s.session_exercises.map(e => ({ name: e.exercise_name, sets: Array.isArray(e.sets) ? e.sets : (typeof e.sets === 'string' ? JSON.parse(e.sets) : []) }))
    })));
  };

  const deleteSelectedSessions = async () => {
    const ids = [...selectedSessions];
    await supabase.from('session_exercises').delete().in('session_id', ids);
    await supabase.from('workout_sessions').delete().in('id', ids);
    setHistory(prev => prev.filter(s => !selectedSessions.has(s.id)));
    setSelectedSessions(new Set());
    setEditMode(false);
  };

  const deleteSingleSession = async (id) => {
    await supabase.from('session_exercises').delete().eq('session_id', id);
    await supabase.from('workout_sessions').delete().eq('id', id);
    setHistory(prev => prev.filter(s => s.id !== id));
  };

  const deleteExercise = async (id) => {
    const { error } = await supabase.from('exercises').delete().eq('id', id);
    if (error) { console.error(error); return; }
    const updated = activeRoutine.exercises.filter(e => e.id !== id);
    setActiveRoutine(prev => ({ ...prev, exercises: updated }));
    setRoutines(prev => prev.map(r => r.id === activeRoutine.id ? { ...r, exercises: updated } : r));
  };

  const addRoutine = async () => {
    if (!newRoutineName.trim()) return;
    const { data, error } = await supabase.from('routines')
      .insert([{ name: newRoutineName.trim() }]).select().single();
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
    const { error } = await supabase.from('routines')
      .update({ name: renameValue.trim() }).eq('id', renamingRoutine.id);
    if (error) { console.error(error); return; }
    setRoutines(routines.map(r => r.id === renamingRoutine.id ? { ...r, name: renameValue.trim() } : r));
    setRenamingRoutine(null);
    setRenameValue('');
  };

  const duplicateRoutine = async (routine) => {
    setMenuOpen(null);
    const { data: newRoutine, error: routineError } = await supabase.from('routines')
      .insert([{ name: `${routine.name} (copy)` }]).select().single();
    if (routineError) { console.error(routineError); return; }
    if (routine.exercises.length > 0) {
      const { data: newExercises, error: exError } = await supabase.from('exercises')
        .insert(routine.exercises.map(ex => ({ routine_id: newRoutine.id, name: ex.name }))).select();
      if (exError) { console.error(exError); return; }
      setRoutines([...routines, { ...newRoutine, exercises: newExercises.map(e => ({ ...e, lastSession: null })) }]);
    } else {
      setRoutines([...routines, { ...newRoutine, exercises: [] }]);
    }
  };

  const addExercise = async () => {
    if (!newExerciseName.trim() || !activeRoutine) return;
    const { data, error } = await supabase.from('exercises')
      .insert([{ routine_id: activeRoutine.id, name: newExerciseName.trim() }]).select().single();
    if (error) { console.error(error); return; }
    const newEx = { ...data, lastSession: null };
    setRoutines(routines.map(r => r.id === activeRoutine.id ? { ...r, exercises: [...r.exercises, newEx] } : r));
    setActiveRoutine(prev => ({ ...prev, exercises: [...prev.exercises, newEx] }));
    setNewExerciseName('');
    setShowAddExerciseModal(false);
  };

  const openRoutine = (routine) => {
    const prefilled = {};
    routine.exercises.forEach(ex => {
      prefilled[ex.id] = ex.lastSession?.sets?.length > 0
        ? ex.lastSession.sets
        : [{ sets: '', reps: '', weight: '' }];
    });
    setActiveRoutine(routine);
    setSessionLog(prefilled);
    setView('exercises');
  };

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

  const updateSet = (exId, setIdx, field, value) => {
    setSessionLog(prev => {
      const sets = [...(prev[exId] || [])];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      return { ...prev, [exId]: sets };
    });
  };

  const addSet = (exId) => {
    setSessionLog(prev => ({
      ...prev,
      [exId]: [...(prev[exId] || []), { sets: '', reps: '', weight: '' }]
    }));
  };

  const deleteSet = (exId, setIdx) => {
    setSessionLog(prev => {
      const sets = [...(prev[exId] || [])];
      sets.splice(setIdx, 1);
      return { ...prev, [exId]: sets };
    });
  };

  const toggleCheck = (exId, setIdx) => {
    setCheckedSets(prev => {
      const arr = [...(prev[exId] || [])];
      arr[setIdx] = !arr[setIdx];
      return { ...prev, [exId]: arr };
    });
  };

  const startLogging = () => {
    const initial = {};
    activeRoutine.exercises.forEach(ex => {
      initial[ex.id] = sessionLog[ex.id]?.length > 0
        ? sessionLog[ex.id]
        : [{ sets: '', reps: '', weight: '' }];
    });
    setSessionLog(initial);
    setCheckedSets({});
    setExpandedExId(activeRoutine.exercises[0]?.id || null);
    setView('logging');
    setActiveWorkout({ routineName: activeRoutine.name, startTime: Date.now(), routine: activeRoutine, sessionLog: initial });
    onWorkoutStart();
  };

  const finishWorkout = async () => {
    const currentLog = sessionLogRef.current;
    console.log('sessionLog at finish:', JSON.stringify(currentLog));

    const { data: session, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert([{ routine_id: activeRoutine.id, routine_name: activeRoutine.name, date: new Date().toLocaleDateString(), duration: workoutSeconds }])
      .select().single();
    if (sessionError) { console.error(sessionError); return; }

    const exerciseInserts = activeRoutine.exercises.map(ex => ({
      session_id: session.id,
      exercise_name: ex.name,
      sets: currentLog[ex.id] || []
    }));

    const { error: exError } = await supabase.from('session_exercises').insert(exerciseInserts);
    if (exError) { console.error(exError); return; }

    await loadHistory();
    await loadRoutines();
    setActiveWorkout(null);
    setView('routines');
    setActiveRoutine(null);
  };

  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>Loading...</p>;

  let loggingModal = null;
  if (view === 'logging') {
    const totalSets = activeRoutine.exercises.reduce((sum, ex) => sum + (sessionLog[ex.id] || []).length, 0);
    const totalChecked = Object.values(checkedSets).reduce((sum, arr) => sum + arr.filter(Boolean).length, 0);
    const progress = totalSets > 0 ? (totalChecked / totalSets) * 100 : 0;
    const completedExCount = activeRoutine.exercises.filter(ex => (checkedSets[ex.id] || []).some(Boolean)).length;
    const totalVolume = activeRoutine.exercises.reduce((sum, ex) =>
      sum + (sessionLog[ex.id] || []).reduce((s, set, idx) =>
        s + (checkedSets[ex.id]?.[idx] ? (Number(set.weight) || 0) * (Number(set.reps) || 0) : 0), 0), 0);

    const onHandlePointerDown = (e) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStartY.current = e.clientY;
    };
    const onHandlePointerMove = (e) => {
      if (dragStartY.current === null) return;
      setDragY(Math.max(0, e.clientY - dragStartY.current));
    };
    const onHandlePointerUp = (e) => {
      if (dragStartY.current === null) return;
      const dy = Math.max(0, e.clientY - dragStartY.current);
      dragStartY.current = null;
      setDragY(0);
      if (dy > 80) onCollapse();
    };

    loggingModal = (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 350,
        background: 'var(--bg)',
        transform: workoutExpanded ? `translateY(${dragY}px)` : 'translateY(100%)',
        transition: dragY > 0 ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Drag handle */}
        <div
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          style={{ paddingTop: '14px', paddingBottom: '6px', display: 'flex', justifyContent: 'center', cursor: 'grab', flexShrink: 0, userSelect: 'none', touchAction: 'none' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '0 16px 12px', flexShrink: 0 }}>
          {/* Left column: timer + volume stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Duration</div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                {formatTime(workoutSeconds)}
              </div>
            </div>
            <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Volume</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent)', letterSpacing: '-0.5px' }}>
                {totalVolume.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>LB</span>
              </div>
            </div>
          </div>
          {/* Right column: exercise progress spanning full height */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Exercises</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }}>
              {completedExCount}<span style={{ fontSize: '20px', color: 'var(--text-muted)' }}>/{activeRoutine.exercises.length}</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        </div>

        {/* Exercise cards */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeRoutine.exercises.map(ex => (
            <LoggingExerciseCard
              key={ex.id}
              ex={ex}
              sessionLog={sessionLog}
              updateSet={updateSet}
              addSet={addSet}
              deleteSet={deleteSet}
              checkedSets={checkedSets[ex.id] || []}
              toggleCheck={(idx) => toggleCheck(ex.id, idx)}
              isExpanded={expandedExId === ex.id}
              onToggleExpand={() => setExpandedExId(expandedExId === ex.id ? null : ex.id)}
            />
          ))}
        </div>

        {/* Finish button */}
        <div style={{ padding: '12px 16px 28px', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
          <button onClick={finishWorkout} className="btn-primary" style={{ width: '100%', padding: '18px', fontSize: '17px', fontWeight: '700' }}>
            Finish Workout
          </button>
        </div>
      </div>
    );
  }

  if (view === 'routines' || view === 'logging') return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <button onClick={() => setShowCreateModal(true)} style={{
        display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--accent-light)',
        border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', width: '100%', textAlign: 'left'
      }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: 'white', fontSize: '24px', lineHeight: 1 }}>+</span>
        </div>
        <div>
          <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-primary)' }}>Create New Routine</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>e.g. Push, Pull, Legs</div>
        </div>
      </button>

      {routines.length > 0 && (
        <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '8px 0 0' }}>My Routines</p>
      )}

      {routines.map(r => (
        <SwipeToDelete key={r.id} onDelete={() => deleteRoutine(r.id)} style={{ borderRadius: '16px' }}>
        <div style={{
          background: 'var(--card)', borderRadius: '16px', padding: '18px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ flex: 1, cursor: renamingRoutine?.id === r.id ? 'default' : 'pointer' }}
            onClick={() => {
              if (renamingRoutine?.id === r.id) return;
              if (activeWorkout?.routine?.id === r.id) { setActiveRoutine(activeWorkout.routine); setView('logging'); onExpand(); return; }
              openRoutine(r);
            }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontWeight: '700', fontSize: '18px', color: 'var(--text-primary)' }}>{r.name}</div>
                  {activeWorkout?.routine?.id === r.id && (
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: '20px' }}>Active</span>
                  )}
                </div>
                <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '12px', fontWeight: '600', color: 'var(--accent)', background: 'var(--accent-light)', border: '1px solid var(--blue-200)', borderRadius: '20px', padding: '2px 10px' }}>
                  {r.exercises.length} exercise{r.exercises.length !== 1 ? 's' : ''}
                </span>
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
                  <button key={item.label} onClick={item.action} style={{
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
        </SwipeToDelete>
      ))}

      {menuOpen && <div onClick={() => setMenuOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />}

      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
          onClick={() => setShowCreateModal(false)}>
          <div style={{ background: 'var(--card)', borderRadius: '16px', padding: '24px', width: '300px' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: '600', marginBottom: '16px', fontSize: '16px', color: 'var(--text-primary)' }}>New Routine</p>
            <input value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)}
              placeholder="e.g. Push, Pull, Legs" className="input" style={{ marginBottom: '16px' }}
              onKeyDown={e => e.key === 'Enter' && addRoutine()} autoFocus />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={addRoutine} className="btn-primary" style={{ flex: 1 }}>Create</button>
            </div>
          </div>
        </div>
      )}
      {loggingModal}
    </div>
  );

  if (view === 'exercises') return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <button onClick={() => setView('routines')}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '15px', fontWeight: '600', textAlign: 'left', padding: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
        ← Back
      </button>

      <button onClick={() => setShowAddExerciseModal(true)} style={{
        display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--accent-light)',
        border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', width: '100%', textAlign: 'left', marginBottom: '4px'
      }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
            <SortableExercise key={ex.id} ex={ex} sessionLog={sessionLog} updateSet={updateSet} addSet={addSet} deleteSet={deleteSet} onDelete={() => deleteExercise(ex.id)} />
          ))}
        </SortableContext>
      </DndContext>

      {activeRoutine.exercises.length > 0 && (
        <button onClick={startLogging} style={{
          width: '100%', padding: '18px', background: 'var(--accent)', color: 'white',
          border: 'none', borderRadius: '16px', fontSize: '17px', cursor: 'pointer',
          fontWeight: '700', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="white"><path d="M3 2l10 6-10 6V2z"/></svg>
          Start Workout
        </button>
      )}

      {showAddExerciseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
          onClick={() => setShowAddExerciseModal(false)}>
          <div style={{ background: 'var(--card)', borderRadius: '16px', padding: '24px', width: '300px' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: '600', marginBottom: '16px', fontSize: '16px', color: 'var(--text-primary)' }}>Add Exercise</p>
            <input value={newExerciseName} onChange={e => setNewExerciseName(e.target.value)}
              placeholder="e.g. Bench Press" className="input" style={{ marginBottom: '16px' }}
              onKeyDown={e => e.key === 'Enter' && addExercise()} autoFocus />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAddExerciseModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={addExercise} className="btn-primary" style={{ flex: 1 }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (view === 'history') {
    const workoutDayMap = {};
    history.forEach(session => {
      if (!workoutDayMap[session.date]) workoutDayMap[session.date] = [];
      workoutDayMap[session.date].push(session);
    });
    const todayDate = new Date();
    const months = [];
    for (let i = 0; i <= 5; i++) {
      const d = new Date(todayDate.getFullYear(), todayDate.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DAY_LABELS = ['S','M','T','W','T','F','S'];
    const buildMonthCells = (year, month) => {
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < firstDay; i++) cells.push({ day: null, inMonth: false });
      for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, inMonth: true });
      const rem = cells.length % 7;
      if (rem > 0) for (let d = 1; d <= 7 - rem; d++) cells.push({ day: d, inMonth: false });
      return cells;
    };
    const isAllSelected = history.length > 0 && history.every(s => selectedSessions.has(s.id));

    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {editMode ? (
            <button onClick={() => setSelectedSessions(isAllSelected ? new Set() : new Set(history.map(s => s.id)))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '2px solid var(--accent)', background: isAllSelected ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isAllSelected && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            </button>
          ) : (
            initialView !== 'history' && (
              <button onClick={() => setView('routines')}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0 }}>
                ←
              </button>
            )
          )}
          <h2 style={{ margin: 0, color: 'var(--text-primary)', flex: 1 }}>Workout History</h2>
          {!editMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button onClick={() => setCalendarView(v => !v)}
                style={{ background: calendarView ? 'var(--accent-light)' : 'none', border: calendarView ? '1px solid var(--border)' : '1px solid transparent', borderRadius: '8px', cursor: 'pointer', padding: '6px', color: calendarView ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              {history.length > 0 && (
                <button onClick={() => { setEditMode(true); setCalendarView(false); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '14px', fontWeight: '600', padding: '4px 8px' }}>
                  Edit
                </button>
              )}
            </div>
          )}
          {editMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {selectedSessions.size > 0 && (
                <button onClick={deleteSelectedSessions}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '4px', display: 'flex', alignItems: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
              <button onClick={() => { setEditMode(false); setSelectedSessions(new Set()); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '14px', fontWeight: '600', padding: '4px 8px' }}>
                Done
              </button>
            </div>
          )}
        </div>

        {history.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>No completed workouts yet.</p>
        )}

        {/* Calendar view */}
        {calendarView && !editMode && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {months.map(({ year, month }) => {
              const cells = buildMonthCells(year, month);
              return (
                <div key={`${year}-${month}`} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', textAlign: 'center' }}>
                    {MONTH_NAMES[month].slice(0, 3)} {year}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '3px' }}>
                    {DAY_LABELS.map((d, i) => (
                      <div key={i} style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text-muted)', textAlign: 'center' }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                    {cells.map((cell, i) => {
                      if (!cell.inMonth) return (
                        <div key={i} style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {cell.day && <span style={{ fontSize: '9px', color: 'var(--border)' }}>{cell.day}</span>}
                        </div>
                      );
                      const dateStr = new Date(year, month, cell.day).toLocaleDateString();
                      const daySessions = workoutDayMap[dateStr];
                      const hasWorkout = !!(daySessions && daySessions.length > 0);
                      return (
                        <div key={i}
                          onClick={hasWorkout ? () => setCalendarDayModal({ date: dateStr, sessions: daySessions }) : undefined}
                          style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', background: hasWorkout ? 'var(--green)' : 'transparent', cursor: hasWorkout ? 'pointer' : 'default' }}>
                          <span style={{ fontSize: '9px', fontWeight: hasWorkout ? '700' : '400', color: hasWorkout ? 'white' : 'var(--text-primary)' }}>{cell.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List view */}
        {!calendarView && history.map(session => (
          <SwipeToDelete key={session.id} onDelete={() => deleteSingleSession(session.id)} style={{ borderRadius: '16px' }}>
          <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            {editMode && (
              <button onClick={() => setSelectedSessions(prev => {
                const next = new Set(prev);
                next.has(session.id) ? next.delete(session.id) : next.add(session.id);
                return next;
              })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0, marginTop: '2px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${selectedSessions.has(session.id) ? 'var(--accent)' : 'var(--border)'}`, background: selectedSessions.has(session.id) ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selectedSessions.has(session.id) && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
              </button>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{session.routineName}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{session.date}</span>
              </div>
              {session.exercises.map((ex, i) => {
                const filledSets = ex.sets.filter(s => s.weight || s.reps);
                if (filledSets.length === 0) return null;
                return (
                  <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {ex.name}: {filledSets.map(s => `${s.weight}lb × ${s.reps}`).join(' · ')}
                  </div>
                );
              })}
            </div>
            {editMode && (
              <button onClick={() => deleteSingleSession(session.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '2px', flexShrink: 0, marginTop: '2px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
          </SwipeToDelete>
        ))}

        {/* Calendar day detail modal */}
        {calendarDayModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '20px' }}
            onClick={() => setCalendarDayModal(null)}>
            <div style={{ background: 'var(--card)', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '340px', maxHeight: '70vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }}>{calendarDayModal.date}</span>
                <button onClick={() => setCalendarDayModal(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1, padding: 0 }}>×</button>
              </div>
              {calendarDayModal.sessions.map((session, si) => (
                <div key={si} style={{ marginBottom: si < calendarDayModal.sessions.length - 1 ? '16px' : 0 }}>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>{session.routineName}</div>
                  {session.exercises.map((ex, i) => {
                    const filledSets = ex.sets.filter(s => s.weight || s.reps);
                    if (filledSets.length === 0) return null;
                    return (
                      <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        {ex.name}: {filledSets.map(s => `${s.weight}lb × ${s.reps}`).join(' · ')}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default Workouts;