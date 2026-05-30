import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { EXERCISE_DATABASE, CATEGORIES } from './ExerciseDatabase';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
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


function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function SortableExercise({ ex, exerciseEditMode, isSelected, onToggleSelect, sessionLog, updateSet, addSet, deleteSet }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ex.id });
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [expanded, sessionLog]);

  const sets = sessionLog ? (sessionLog[ex.id] || []) : [];

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1000 : 1, position: 'relative' }} {...attributes}>
      <div style={{
        background: 'var(--card)', borderRadius: '16px',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        border: '1px solid var(--border)', overflow: 'hidden',
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 16px', gap: '12px' }}>
          {exerciseEditMode && (
            <button onClick={onToggleSelect}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, background: isSelected ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isSelected && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }}>{ex.name}</div>
          </div>
          {!exerciseEditMode && (
            <button onClick={() => setExpanded(!expanded)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: '4px', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
                style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}>
                <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          {exerciseEditMode && (
            <div {...listeners} style={{ touchAction: 'none', cursor: 'grab', padding: '8px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="6" cy="5" r="1.5" fill="currentColor"/>
                <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                <circle cx="6" cy="9" r="1.5" fill="currentColor"/>
                <circle cx="12" cy="9" r="1.5" fill="currentColor"/>
                <circle cx="6" cy="13" r="1.5" fill="currentColor"/>
                <circle cx="12" cy="13" r="1.5" fill="currentColor"/>
              </svg>
            </div>
          )}
        </div>

        {!exerciseEditMode && (
          <div style={{
            height: expanded ? `${contentHeight}px` : '0px',
            overflow: 'hidden',
            opacity: expanded ? 1 : 0,
            transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
            willChange: 'height',
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}>
            <div ref={contentRef} style={{ padding: '0 16px 16px', transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}>
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
                    inputMode="decimal"
                    placeholder="0" className="input" style={{ padding: '10px', textAlign: 'center' }} />
                  <input value={set.reps} onChange={e => updateSet(ex.id, idx, 'reps', e.target.value)}
                    inputMode="numeric" pattern="[0-9]*"
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
        )}
      </div>
    </div>
  );
}

function LoggingExerciseCard({ ex, sessionLog, updateSet, addSet, deleteSet, checkedSets, toggleCheck, isExpanded, onToggleExpand, onDeleteExercise, onRenameExercise }) {
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(ex.name);

  useEffect(() => {
    if (contentRef.current) setContentHeight(contentRef.current.scrollHeight);
  }, [isExpanded, sessionLog, checkedSets]);

  const sets = sessionLog ? (sessionLog[ex.id] || []) : [];
  const doneCount = checkedSets.filter(Boolean).length;

  const submitRename = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== ex.name) onRenameExercise(trimmed);
    setRenaming(false);
  };

  return (
    <>
    <div style={{ background: 'var(--card)', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
      <div onClick={renaming ? undefined : onToggleExpand} style={{ display: 'flex', alignItems: 'center', padding: '16px', gap: '12px', cursor: renaming ? 'default' : 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }} onClick={renaming ? (e => e.stopPropagation()) : undefined}>
          {renaming ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} autoFocus
                className="input" style={{ flex: 1, padding: '8px 10px', fontSize: '15px' }}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setRenaming(false); setNameDraft(ex.name); } }} />
              <button onClick={(e) => { e.stopPropagation(); submitRename(); }} className="btn-secondary" style={{ padding: '8px 14px', flexShrink: 0 }}>Save</button>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }}>{ex.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{doneCount}/{sets.length} sets done</div>
            </>
          )}
        </div>
        {!renaming && (onRenameExercise || onDeleteExercise) && (
          <button onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
            setMenuOpen(o => !o);
          }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px', padding: '4px 8px', letterSpacing: '2px', lineHeight: 1, flexShrink: 0 }}>···</button>
        )}
        {!renaming && (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', color: 'var(--accent)', flexShrink: 0 }}>
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div style={{ height: isExpanded ? `${contentHeight}px` : '0px', overflow: 'hidden', opacity: isExpanded ? 1 : 0, transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease', willChange: 'height', transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
        <div ref={contentRef} style={{ padding: '0 16px 16px', transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}>
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
                inputMode="decimal"
                placeholder="0" className="input" style={{ padding: '10px', textAlign: 'center' }} />
              <input value={set.reps} onChange={e => updateSet(ex.id, idx, 'reps', e.target.value)}
                inputMode="numeric" pattern="[0-9]*"
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
    {menuOpen && (
      <>
        <div onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 360 }} />
        <div style={{
          position: 'fixed', top: menuPos.top, right: menuPos.right,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: '12px', overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 361, minWidth: '140px',
        }}>
          <button onClick={(e) => { e.stopPropagation(); setNameDraft(ex.name); setRenaming(true); setMenuOpen(false); }}
            style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>Rename</button>
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDeleteExercise(); }}
            style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: '#ff4444' }}>Delete</button>
        </div>
      </>
    )}
    </>
  );
}


function SortableRoutineWrapper({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 1 }}
      {...attributes}
    >
      <div style={{
        borderRadius: '16px',
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        boxShadow: isDragging ? '0 12px 40px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.12)' : undefined,
        transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease',
      }}>
        {children(listeners, isDragging)}
      </div>
    </div>
  );
}

function PickerCategorySection({ cat, exercises, isExpanded, onToggle, selectedExercises, onToggleExercise, pickerCustomExercises }) {
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);
  useEffect(() => {
    if (contentRef.current) setContentHeight(contentRef.current.scrollHeight);
  }, [isExpanded, exercises.length, selectedExercises]);
  return (
    <div>
      <div onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px', cursor: 'pointer',
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }}>{cat}</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: '20px' }}>{exercises.length}</span>
        </div>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', color: 'var(--text-muted)', flexShrink: 0 }}>
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{
        height: isExpanded ? `${contentHeight}px` : '0px', overflow: 'hidden',
        opacity: isExpanded ? 1 : 0,
        transition: 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease', willChange: 'height',
      }}>
        <div ref={contentRef} style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          padding: '8px 16px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px',
        }}>
          {exercises.map(name => {
            const isSelected = selectedExercises.has(name);
            const isCustom = pickerCustomExercises.some(e => e.category === cat && e.name === name);
            return (
              <div key={name} onClick={() => onToggleExercise(name)}
                style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderRadius: '12px', background: 'var(--bg)', cursor: 'pointer' }}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  background: isSelected ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px',
                }}>
                  {isSelected && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{name}</span>
                    {isCustom && <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: '8px' }}>Custom</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Workouts({ activeWorkout, setActiveWorkout, workoutSeconds, initialView, workoutExpanded = false, onCollapse = () => {}, onWorkoutStart = () => {}, onExpand = () => {}, showToast = () => {}, resetKey = 0 }) {
  const [view, setView] = useState(initialView || (activeWorkout ? 'logging' : 'routines'));
  const [routines, setRoutines] = useState([]);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [activeRoutine, setActiveRoutine] = useState(activeWorkout?.routine || null);
  const [sessionLog, setSessionLog] = useState(activeWorkout?.sessionLog || {});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [renamingRoutine, setRenamingRoutine] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const sessionLogRef = useRef(sessionLog);
  const [checkedSets, setCheckedSets] = useState({});
  const [expandedExId, setExpandedExId] = useState(null);
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState(new Set());
  const [calendarView, setCalendarView] = useState(false);
  const [calendarDayModal, setCalendarDayModal] = useState(null);
  const [showShortWorkoutModal, setShowShortWorkoutModal] = useState(false);
  const [routineEditMode, setRoutineEditMode] = useState(false);
  const [selectedRoutines, setSelectedRoutines] = useState(new Set());
  const [exerciseEditMode, setExerciseEditMode] = useState(false);
  const [selectedExercises, setSelectedExercises] = useState(new Set());
  const [lastPerformed, setLastPerformed] = useState({});
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exercisePickerSearch, setExercisePickerSearch] = useState('');
  const [expandedPickerCategories, setExpandedPickerCategories] = useState(new Set());
  const [selectedPickerExercises, setSelectedPickerExercises] = useState(new Set());
  const [pickerCustomExercises, setPickerCustomExercises] = useState([]);
  const [pickerDragY, setPickerDragY] = useState(0);
  const pickerDragStartY = useRef(null);
  const pickerSearchInputRef = useRef(null);

  const daysAgoText = (dateStr) => {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  useEffect(() => {
    sessionLogRef.current = sessionLog;
  }, [sessionLog]);

  useEffect(() => {
    if (showExercisePicker) {
      const rafId = requestAnimationFrame(() => setPickerOpen(true));
      const focusId = setTimeout(() => pickerSearchInputRef.current?.focus(), 350);
      return () => { cancelAnimationFrame(rafId); clearTimeout(focusId); };
    }
  }, [showExercisePicker]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!resetKey) return;
    if (view !== 'logging') {
      setView('routines');
      setActiveRoutine(null);
      setExerciseEditMode(false);
      setSelectedExercises(new Set());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      .from('exercises').select('*').order('position', { ascending: true });
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

    const lastPerformedMap = {};
    if (sessionExData) {
      sessionExData.forEach(e => {
        const rid = e.workout_sessions?.routine_id;
        const ts = e.workout_sessions?.created_at;
        if (rid && ts && (!lastPerformedMap[rid] || ts > lastPerformedMap[rid])) {
          lastPerformedMap[rid] = ts;
        }
      });
    }
    setLastPerformed(lastPerformedMap);

    const routinesWithExercises = routineData.map(r => ({
      ...r,
      exercises: exerciseData.filter(e => e.routine_id === r.id).map(e => ({ ...e, lastSession: lastSessionMap[`${r.id}::${e.name}`] || null }))
    }));
    try {
      const savedOrder = localStorage.getItem('routineOrder');
      if (savedOrder) {
        const order = JSON.parse(savedOrder);
        setRoutines([...routinesWithExercises].sort((a, b) =>
          (order.indexOf(a.id) + 1 || Infinity) - (order.indexOf(b.id) + 1 || Infinity)
        ));
      } else {
        setRoutines(routinesWithExercises);
      }
    } catch {
      setRoutines(routinesWithExercises);
    }
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

  const deleteSelectedRoutines = async () => {
    const ids = [...selectedRoutines];
    setRoutines(prev => prev.filter(r => !selectedRoutines.has(r.id)));
    setSelectedRoutines(new Set());
    setRoutineEditMode(false);
    await supabase.from('exercises').delete().in('routine_id', ids);
    await supabase.from('routines').delete().in('id', ids);
  };

  const deleteSelectedExercises = async () => {
    const ids = [...selectedExercises];
    const updated = activeRoutine.exercises.filter(e => !selectedExercises.has(e.id));
    setActiveRoutine(prev => ({ ...prev, exercises: updated }));
    setRoutines(prev => prev.map(r => r.id === activeRoutine.id ? { ...r, exercises: updated } : r));
    setSelectedExercises(new Set());
    setExerciseEditMode(false);
    await supabase.from('exercises').delete().in('id', ids);
  };

  const deleteSingleSession = (id) => {
    const item = history.find(s => s.id === id);
    if (!item) return;
    setHistory(prev => prev.filter(s => s.id !== id));
    showToast(
      'Workout deleted',
      () => setHistory(prev => [...prev, item]),
      async () => {
        await supabase.from('session_exercises').delete().eq('session_id', id);
        await supabase.from('workout_sessions').delete().eq('id', id);
      }
    );
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

  const deleteRoutine = (id) => {
    const item = routines.find(r => r.id === id);
    if (!item) return;
    setRoutines(prev => prev.filter(r => r.id !== id));
    showToast(
      `"${item.name}" deleted`,
      () => setRoutines(prev => [...prev, item]),
      async () => { await supabase.from('routines').delete().eq('id', id); }
    );
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
        .insert(routine.exercises.map((ex, idx) => ({ routine_id: newRoutine.id, name: ex.name, position: idx }))).select();
      if (exError) { console.error(exError); return; }
      setRoutines([...routines, { ...newRoutine, exercises: newExercises.map(e => ({ ...e, lastSession: null })) }]);
    } else {
      setRoutines([...routines, { ...newRoutine, exercises: [] }]);
    }
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
    setExerciseEditMode(false);
    setSelectedExercises(new Set());
    setView('exercises');
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 600, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 600, tolerance: 8 } })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = activeRoutine.exercises.findIndex(e => e.id === active.id);
      const newIndex = activeRoutine.exercises.findIndex(e => e.id === over.id);
      const reordered = arrayMove(activeRoutine.exercises, oldIndex, newIndex);
      setActiveRoutine(prev => ({ ...prev, exercises: reordered }));
      setRoutines(routines.map(r => r.id === activeRoutine.id ? { ...r, exercises: reordered } : r));
      const updates = reordered.map((ex, index) =>
        supabase.from('exercises').update({ position: index }).eq('id', ex.id)
      );
      await Promise.all(updates);
    }
  };

  const handleRoutineDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setRoutines(prev => {
      const next = arrayMove(prev, prev.findIndex(r => r.id === active.id), prev.findIndex(r => r.id === over.id));
      localStorage.setItem('routineOrder', JSON.stringify(next.map(r => r.id)));
      return next;
    });
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

  const confirmFinishWorkout = async () => {
    const currentLog = sessionLogRef.current;

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

  const finishWorkout = () => {
    if (workoutSeconds < 300) {
      setShowShortWorkoutModal(true);
      return;
    }
    confirmFinishWorkout();
  };

  const pickerGetExercises = (cat) => {
    const base = EXERCISE_DATABASE[cat] || [];
    const customs = pickerCustomExercises.filter(e => e.category === cat && !base.includes(e.name)).map(e => e.name);
    return [...base, ...customs];
  };

  const pickerSearchResults = exercisePickerSearch.trim()
    ? CATEGORIES.flatMap(cat =>
        pickerGetExercises(cat)
          .filter(name => name.toLowerCase().includes(exercisePickerSearch.toLowerCase()))
          .map(name => ({ name, category: cat }))
      )
    : null;

  const openExercisePicker = async () => {
    setExercisePickerSearch('');
    setSelectedPickerExercises(new Set());
    setExpandedPickerCategories(new Set());
    setPickerDragY(0);
    setShowExercisePicker(true);
    const { data } = await supabase.from('custom_exercises').select('*').order('created_at');
    if (data) setPickerCustomExercises(data);
  };

  const closeExercisePicker = () => {
    setPickerOpen(false);
    setTimeout(() => setShowExercisePicker(false), 350);
  };

  const togglePickerExercise = (name) => {
    setSelectedPickerExercises(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const addPickerExercises = async () => {
    if (selectedPickerExercises.size === 0 || !activeRoutine) return;
    const basePosition = activeRoutine.exercises.length;
    const inserts = [...selectedPickerExercises].map((name, idx) => ({ routine_id: activeRoutine.id, name, position: basePosition + idx }));
    const { data, error } = await supabase.from('exercises').insert(inserts).select();
    if (error) { console.error(error); return; }
    const newExs = data.map(ex => ({ ...ex, lastSession: null }));
    setRoutines(prev => prev.map(r => r.id === activeRoutine.id ? { ...r, exercises: [...r.exercises, ...newExs] } : r));
    setActiveRoutine(prev => ({ ...prev, exercises: [...prev.exercises, ...newExs] }));
    // Seed default empty sets so the new exercises are immediately loggable
    setSessionLog(prev => {
      const next = { ...prev };
      newExs.forEach(ex => { next[ex.id] = [{ sets: '', reps: '', weight: '' }]; });
      return next;
    });
    if (newExs.length > 0) setExpandedExId(newExs[0].id);
    closeExercisePicker();
  };

  const onPickerPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pickerDragStartY.current = e.clientY;
  };
  const onPickerPointerMove = (e) => {
    if (pickerDragStartY.current === null) return;
    setPickerDragY(Math.max(0, e.clientY - pickerDragStartY.current));
  };
  const onPickerPointerUp = (e) => {
    if (pickerDragStartY.current === null) return;
    const dy = Math.max(0, e.clientY - pickerDragStartY.current);
    pickerDragStartY.current = null;
    setPickerDragY(0);
    if (dy > 80) closeExercisePicker();
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
          style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', flexShrink: 0, userSelect: 'none', touchAction: 'none' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
        </div>

        {/* Add Exercise button */}
        <div style={{ padding: '0 16px 10px', flexShrink: 0 }}>
          <button onClick={openExercisePicker} style={{
            display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--accent-light)',
            border: '1px solid var(--border)', borderRadius: '14px', padding: '10px 14px',
            cursor: 'pointer', width: '100%', textAlign: 'left'
          }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: 'white', fontSize: '20px', lineHeight: 1 }}>+</span>
            </div>
            <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--accent)' }}>Add Exercise</span>
          </button>
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
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              onDeleteExercise={async () => {
                setActiveRoutine(prev => ({ ...prev, exercises: prev.exercises.filter(e => e.id !== ex.id) }));
                setRoutines(prev => prev.map(r => r.id === activeRoutine.id ? { ...r, exercises: r.exercises.filter(e => e.id !== ex.id) } : r));
                setSessionLog(prev => { const n = { ...prev }; delete n[ex.id]; return n; });
                setCheckedSets(prev => { const n = { ...prev }; delete n[ex.id]; return n; });
                await supabase.from('exercises').delete().eq('id', ex.id);
              }}
              onRenameExercise={async (newName) => {
                setActiveRoutine(prev => ({ ...prev, exercises: prev.exercises.map(e => e.id === ex.id ? { ...e, name: newName } : e) }));
                setRoutines(prev => prev.map(r => r.id === activeRoutine.id ? { ...r, exercises: r.exercises.map(e => e.id === ex.id ? { ...e, name: newName } : e) } : r));
                await supabase.from('exercises').update({ name: newName }).eq('id', ex.id);
              }}
            />
          ))}
        </div>

        {/* Finish button */}
        <div style={{ padding: '12px 16px 28px', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
          <button onClick={finishWorkout} className="btn-primary" style={{ width: '100%', padding: '18px', fontSize: '17px', fontWeight: '700' }}>
            Finish Workout
          </button>
        </div>

        {showShortWorkoutModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
            onClick={() => setShowShortWorkoutModal(false)}>
            <div style={{ background: 'var(--card)', borderRadius: '16px', padding: '24px', width: '300px' }}
              onClick={e => e.stopPropagation()}>
              <p style={{ fontWeight: '700', marginBottom: '8px', fontSize: '17px', color: 'var(--text-primary)' }}>That was a quick one!</p>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
                This workout is under 5 minutes. Do you want to save it or discard it?
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    setShowShortWorkoutModal(false);
                    setActiveWorkout(null);
                    setView('routines');
                    setActiveRoutine(null);
                  }}
                  className="btn-secondary" style={{ flex: 1 }}>Discard</button>
                <button
                  onClick={() => { setShowShortWorkoutModal(false); confirmFinishWorkout(); }}
                  className="btn-primary" style={{ flex: 1 }}>Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Exercise picker bottom sheet — shared by the exercises view and the active-workout logging modal
  const exercisePickerSheet = showExercisePicker && (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg)',
      transform: pickerOpen ? `translateY(${pickerDragY}px)` : 'translateY(100%)',
      transition: pickerDragY > 0 ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Drag handle — full 60px touch area */}
      <div
        onPointerDown={onPickerPointerDown}
        onPointerMove={onPickerPointerMove}
        onPointerUp={onPickerPointerUp}
        style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', flexShrink: 0, userSelect: 'none', touchAction: 'none' }}
      >
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
      </div>
      {/* Search bar */}
      <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
        <input
          ref={pickerSearchInputRef}
          value={exercisePickerSearch}
          onChange={e => setExercisePickerSearch(e.target.value)}
          placeholder="Search exercises..."
          className="input"
          style={{ width: '100%' }}
        />
      </div>
      {/* Scrollable exercise list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: '100px' }}>
        {pickerSearchResults ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {pickerSearchResults.length === 0
              ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px' }}>No exercises found</p>
              : pickerSearchResults.map(({ name, category }) => {
                  const isSelected = selectedPickerExercises.has(name);
                  const isCustom = pickerCustomExercises.some(e => e.category === category && e.name === name);
                  return (
                    <div key={`${category}::${name}`} onClick={() => togglePickerExercise(name)}
                      style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderRadius: '12px', background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        background: isSelected ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px',
                      }}>
                        {isSelected && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{name}</span>
                          {isCustom && <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: '8px' }}>Custom</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>{category}</div>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {CATEGORIES.map(cat => {
              const exercises = pickerGetExercises(cat);
              const isExpanded = expandedPickerCategories.has(cat);
              return (
                <PickerCategorySection
                  key={cat}
                  cat={cat}
                  exercises={exercises}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedPickerCategories(prev => {
                    const next = new Set(prev);
                    next.has(cat) ? next.delete(cat) : next.add(cat);
                    return next;
                  })}
                  selectedExercises={selectedPickerExercises}
                  onToggleExercise={togglePickerExercise}
                  pickerCustomExercises={pickerCustomExercises}
                />
              );
            })}
          </div>
        )}
      </div>
      {/* Add button */}
      <div style={{ padding: '12px 16px', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={addPickerExercises}
          disabled={selectedPickerExercises.size === 0}
          style={{
            width: '100%', padding: '18px',
            background: selectedPickerExercises.size > 0 ? 'var(--accent)' : 'var(--border)',
            color: selectedPickerExercises.size > 0 ? 'white' : 'var(--text-muted)',
            border: 'none', borderRadius: '16px', fontSize: '17px', cursor: selectedPickerExercises.size > 0 ? 'pointer' : 'default',
            fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            transition: 'background 0.2s ease, color 0.2s ease',
          }}
        >
          {selectedPickerExercises.size === 0 ? 'Select exercises' : `Add ${selectedPickerExercises.size} Exercise${selectedPickerExercises.size > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );

  if (view === 'routines' || view === 'logging') return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 0' }}>
        <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>My Routines</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {routineEditMode && selectedRoutines.size > 0 && (
            <button onClick={deleteSelectedRoutines}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '4px', display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          {routines.length > 0 && (
            <button onClick={() => { setRoutineEditMode(e => !e); setSelectedRoutines(new Set()); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '14px', fontWeight: '600', padding: '4px 8px' }}>
              {routineEditMode ? 'Done' : 'Edit'}
            </button>
          )}
          <button onClick={() => setShowCreateModal(true)} aria-label="New routine"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '24px', fontWeight: '600', lineHeight: 1, padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            +
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRoutineDragEnd}>
        <SortableContext items={routines.map(r => r.id)} strategy={verticalListSortingStrategy}>
      {routines.map(r => (
        <SortableRoutineWrapper key={r.id} id={r.id}>
        {(listeners) => (
        <div style={{
          background: 'var(--card)', borderRadius: '16px', padding: '18px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          {routineEditMode && (
            <button onClick={() => setSelectedRoutines(prev => { const next = new Set(prev); next.has(r.id) ? next.delete(r.id) : next.add(r.id); return next; })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${selectedRoutines.has(r.id) ? 'var(--accent)' : 'var(--border)'}`, background: selectedRoutines.has(r.id) ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedRoutines.has(r.id) && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            </button>
          )}
          <div style={{ flex: 1, cursor: routineEditMode ? 'default' : (renamingRoutine?.id === r.id ? 'default' : 'pointer') }}
            onClick={() => {
              if (routineEditMode) return;
              if (renamingRoutine?.id === r.id) return;
              if (activeWorkout?.routine?.id === r.id) { setActiveRoutine(activeWorkout.routine); setView('logging'); onExpand(); return; }
              openRoutine(r);
            }}>
            {renamingRoutine?.id === r.id ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setRenamingRoutine(null); }}>
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
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {lastPerformed[r.id] ? (
                    <>Last performed <span style={{ color: 'var(--accent)', fontWeight: '600' }}>{daysAgoText(lastPerformed[r.id])}</span></>
                  ) : 'Never performed'}
                </div>
              </>
            )}
          </div>
          {!routineEditMode && (
            <div>
              <button onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                setMenuOpen(menuOpen === r.id ? null : r.id);
              }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', padding: '8px 0 8px 16px', minWidth: '44px', textAlign: 'center', letterSpacing: '2px' }}>
                ···
              </button>
            </div>
          )}
          {routineEditMode && (
            <div {...listeners} style={{ touchAction: 'none', cursor: 'grab', padding: '8px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="6" cy="5" r="1.5" fill="currentColor"/>
                <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                <circle cx="6" cy="9" r="1.5" fill="currentColor"/>
                <circle cx="12" cy="9" r="1.5" fill="currentColor"/>
                <circle cx="6" cy="13" r="1.5" fill="currentColor"/>
                <circle cx="12" cy="13" r="1.5" fill="currentColor"/>
              </svg>
            </div>
          )}
        </div>
        )}
        </SortableRoutineWrapper>
      ))}
        </SortableContext>
      </DndContext>

      {menuOpen && <div onClick={() => setMenuOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 299 }} />}

      {menuOpen && routines.find(r => r.id === menuOpen) && (() => {
        const r = routines.find(r => r.id === menuOpen);
        return (
          <div style={{
            position: 'fixed', top: menuPosition.top, right: menuPosition.right,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 300, minWidth: '140px'
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
        );
      })()}

      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '20vh', zIndex: 500 }}
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
      {exercisePickerSheet}
    </div>
  );

  if (view === 'exercises') return (
    <>
    <div style={{ padding: '16px', paddingBottom: '80px', display: 'flex', flexDirection: 'column', gap: '10px', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <button onClick={() => { setView('routines'); setExerciseEditMode(false); setSelectedExercises(new Set()); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '15px', fontWeight: '600', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            ← Back
          </button>
          {activeRoutine?.name && (
            <>
              <span style={{ color: 'var(--border)', fontSize: '17px', flexShrink: 0 }}>|</span>
              <span style={{ fontWeight: '700', fontSize: '17px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeRoutine.name}</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {exerciseEditMode && selectedExercises.size > 0 && (
            <button onClick={deleteSelectedExercises}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '4px', display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          {activeRoutine?.exercises?.length > 0 && (
            <button onClick={() => { setExerciseEditMode(e => !e); setSelectedExercises(new Set()); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '14px', fontWeight: '600', padding: '4px 8px' }}>
              {exerciseEditMode ? 'Done' : 'Edit'}
            </button>
          )}
          <button onClick={openExercisePicker} aria-label="Add exercise"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '24px', fontWeight: '600', lineHeight: 1, padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            +
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeRoutine.exercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
          {activeRoutine.exercises.map(ex => (
            <SortableExercise key={ex.id} ex={ex} exerciseEditMode={exerciseEditMode} isSelected={selectedExercises.has(ex.id)} onToggleSelect={() => setSelectedExercises(prev => { const next = new Set(prev); next.has(ex.id) ? next.delete(ex.id) : next.add(ex.id); return next; })} sessionLog={sessionLog} updateSet={updateSet} addSet={addSet} deleteSet={deleteSet} />
          ))}
        </SortableContext>
      </DndContext>

    </div>
    {activeRoutine.exercises.length > 0 && (
      <button onClick={startLogging} style={{
        position: 'fixed', bottom: '82px', left: '50%', transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)', maxWidth: '448px', zIndex: 150,
        padding: '18px', background: 'var(--accent)', color: 'white',
        border: 'none', borderRadius: '16px', fontSize: '17px', cursor: 'pointer',
        fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="white"><path d="M3 2l10 6-10 6V2z"/></svg>
        Start Workout
      </button>
    )}
    {exercisePickerSheet}
    </>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {months.map(({ year, month }) => {
              const cells = buildMonthCells(year, month);
              return (
                <div key={`${year}-${month}`}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
                    {MONTH_NAMES[month]} {year}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
                    {DAY_LABELS.map((d, i) => (
                      <div key={i} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textAlign: 'center', paddingBottom: '4px' }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                    {cells.map((cell, i) => {
                      if (!cell.inMonth) return (
                        <div key={i} style={{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {cell.day && <span style={{ fontSize: '13px', color: 'var(--border)' }}>{cell.day}</span>}
                        </div>
                      );
                      const dateStr = new Date(year, month, cell.day).toLocaleDateString();
                      const daySessions = workoutDayMap[dateStr];
                      const hasWorkout = !!(daySessions && daySessions.length > 0);
                      return (
                        <div key={i}
                          onClick={hasWorkout ? () => setCalendarDayModal({ date: dateStr, sessions: daySessions }) : undefined}
                          style={{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: hasWorkout ? '#22C55E' : 'transparent', cursor: hasWorkout ? 'pointer' : 'default' }}>
                          <span style={{ fontSize: '14px', fontWeight: hasWorkout ? '700' : '400', color: hasWorkout ? 'white' : 'var(--text-primary)' }}>{cell.day}</span>
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
          <div key={session.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
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