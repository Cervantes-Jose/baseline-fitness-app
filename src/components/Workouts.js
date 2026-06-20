import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { EXERCISE_DATABASE, CATEGORIES } from './ExerciseDatabase';
import { queueWorkoutSave, getQueuedHistoryItems, isNetworkError } from './offlineQueue';
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
import useSwipeToDismiss from './useSwipeToDismiss';
import MonthOverviewCalendar from './MonthOverviewCalendar';
import { ymd, parseYmd } from './habitMath';

// Map each exercise name to the category it came from. Built from EXERCISE_DATABASE
// once; if a name appears in multiple categories it's attributed to the first
// (canonical CATEGORIES order). Categories aren't stored on the `exercises` table,
// so we resolve them by name here. Custom exercises (not in the database) resolve to
// undefined and are simply omitted from a routine's category list.
const NAME_TO_CATEGORY = (() => {
  const map = {};
  for (const cat of CATEGORIES) {
    for (const name of EXERCISE_DATABASE[cat]) {
      if (!(name in map)) map[name] = cat;
    }
  }
  return map;
})();

// The unique categories represented by a routine's exercises, in canonical order.
const routineCategories = (routine) => {
  const present = new Set();
  for (const ex of routine.exercises || []) {
    const cat = ex.category || NAME_TO_CATEGORY[ex.name];
    if (cat) present.add(cat);
  }
  return CATEGORIES.filter(c => present.has(c));
};

function formatHMS(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Compact average workout length for the routine card, e.g. "~28 min avg" (or "~1 hr 5 min avg").
function avgTimeText(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '~<1 min avg';
  if (mins < 60) return `~${mins} min avg`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `~${h} hr avg` : `~${h} hr ${m} min avg`;
}

// Rest timers are stored as seconds; displayed/edited as m:ss.
function formatRest(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Accepts "1:30" (m:ss) or a bare number of seconds. Returns null if unparseable.
function parseRest(str) {
  const t = (str || '').trim();
  if (!t) return null;
  if (t.includes(':')) {
    const [m, s] = t.split(':');
    const mins = parseInt(m, 10) || 0;
    const secs = parseInt(s, 10) || 0;
    return Math.max(0, mins * 60 + secs);
  }
  const n = parseInt(t, 10);
  return isNaN(n) ? null : Math.max(0, n);
}

const REST_DEFAULT_SECONDS = 90; // new rest timers default to 1:30

// Sets to prefill for an exercise when opening/starting a routine: the saved
// plan (`planned_sets`, edited in the config view or carried over from the last
// completed session) if present, else the last session's sets, else one empty
// set. `planned_sets` is jsonb on the exercises table.
function prefillSetsFor(ex) {
  const ps = ex.planned_sets;
  let planned = Array.isArray(ps) ? ps : null;
  if (!planned && typeof ps === 'string') { try { planned = JSON.parse(ps); } catch { planned = null; } }
  if (planned && planned.length > 0) return planned;
  if (ex.lastSession?.sets?.length > 0) return ex.lastSession.sets;
  return [{ sets: '', reps: '', weight: '' }];
}
const REST_STEP_SECONDS = 30;    // +/- buttons adjust by 30s

function SortableExercise({ ex, exerciseEditMode, isSelected, onToggleSelect, sessionLog, updateSet, addSet, deleteSet, isCustom = false, restTimers = [], addRest, changeRest, deleteRest }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ex.id });
  const [expanded, setExpanded] = useState(false);
  // Which rest slot (set index) is being manually edited, and its draft text.
  const [editingRest, setEditingRest] = useState(null);
  const [restDraft, setRestDraft] = useState('');

  const sets = sessionLog ? (sessionLog[ex.id] || []) : [];
  const prevSets = ex.lastSession?.sets || [];

  const stepBtnStyle = {
    width: '28px', height: '28px', borderRadius: '8px', border: '1px solid var(--border)',
    background: 'var(--card)', color: 'var(--accent)', cursor: 'pointer', fontSize: '18px',
    fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0,
  };

  const commitRest = () => {
    if (editingRest === null) return;
    const parsed = parseRest(restDraft);
    if (parsed !== null) changeRest(ex.id, editingRest, parsed);
    setEditingRest(null);
    setRestDraft('');
  };

  // Rest slot after set `idx`: a divider "Add Rest" button when empty, an editable tile when set.
  const renderRestSlot = (idx) => {
    const value = restTimers[idx];
    if (value === null || value === undefined) {
      return (
        <div key={`rest-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <button onClick={() => addRest(ex.id, idx)}
            style={{ background: 'transparent', border: '1px solid var(--accent)', borderRadius: '8px', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', padding: '5px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            + Add Rest
          </button>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>
      );
    }
    return (
      <div key={`rest-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
        {/* Left divider */}
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        {/* Timer controls (unwrapped) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <button onClick={() => changeRest(ex.id, idx, value - REST_STEP_SECONDS)} disabled={value <= 0} aria-label="Decrease rest"
            style={{ ...stepBtnStyle, opacity: value <= 0 ? 0.4 : 1, cursor: value <= 0 ? 'default' : 'pointer' }}>−</button>
          {editingRest === idx ? (
            <input value={restDraft} autoFocus onChange={e => setRestDraft(e.target.value)} onBlur={commitRest}
              onKeyDown={e => { if (e.key === 'Enter') commitRest(); if (e.key === 'Escape') { setEditingRest(null); setRestDraft(''); } }}
              placeholder="m:ss" inputMode="numeric"
              className="input" style={{ width: '64px', padding: '6px', textAlign: 'center', fontSize: '15px' }} />
          ) : (
            <button onClick={() => { setEditingRest(idx); setRestDraft(formatRest(value)); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', minWidth: '54px', textAlign: 'center', padding: 0 }}>
              {formatRest(value)}
            </button>
          )}
          <button onClick={() => changeRest(ex.id, idx, value + REST_STEP_SECONDS)} aria-label="Increase rest" style={stepBtnStyle}>+</button>
        </div>
        {/* Right side: divider + Delete. flex:1 balances the left divider so the timer tile stays centered */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <button onClick={() => deleteRest(ex.id, idx)}
            style={{ background: 'transparent', border: '1px solid #EF4444', borderRadius: '8px', cursor: 'pointer', color: '#EF4444', fontSize: '12px', fontWeight: '600', padding: '5px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1000 : 1, position: 'relative' }} {...attributes}>
      <div style={{
        background: 'var(--card)', borderRadius: '12px',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : '0 2px 6px rgba(0,0,0,0.05)',
        border: '1px solid var(--border)', overflow: 'hidden',
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: '12px' }}>
          {exerciseEditMode && (
            <button onClick={onToggleSelect}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, background: isSelected ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isSelected && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }}>{ex.name}</span>
              {isCustom && <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: '8px' }}>Custom</span>}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '3px' }}>
              {sets.length} {sets.length === 1 ? 'set' : 'sets'}
            </div>
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
            maxHeight: expanded ? '2000px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}>
            <div style={{ padding: '0 16px 16px', transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '32px 54px 1fr 1fr 36px', gap: '8px', marginBottom: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Set</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Prev</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Weight</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Reps</div>
                <div></div>
              </div>
              {sets.map((set, idx) => (
                <React.Fragment key={idx}>
                  <div style={{ display: 'grid', gridTemplateColumns: '32px 54px 1fr 1fr 36px', gap: '8px', alignItems: 'center' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600' }}>{idx + 1}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{prevSets[idx] && prevSets[idx].weight && prevSets[idx].reps ? `${prevSets[idx].weight}×${prevSets[idx].reps}` : '—'}</div>
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
                  {renderRestSlot(idx)}
                </React.Fragment>
              ))}
              <button onClick={() => addSet(ex.id)}
                style={{ width: '100%', background: 'transparent', border: '1px solid var(--accent)', borderRadius: '12px', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                + Add Set
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// One rest slot inside the active-workout logging card. Sits between two sets.
// - idle:     ---- Rest 1:30 ----   (a configured-but-not-started rest)
// - running:  expanded tile with "Rest Timer", a live countdown, and Skip Rest
// - finished: ---- Rest Completed ----  /  ---- Rest Skipped ----
function RestRow({ duration, running, remaining, status, onSkip, name = 'Rest' }) {
  if (running) {
    // Fraction of the rest already elapsed — the bar fills as the next set nears.
    const elapsed = duration > 0 ? Math.min(1, Math.max(0, (duration - remaining) / duration)) : 0;
    return (
      <div style={{
        margin: '8px 0', padding: '14px 16px',
        background: 'transparent', border: '1px solid var(--accent)', borderRadius: '12px',
        animation: 'restTileIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rest Timer</span>
            <span style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>{formatRest(remaining)}</span>
          </div>
          <button onClick={onSkip}
            style={{ background: 'transparent', border: '1px solid var(--accent)', borderRadius: '10px', color: 'var(--accent)', fontSize: '14px', fontWeight: '700', padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Skip Rest
          </button>
        </div>
        <div style={{ marginTop: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next Set In</span>
          <div style={{ marginTop: '6px', width: '55%', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${elapsed * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.4s linear' }} />
          </div>
        </div>
      </div>
    );
  }
  const label = status === 'completed' ? `${name} Completed`
    : status === 'skipped' ? `${name} Skipped`
    : `${name} ${formatRest(duration)}`;
  const color = status ? 'var(--text-muted)' : 'var(--accent)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      <span style={{ fontSize: '12px', fontWeight: '600', color, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  );
}

function LoggingExerciseCard({ ex, sessionLog, updateSet, addSet, deleteSet, checkedSets, toggleCheck, isCustom = false, isExpanded, onToggleExpand, onDeleteExercise, onRenameExercise, restTimers = [], activeRest, restRemaining, restStatus = {}, onSkipRest = () => {} }) {
  const [editMode, setEditMode] = useState(false);
  const [nameDraft, setNameDraft] = useState(ex.name);
  // Keyboard "Next" flow on mobile: weight → reps → check the set → next set's weight.
  // Holds each input's DOM node keyed `${idx}-weight` / `${idx}-reps`.
  const inputRefs = useRef({});

  // Animate expand/collapse to the body's *measured* height rather than a fixed
  // max-height cap. The cap (e.g. 2000px) made the timing asymmetric — short
  // cards collapsed with a long delay then a fast snap. `bodyRef` is on the
  // content (always laid out at full height even while clipped), so this stays
  // correct as sets/rest rows are added or removed.
  const bodyRef = useRef(null);
  const [bodyH, setBodyH] = useState(0);
  // Measure once and then on any content size change (sets/rest rows added or
  // removed), so the expand/collapse always animates to the exact height.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setBodyH(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Collapsing the card (e.g. opening another exercise) also exits edit mode.
  useEffect(() => { if (!isExpanded) setEditMode(false); }, [isExpanded]);

  const sets = sessionLog ? (sessionLog[ex.id] || []) : [];
  const prevSets = ex.lastSession?.sets || [];
  const doneCount = checkedSets.filter(Boolean).length;
  const SET_GRID = '28px 54px 1fr 1fr 36px';
  // While a rest is running in THIS exercise, gently shrink the sets and other
  // logging UI so the rest tile stands out. Transforms don't affect layout, so
  // the card's measured height is unchanged.
  const restActive = !!activeRest && activeRest.exId === ex.id;
  const shrink = { transform: restActive ? 'scale(0.95)' : 'scale(1)', transformOrigin: 'center', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' };

  // Entering edit mode makes the name editable and reveals the delete-exercise
  // and per-set trash icons; force the card open so the sets are visible.
  const enterEdit = () => {
    setNameDraft(ex.name);
    setEditMode(true);
    if (!isExpanded) onToggleExpand();
  };
  // Leaving edit mode commits any rename.
  const exitEdit = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== ex.name) onRenameExercise(trimmed);
    setEditMode(false);
  };

  return (
    <div style={{ background: 'var(--card)', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
      <div onClick={editMode ? undefined : onToggleExpand} style={{ display: 'flex', alignItems: 'center', padding: '16px', gap: '12px', cursor: editMode ? 'default' : 'pointer' }}>
        {editMode && (
          <button onClick={(e) => { e.stopPropagation(); onDeleteExercise(); }} aria-label="Delete exercise"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }} onClick={editMode ? (e => e.stopPropagation()) : undefined}>
          {editMode ? (
            <input value={nameDraft} onChange={e => setNameDraft(e.target.value)}
              className="input" style={{ width: '100%', padding: '8px 10px', fontSize: '15px' }}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => { if (e.key === 'Enter') exitEdit(); }} />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }}>{ex.name}</span>
                {isCustom && <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: '8px' }}>Custom</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{doneCount}/{sets.length} sets done</div>
            </>
          )}
        </div>
        {(onRenameExercise || onDeleteExercise) && (
          <button onClick={(e) => { e.stopPropagation(); editMode ? exitEdit() : enterEdit(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '14px', fontWeight: '600', padding: '4px 8px', flexShrink: 0 }}>
            {editMode ? 'Done' : 'Edit'}
          </button>
        )}
        {!editMode && (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', color: 'var(--accent)', flexShrink: 0 }}>
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div style={{ maxHeight: isExpanded ? bodyH : 0, overflow: 'hidden', transition: isExpanded ? 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'max-height 0.4s cubic-bezier(0.33, 0, 0.2, 1)', transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
        <div ref={bodyRef} style={{ padding: '0 16px 16px', transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: SET_GRID, gap: '8px', marginBottom: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px', ...shrink }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Set</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Prev</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Weight</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Reps</div>
            <div />
          </div>
          {sets.map((set, idx) => (
            <React.Fragment key={idx}>
            <div style={{ display: 'grid', gridTemplateColumns: SET_GRID, gap: '8px', marginBottom: '8px', alignItems: 'center', opacity: (!editMode && checkedSets[idx]) ? 0.45 : 1, transform: restActive ? 'scale(0.95)' : 'scale(1)', transformOrigin: 'center', transition: 'opacity 0.2s, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600' }}>{idx + 1}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{prevSets[idx] && prevSets[idx].weight && prevSets[idx].reps ? `${prevSets[idx].weight}×${prevSets[idx].reps}` : '—'}</div>
              <input value={set.weight} onChange={e => updateSet(ex.id, idx, 'weight', e.target.value)}
                ref={el => { inputRefs.current[`${idx}-weight`] = el; }}
                inputMode="decimal" enterKeyHint="next"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); inputRefs.current[`${idx}-reps`]?.focus(); } }}
                placeholder="0" className="input" style={{ padding: '10px', textAlign: 'center' }} />
              <input value={set.reps} onChange={e => updateSet(ex.id, idx, 'reps', e.target.value)}
                ref={el => { inputRefs.current[`${idx}-reps`] = el; }}
                inputMode="numeric" pattern="[0-9]*" enterKeyHint="next"
                onKeyDown={e => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  if (!checkedSets[idx]) toggleCheck(idx);          // "Next" on reps completes the set
                  const nextWeight = inputRefs.current[`${idx + 1}-weight`];
                  if (nextWeight) nextWeight.focus(); else e.currentTarget.blur();
                }}
                placeholder="0" className="input" style={{ padding: '10px', textAlign: 'center' }} />
              {editMode ? (
                <button onClick={() => deleteSet(ex.id, idx)} aria-label="Delete set"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ) : (
                <button onClick={() => toggleCheck(idx)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {checkedSets[idx]
                    ? <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    : <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid var(--border)' }} />
                  }
                </button>
              )}
            </div>
            {!editMode && typeof restTimers[idx] === 'number' && (
              <RestRow
                duration={restTimers[idx]}
                running={!!activeRest && activeRest.exId === ex.id && activeRest.slotIdx === idx}
                remaining={restRemaining}
                status={restStatus[idx]}
                onSkip={() => onSkipRest(idx)}
              />
            )}
            </React.Fragment>
          ))}
          <button onClick={() => addSet(ex.id)}
            style={{ width: '100%', background: 'transparent', border: '1px solid var(--accent)', borderRadius: '12px', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', ...shrink }}>
            Add Set
          </button>
        </div>
      </div>
    </div>
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
        borderRadius: '12px',
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
  // Upper bound for the expanded height, derived from the row count (no per-frame DOM
  // measurement). Generous per-row estimate so the tallest categories (40+ exercises)
  // never clip, while staying tight enough that the collapse animation reads well.
  const expandedMax = exercises.length * 60 + 60;
  return (
    <div>
      <div onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px', cursor: 'pointer',
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }}>{cat}</span>
          <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)', marginTop: '3px' }}>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
        </div>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', color: 'var(--text-muted)', flexShrink: 0 }}>
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{
        maxHeight: isExpanded ? `${expandedMax}px` : '0px', overflow: 'hidden',
        transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          padding: '8px 16px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px',
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

function Workouts({ activeWorkout, setActiveWorkout, workoutSeconds, initialView, workoutExpanded = false, onCollapse = () => {}, onWorkoutStart = () => {}, onExpand = () => {}, showToast = () => {}, resetKey = 0, metricSystem = 'imperial', workoutPaused = false, onTogglePause = () => {}, activeRest = null, restRemaining = 0, completedRest = null, onStartRest = () => {}, onSkipRest = () => {}, autoCreateSignal = 0, onAutoCreate = () => {} }) {
  // When a workout is in progress, the live logging state is mirrored to
  // localStorage ('activeWorkoutLog') so switching to a completely different app
  // tab — which unmounts this component — doesn't lose entered weights/reps,
  // checked sets, rest progress, or rest dividers. Read it once on mount.
  const savedLogRef = useRef(undefined);
  if (savedLogRef.current === undefined) {
    try { savedLogRef.current = activeWorkout ? JSON.parse(localStorage.getItem('activeWorkoutLog')) : null; }
    catch { savedLogRef.current = null; }
  }
  const savedLog = savedLogRef.current;

  const [view, setView] = useState(initialView || (activeWorkout ? 'logging' : 'routines'));
  const [routines, setRoutines] = useState([]);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [activeRoutine, setActiveRoutine] = useState(savedLog?.routine || activeWorkout?.routine || null);
  const [sessionLog, setSessionLog] = useState(savedLog?.sessionLog || activeWorkout?.sessionLog || {});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Open the create-routine modal when the parent FAB requests it (signal = a bumped nonce).
  // The ref guards against re-firing for the same nonce (e.g. StrictMode double-invoke).
  const autoCreateHandled = useRef(0);
  useEffect(() => {
    if (autoCreateSignal && autoCreateSignal !== autoCreateHandled.current) {
      autoCreateHandled.current = autoCreateSignal;
      setShowCreateModal(true);
      onAutoCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreateSignal]);
  const sessionLogRef = useRef(sessionLog);
  // Guards finishWorkout against double-submit (rapid taps / doubled events) which would
  // otherwise insert the same session twice. Synchronous ref so it blocks within one tick.
  const finishingRef = useRef(false);
  // Rest timers keyed by exercise id: array where index i = rest (seconds) after set i, or null/undefined for no timer.
  const [restTimers, setRestTimers] = useState(savedLog?.restTimers || {});
  const restTimersRef = useRef(restTimers);
  // Debounced persistence of edited planned sets (config view). `pendingPlanned`
  // holds the latest sets array per exercise id awaiting a write; one shared
  // timer flushes them so rapid typing collapses into a single save.
  const pendingPlanned = useRef({});
  const plannedTimer = useRef(null);
  // Finished rest states during the active workout: { [exId]: { [slotIdx]: 'completed' | 'skipped' } }.
  // The *running* rest itself is owned by App (activeRest prop); this only tracks the after-state.
  const [restStatus, setRestStatus] = useState(savedLog?.restStatus || {});
  const [checkedSets, setCheckedSets] = useState(savedLog?.checkedSets || {});
  const [expandedExId, setExpandedExId] = useState(savedLog?.expandedExId ?? null);
  // Swipe-to-dismiss for the active-workout logging modal (collapses to the mini bar).
  const logging = useSwipeToDismiss({ onDismiss: onCollapse });
  const [editMode, setEditMode] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState(new Set());
  const [calendarView, setCalendarView] = useState(false);
  const [calendarDayModal, setCalendarDayModal] = useState(null);
  const [showShortWorkoutModal, setShowShortWorkoutModal] = useState(false);
  const [routineEditMode, setRoutineEditMode] = useState(false);
  // Routines ticked in edit mode (the tile stays the same; a bottom action bar acts on these).
  const [selectedRoutines, setSelectedRoutines] = useState(new Set());
  // { id, value } while the rename modal is open, else null.
  const [renameModal, setRenameModal] = useState(null);
  const [exerciseEditMode, setExerciseEditMode] = useState(false);
  const [selectedExercises, setSelectedExercises] = useState(new Set());
  const [lastPerformed, setLastPerformed] = useState({});
  // Average completed-workout duration (seconds) per routine id — more sessions = more accurate.
  const [avgDuration, setAvgDuration] = useState({});
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exercisePickerSearch, setExercisePickerSearch] = useState('');
  const [expandedPickerCategories, setExpandedPickerCategories] = useState(new Set());
  const [selectedPickerExercises, setSelectedPickerExercises] = useState(new Set());
  const [pickerCustomExercises, setPickerCustomExercises] = useState([]);
  // Swipe-to-dismiss for the exercise picker sheet (arrow defers to closeExercisePicker, defined below).
  const picker = useSwipeToDismiss({ onDismiss: () => closeExercisePicker() });
  const pickerSearchInputRef = useRef(null);

  const daysAgoText = (dateStr) => {
    // Compare calendar days in local time, not raw 24h windows: a workout logged
    // last night is "Yesterday" even if it's been under 24h. Both dates are
    // normalized to local midnight so server/device clock skew can't push it to -1.
    const then = new Date(dateStr);
    const now = new Date();
    const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
    const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((startNow - startThen) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  // Names of the user's custom exercises — used to badge them in the routine
  // config view and the active workout (matches the picker / Exercises tab badge).
  const customExerciseNames = new Set(pickerCustomExercises.map(e => e.name));

  useEffect(() => {
    sessionLogRef.current = sessionLog;
  }, [sessionLog]);

  useEffect(() => {
    restTimersRef.current = restTimers;
  }, [restTimers]);

  // Mirror the live logging state to localStorage while a workout is active.
  // App removes the key when the workout ends (finish/discard).
  useEffect(() => {
    if (!activeWorkout) return;
    try {
      localStorage.setItem('activeWorkoutLog', JSON.stringify({
        routine: activeRoutine, sessionLog, checkedSets, restStatus, restTimers, expandedExId,
      }));
    } catch {}
  }, [activeWorkout, activeRoutine, sessionLog, checkedSets, restStatus, restTimers, expandedExId]);

  const markRestStatus = (exId, slotIdx, status) => {
    setRestStatus(prev => ({ ...prev, [exId]: { ...(prev[exId] || {}), [slotIdx]: status } }));
  };
  const clearRestStatus = (exId, slotIdx) => {
    setRestStatus(prev => {
      if (prev[exId]?.[slotIdx] === undefined) return prev;
      const inner = { ...prev[exId] };
      delete inner[slotIdx];
      return { ...prev, [exId]: inner };
    });
  };

  // When App reports a rest finished naturally, flip it to "...Completed".
  useEffect(() => {
    if (!completedRest) return;
    markRestStatus(completedRest.exId, completedRest.slotIdx, 'completed');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedRest?.token]);

  // Tapping the Skip Rest button: stop the running rest and label the slot "Rest Skipped".
  const handleSkipRest = (exId, slotIdx) => {
    markRestStatus(exId, slotIdx, 'skipped');
    onSkipRest();
  };

  // Persist an exercise's full rest-timer array to its row. The exercises table
  // GRANT/RLS already cover all columns, so this is a plain column update.
  const persistRest = async (exId, arr) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    await supabase.from('exercises').update({ rest_timers: arr }).eq('id', exId).eq('user_id', uid);
  };

  // Write a new rest-timer array into both state and ref, then persist.
  const commitRestTimers = (exId, arr) => {
    const next = { ...restTimersRef.current, [exId]: arr };
    restTimersRef.current = next;
    setRestTimers(next);
    // Keep the in-memory routine copies in sync (like delete/reorder/add do),
    // so going Back and re-opening the routine — which rebuilds rest timers
    // from routine.exercises[].rest_timers in openRoutine — reflects the edit
    // instead of the stale pre-edit value. The DB write already happened below.
    const applyRest = (ex) => (ex.id === exId ? { ...ex, rest_timers: arr } : ex);
    setActiveRoutine(prev => (prev ? { ...prev, exercises: prev.exercises.map(applyRest) } : prev));
    setRoutines(prev => prev.map(r => ({ ...r, exercises: (r.exercises || []).map(applyRest) })));
    persistRest(exId, arr);
  };

  const addRest = (exId, slotIdx) => {
    const arr = [...(restTimersRef.current[exId] || [])];
    arr[slotIdx] = REST_DEFAULT_SECONDS;
    commitRestTimers(exId, arr);
  };

  const changeRest = (exId, slotIdx, seconds) => {
    const arr = [...(restTimersRef.current[exId] || [])];
    arr[slotIdx] = Math.max(0, seconds);
    commitRestTimers(exId, arr);
  };

  const deleteRest = (exId, slotIdx) => {
    const arr = [...(restTimersRef.current[exId] || [])];
    arr[slotIdx] = null;
    commitRestTimers(exId, arr);
  };

  // Write an exercise's planned (target) sets to its row. Plain column update —
  // the exercises table GRANT/RLS already cover all columns.
  const persistPlannedSets = async (exId, sets) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    await supabase.from('exercises').update({ planned_sets: sets }).eq('id', exId).eq('user_id', uid);
  };

  // Flush any debounced planned-sets writes immediately (also called on unmount
  // so leaving the workouts section never drops a pending edit).
  const flushPlannedSets = () => {
    clearTimeout(plannedTimer.current);
    const entries = Object.entries(pendingPlanned.current);
    pendingPlanned.current = {};
    entries.forEach(([exId, sets]) => persistPlannedSets(exId, sets));
  };

  // Called when sets are edited in the config view: sync the in-memory routine
  // copies right away (so going Back and re-opening reflects the edit), then
  // debounce the DB write. Mirrors the rest-timer commit pattern.
  const savePlannedSets = (exId, sets) => {
    const applyPlanned = (ex) => (ex.id === exId ? { ...ex, planned_sets: sets } : ex);
    setActiveRoutine(prev => (prev ? { ...prev, exercises: prev.exercises.map(applyPlanned) } : prev));
    setRoutines(prev => prev.map(r => ({ ...r, exercises: (r.exercises || []).map(applyPlanned) })));
    pendingPlanned.current[exId] = sets;
    clearTimeout(plannedTimer.current);
    plannedTimer.current = setTimeout(flushPlannedSets, 500);
  };

  // Flush any pending planned-sets write when the component unmounts (e.g. the
  // user navigates out of the workouts section before the debounce fires).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => flushPlannedSets(), []);

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
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data: routineData, error: routineError } = await supabase
      .from('routines').select('*').eq('user_id', uid).order('created_at', { ascending: true });
    if (routineError) { setLoading(false); return; }

    const { data: exerciseData, error: exerciseError } = await supabase
      .from('exercises').select('*').eq('user_id', uid).order('position', { ascending: true });
    if (exerciseError) { setLoading(false); return; }

    const { data: sessionExData } = await supabase
      .from('session_exercises')
      .select('exercise_name, sets, workout_sessions(routine_id, created_at)')
      .eq('user_id', uid);

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

    // Average workout length per routine, from one row per session (not the per-exercise join).
    const { data: sessionData } = await supabase
      .from('workout_sessions').select('routine_id, duration').eq('user_id', uid);
    const durAgg = {};   // routine_id -> { total, count }
    (sessionData || []).forEach(s => {
      if (s.routine_id == null || s.duration == null) return;
      const a = durAgg[s.routine_id] || { total: 0, count: 0 };
      a.total += Number(s.duration) || 0;
      a.count += 1;
      durAgg[s.routine_id] = a;
    });
    const avgMap = {};
    Object.entries(durAgg).forEach(([rid, { total, count }]) => { if (count > 0) avgMap[rid] = total / count; });
    setAvgDuration(avgMap);

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
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    // Workouts finished offline live in the local queue until they sync. Surface
    // them in History so an offline finish is invisible to the user.
    const queued = getQueuedHistoryItems(uid);
    const { data: sessions, error } = await supabase
      .from('workout_sessions').select('*, session_exercises(*)').eq('user_id', uid).order('created_at', { ascending: false });
    if (error) {
      // Offline: keep what's shown but make sure queued workouts are present.
      if (queued.length) setHistory(prev => {
        const seen = new Set(prev.map(s => s.id));
        return [...queued.filter(q => !seen.has(q.id)), ...prev];
      });
      return;
    }
    const serverItems = sessions.map(s => ({
      id: s.id, date: s.date, routineName: s.routine_name,
      exercises: s.session_exercises.map(e => ({ name: e.exercise_name, sets: Array.isArray(e.sets) ? e.sets : (typeof e.sets === 'string' ? JSON.parse(e.sets) : []) }))
    }));
    // Prepend queued workouts the server doesn't have yet (same id => no dupe
    // once they sync). Queued items are the most recent, so they go on top.
    const serverIds = new Set(serverItems.map(s => s.id));
    const pending = queued.filter(q => !serverIds.has(q.id));
    setHistory([...pending, ...serverItems]);
  };

  const deleteSelectedSessions = async () => {
    const ids = [...selectedSessions];
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    await supabase.from('session_exercises').delete().eq('user_id', uid).in('session_id', ids);
    await supabase.from('workout_sessions').delete().eq('user_id', uid).in('id', ids);
    setHistory(prev => prev.filter(s => !selectedSessions.has(s.id)));
    setSelectedSessions(new Set());
    setEditMode(false);
  };

  // ─── Routine edit mode (tiles unchanged; selection + bottom action bar) ─────
  const enterRoutineEdit = () => { setSelectedRoutines(new Set()); setRoutineEditMode(true); };
  const exitRoutineEdit = () => { setSelectedRoutines(new Set()); setRoutineEditMode(false); };
  const toggleSelectRoutine = (id) => setSelectedRoutines(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const deleteSelectedRoutines = () => {
    const ids = [...selectedRoutines];
    if (ids.length === 0) return;
    const removed = routines.filter(r => selectedRoutines.has(r.id));
    setRoutines(prev => prev.filter(r => !selectedRoutines.has(r.id)));
    exitRoutineEdit();
    showToast(
      `${removed.length} routine${removed.length !== 1 ? 's' : ''} deleted`,
      () => setRoutines(prev => {
        const have = new Set(prev.map(r => r.id));
        return [...prev, ...removed.filter(r => !have.has(r.id))];
      }),
      async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) return;
        await supabase.from('exercises').delete().eq('user_id', uid).in('routine_id', ids);
        await supabase.from('routines').delete().eq('user_id', uid).in('id', ids);
      }
    );
  };

  const duplicateSelectedRoutines = async () => {
    const targets = routines.filter(r => selectedRoutines.has(r.id));
    if (targets.length === 0) return;
    exitRoutineEdit();
    for (const r of targets) await duplicateRoutine(r);
  };

  // Rename acts on exactly one selected routine via a small modal.
  const openRenameModal = () => {
    if (selectedRoutines.size !== 1) return;
    const id = [...selectedRoutines][0];
    const r = routines.find(x => x.id === id);
    if (r) setRenameModal({ id, value: r.name });
  };

  const submitRenameModal = async () => {
    if (!renameModal) return;
    const name = renameModal.value.trim();
    if (!name) return;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { error } = await supabase.from('routines').update({ name }).eq('id', renameModal.id).eq('user_id', uid);
    if (error) { return; }
    setRoutines(prev => prev.map(r => r.id === renameModal.id ? { ...r, name } : r));
    setRenameModal(null);
    exitRoutineEdit();
  };

  const deleteSelectedExercises = async () => {
    const ids = [...selectedExercises];
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const updated = activeRoutine.exercises.filter(e => !selectedExercises.has(e.id));
    setActiveRoutine(prev => ({ ...prev, exercises: updated }));
    setRoutines(prev => prev.map(r => r.id === activeRoutine.id ? { ...r, exercises: updated } : r));
    setSelectedExercises(new Set());
    setExerciseEditMode(false);
    await supabase.from('exercises').delete().eq('user_id', uid).in('id', ids);
  };

  const deleteSingleSession = (id) => {
    const item = history.find(s => s.id === id);
    if (!item) return;
    setHistory(prev => prev.filter(s => s.id !== id));
    showToast(
      'Workout deleted',
      () => setHistory(prev => [...prev, item]),
      async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) return;
        await supabase.from('session_exercises').delete().eq('user_id', uid).eq('session_id', id);
        await supabase.from('workout_sessions').delete().eq('user_id', uid).eq('id', id);
      }
    );
  };

  const addRoutine = async () => {
    if (!newRoutineName.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data, error } = await supabase.from('routines')
      .insert([{ name: newRoutineName.trim(), user_id: uid }]).select().single();
    if (error) { return; }
    setRoutines([...routines, { ...data, exercises: [] }]);
    setNewRoutineName('');
    setShowCreateModal(false);
  };

  const duplicateRoutine = async (routine) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data: newRoutine, error: routineError } = await supabase.from('routines')
      .insert([{ name: `${routine.name} (copy)`, user_id: uid }]).select().single();
    if (routineError) { return; }
    if (routine.exercises.length > 0) {
      const { data: newExercises, error: exError } = await supabase.from('exercises')
        .insert(routine.exercises.map((ex, idx) => ({ routine_id: newRoutine.id, name: ex.name, position: idx, rest_timers: ex.rest_timers || [], user_id: uid }))).select();
      if (exError) { return; }
      setRoutines([...routines, { ...newRoutine, exercises: newExercises.map(e => ({ ...e, lastSession: null })) }]);
    } else {
      setRoutines([...routines, { ...newRoutine, exercises: [] }]);
    }
  };

  const openRoutine = (routine) => {
    const prefilled = {};
    const prefilledRest = {};
    routine.exercises.forEach(ex => {
      prefilled[ex.id] = prefillSetsFor(ex);
      const rt = ex.rest_timers;
      prefilledRest[ex.id] = Array.isArray(rt) ? rt : (typeof rt === 'string' ? JSON.parse(rt) : []);
    });
    setActiveRoutine(routine);
    setSessionLog(prefilled);
    setRestTimers(prefilledRest);
    restTimersRef.current = prefilledRest;
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
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      const updates = reordered.map((ex, index) =>
        supabase.from('exercises').update({ position: index }).eq('id', ex.id).eq('user_id', uid)
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
    let computed;
    setSessionLog(prev => {
      const sets = [...(prev[exId] || [])];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      computed = sets;
      return { ...prev, [exId]: sets };
    });
    // In the routine config view these edits are the saved plan; persist them.
    // During an active workout they're the live session log — don't touch the plan.
    if (view === 'exercises') savePlannedSets(exId, computed);
  };

  const addSet = (exId) => {
    let computed;
    setSessionLog(prev => {
      computed = [...(prev[exId] || []), { sets: '', reps: '', weight: '' }];
      return { ...prev, [exId]: computed };
    });
    if (view === 'exercises') savePlannedSets(exId, computed);
  };

  const deleteSet = (exId, setIdx) => {
    let computed;
    setSessionLog(prev => {
      const sets = [...(prev[exId] || [])];
      sets.splice(setIdx, 1);
      computed = sets;
      return { ...prev, [exId]: sets };
    });
    if (view === 'exercises') savePlannedSets(exId, computed);
    // Keep the rest-timer slots aligned to set indices (slot i = rest after set i).
    if (restTimersRef.current[exId]) {
      const arr = [...restTimersRef.current[exId]];
      arr.splice(setIdx, 1);
      commitRestTimers(exId, arr);
    }
    // Slots shifted, so drop any finished-rest labels for this exercise to avoid mislabeling.
    setRestStatus(prev => (prev[exId] ? { ...prev, [exId]: {} } : prev));
  };

  const toggleCheck = (exId, setIdx) => {
    const nowChecked = !checkedSets[exId]?.[setIdx];
    const nextArr = [...(checkedSets[exId] || [])];
    nextArr[setIdx] = nowChecked;
    setCheckedSets(prev => {
      const arr = [...(prev[exId] || [])];
      arr[setIdx] = nowChecked;
      return { ...prev, [exId]: arr };
    });
    // Completing the final set of an exercise (every set now checked) auto-advances:
    // collapse this card and expand the next exercise in the routine, so the user
    // flows straight into it. Only fires on check (not uncheck) and only when a next
    // exercise exists — the last exercise stays put.
    const totalSets = (sessionLog[exId] || []).length;
    if (nowChecked && totalSets > 0 && nextArr.filter(Boolean).length >= totalSets) {
      const exOrder = activeRoutine?.exercises || [];
      const pos = exOrder.findIndex(e => e.id === exId);
      const next = pos >= 0 ? exOrder[pos + 1] : null;
      if (next) setExpandedExId(next.id);
    }
    // Auto-start / cancel the rest configured after this set (if any).
    const dur = restTimersRef.current[exId]?.[setIdx];
    if (typeof dur === 'number' && dur > 0) {
      clearRestStatus(exId, setIdx); // re-checking restarts a fresh rest
      if (nowChecked) {
        onStartRest({ exId, slotIdx: setIdx, duration: dur });
      } else if (activeRest && activeRest.exId === exId && activeRest.slotIdx === setIdx) {
        onSkipRest(); // unchecking cancels the running rest back to plain "Rest"
      }
    }
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
    setRestStatus({});
    setExpandedExId(activeRoutine.exercises[0]?.id || null);
    setView('logging');
    setActiveWorkout({ routineName: activeRoutine.name, startTime: Date.now(), routine: activeRoutine, sessionLog: initial });
    onWorkoutStart();
  };

  // Start a workout straight from a routine card (skips the exercises preview). Combines
  // openRoutine's prefill with startLogging, operating on the passed routine so it doesn't
  // depend on activeRoutine/sessionLog state being set yet.
  const startWorkoutFromRoutine = (routine) => {
    if (!routine.exercises || routine.exercises.length === 0) return;
    // Resume instead of restarting if this routine's workout is already in progress.
    if (activeWorkout?.routine?.id === routine.id) {
      setActiveRoutine(activeWorkout.routine); setView('logging'); onExpand(); return;
    }
    const initial = {};
    const prefilledRest = {};
    routine.exercises.forEach(ex => {
      initial[ex.id] = prefillSetsFor(ex);
      const rt = ex.rest_timers;
      prefilledRest[ex.id] = Array.isArray(rt) ? rt : (typeof rt === 'string' ? JSON.parse(rt) : []);
    });
    setActiveRoutine(routine);
    setSessionLog(initial);
    setRestTimers(prefilledRest);
    restTimersRef.current = prefilledRest;
    setExerciseEditMode(false);
    setSelectedExercises(new Set());
    setCheckedSets({});
    setRestStatus({});
    setExpandedExId(routine.exercises[0]?.id || null);
    setView('logging');
    setActiveWorkout({ routineName: routine.name, startTime: Date.now(), routine, sessionLog: initial });
    onWorkoutStart();
  };

  const confirmFinishWorkout = async () => {
    if (finishingRef.current) return;   // already saving — ignore the duplicate trigger
    finishingRef.current = true;
    const currentLog = sessionLogRef.current;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) { finishingRef.current = false; return; }

    // Ids are generated client-side so the offline fallback (and its later
    // replay) reference a stable session_id without a server round-trip.
    const sessionId = crypto.randomUUID();
    const sessionRow = {
      id: sessionId,
      routine_id: activeRoutine.id,
      routine_name: activeRoutine.name,
      date: new Date().toLocaleDateString(),
      duration: workoutSeconds,
      user_id: uid,
    };
    const exerciseInserts = activeRoutine.exercises.map(ex => ({
      id: crypto.randomUUID(),
      session_id: sessionId,
      exercise_name: ex.name,
      sets: currentLog[ex.id] || [],
      user_id: uid,
    }));

    // Try the normal online save. If it fails because we're offline, queue the
    // bundle and fall through to the exact same success path — the user can't
    // tell the difference. A real (non-network) error keeps today's behavior:
    // bail and leave the modal open rather than silently swallow a genuine bug.
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error('offline');   // skip the doomed round-trip
      }
      const { error: sessionError } = await supabase.from('workout_sessions').insert([sessionRow]);
      if (sessionError) throw sessionError;
      const { error: exError } = await supabase.from('session_exercises').insert(exerciseInserts);
      if (exError) throw exError;
    } catch (err) {
      if (isNetworkError(err)) {
        queueWorkoutSave(uid, { session: sessionRow, exercises: exerciseInserts });
      } else {
        finishingRef.current = false;
        return;
      }
    }

    // Save what was actually logged as each exercise's plan, so re-opening the
    // routine prefills this session's sets/reps/weight (still editable before
    // the next workout). Best-effort — skipped if offline; loadRoutines below
    // refreshes the in-memory copies either way.
    try {
      await Promise.all(activeRoutine.exercises.map(ex =>
        supabase.from('exercises').update({ planned_sets: currentLog[ex.id] || [] }).eq('id', ex.id).eq('user_id', uid)
      ));
    } catch {}

    await loadHistory();   // online: refetch; offline: merges the just-queued workout
    await loadRoutines();
    setActiveWorkout(null);
    setView('routines');
    setActiveRoutine(null);
    finishingRef.current = false;   // ready for the next workout
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
    setShowExercisePicker(true);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data } = await supabase.from('custom_exercises').select('*').eq('user_id', uid).order('created_at');
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
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const inserts = [...selectedPickerExercises].map((name, idx) => ({ routine_id: activeRoutine.id, name, position: basePosition + idx, user_id: uid, category: NAME_TO_CATEGORY[name] || null }));
    const { data, error } = await supabase.from('exercises').insert(inserts).select();
    if (error) { return; }
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


  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>Loading...</p>;

  // A single logging card.
  const renderLoggingCard = (ex) => (
    <LoggingExerciseCard
      key={ex.id}
      ex={ex}
      sessionLog={sessionLog}
      updateSet={updateSet}
      addSet={addSet}
      deleteSet={deleteSet}
      checkedSets={checkedSets[ex.id] || []}
      toggleCheck={(idx) => toggleCheck(ex.id, idx)}
      isCustom={customExerciseNames.has(ex.name)}
      restTimers={restTimers[ex.id] || []}
      activeRest={activeRest}
      restRemaining={restRemaining}
      restStatus={restStatus[ex.id] || {}}
      onSkipRest={(idx) => handleSkipRest(ex.id, idx)}
      isExpanded={expandedExId === ex.id}
      onToggleExpand={() => setExpandedExId(expandedExId === ex.id ? null : ex.id)}
      onDeleteExercise={async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) return;
        setActiveRoutine(prev => ({ ...prev, exercises: prev.exercises.filter(e => e.id !== ex.id) }));
        setRoutines(prev => prev.map(r => r.id === activeRoutine.id ? { ...r, exercises: r.exercises.filter(e => e.id !== ex.id) } : r));
        setSessionLog(prev => { const n = { ...prev }; delete n[ex.id]; return n; });
        setCheckedSets(prev => { const n = { ...prev }; delete n[ex.id]; return n; });
        await supabase.from('exercises').delete().eq('id', ex.id).eq('user_id', uid);
      }}
      onRenameExercise={async (newName) => {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) return;
        setActiveRoutine(prev => ({ ...prev, exercises: prev.exercises.map(e => e.id === ex.id ? { ...e, name: newName } : e) }));
        setRoutines(prev => prev.map(r => r.id === activeRoutine.id ? { ...r, exercises: r.exercises.map(e => e.id === ex.id ? { ...e, name: newName } : e) } : r));
        await supabase.from('exercises').update({ name: newName }).eq('id', ex.id).eq('user_id', uid);
      }}
    />
  );

  let loggingModal = null;
  if (view === 'logging') {
    const totalSets = activeRoutine.exercises.reduce((sum, ex) => sum + (sessionLog[ex.id] || []).length, 0);
    const totalChecked = Object.values(checkedSets).reduce((sum, arr) => sum + arr.filter(Boolean).length, 0);
    const progress = totalSets > 0 ? (totalChecked / totalSets) * 100 : 0;
    const completedExCount = activeRoutine.exercises.filter(ex => (checkedSets[ex.id] || []).some(Boolean)).length;
    const totalVolume = activeRoutine.exercises.reduce((sum, ex) =>
      sum + (sessionLog[ex.id] || []).reduce((s, set, idx) =>
        s + (checkedSets[ex.id]?.[idx] ? (Number(set.weight) || 0) * (Number(set.reps) || 0) : 0), 0), 0);

    loggingModal = (
      <div ref={logging.sheetRef} onPointerDown={logging.onPointerDown} style={{
        position: 'fixed', inset: 0, zIndex: 350,
        background: 'var(--bg)',
        transform: workoutExpanded ? `translateY(${logging.dragY}px) translateZ(0)` : 'translateY(100%) translateZ(0)',
        transition: logging.dragging ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Drag handle — swipe down anywhere on the sheet (once the list is at the top) to collapse */}
        <div
          style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', flexShrink: 0, userSelect: 'none', touchAction: 'none' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
        </div>

        {/* Combined stats tile */}
        <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', padding: '18px' }}>
            {/* Workout time + Volume side by side */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Workout Time</div>
                <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                  {formatHMS(workoutSeconds)}
                </div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Elapsed</div>
              </div>

              {/* Vertical divider */}
              <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--border)', margin: '0 12px' }} />

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Volume</div>
                <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--accent)', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                  {totalVolume.toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{metricSystem === 'metric' ? 'Kg' : 'Lbs'}</div>
              </div>
            </div>

            {/* Exercise progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
              <div style={{ flex: 1, height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {completedExCount}/{activeRoutine.exercises.length} exercises
              </div>
            </div>
          </div>
        </div>

        {/* Exercise cards */}
        <div ref={logging.scrollRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {activeRoutine.exercises.map(ex => renderLoggingCard(ex))}
          {/* Add Exercise — identical to the config-view button; opens the shared picker,
              which inserts into the routine and seeds sessionLog so the new card is loggable. */}
          <button onClick={openExercisePicker}
            style={{ width: '100%', background: 'transparent', border: '1px solid var(--accent)', borderRadius: '12px', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            + Add Exercise
          </button>
        </div>

        {/* Pause / Finish buttons */}
        <div style={{ padding: '12px 16px 28px', flexShrink: 0, borderTop: '1px solid var(--border)', display: 'flex', gap: '10px' }}>
          <button onClick={onTogglePause}
            style={{ flex: 1, padding: '18px', fontSize: '17px', fontWeight: '700', background: 'transparent', border: '1px solid var(--accent)', borderRadius: '12px', color: 'var(--accent)', cursor: 'pointer' }}>
            {workoutPaused ? 'Resume Workout' : 'Pause Workout'}
          </button>
          <button onClick={finishWorkout} className="btn-primary" style={{ flex: 1, padding: '18px', fontSize: '17px', fontWeight: '700' }}>
            Finish Workout
          </button>
        </div>

        {showShortWorkoutModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '20px' }}
            onClick={() => setShowShortWorkoutModal(false)}>
            <div style={{ background: 'var(--card)', border: '1.5px solid var(--accent)', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '340px', boxShadow: '0 12px 40px rgba(0,0,0,0.22)', animation: 'restTileIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
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
                  style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'transparent', border: '1px solid #EF4444', color: '#EF4444', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>Discard</button>
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
    <div ref={picker.sheetRef} onPointerDown={picker.onPointerDown} style={{
      position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg)',
      transform: pickerOpen ? `translateY(${picker.dragY}px) translateZ(0)` : 'translateY(100%) translateZ(0)',
      transition: picker.dragging ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      willChange: 'transform',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Drag handle — full 60px touch area; swipe down anywhere on the sheet (once the list is at the top) to dismiss */}
      <div
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
      <div ref={picker.scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: '100px' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
    <div style={{ padding: '16px', paddingBottom: routineEditMode ? '160px' : '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 0' }}>
        <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>My Routines</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!routineEditMode && routines.length > 0 && (
            <button onClick={enterRoutineEdit}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '14px', fontWeight: '600', padding: '4px 8px' }}>
              Edit
            </button>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRoutineDragEnd}>
        <SortableContext items={routines.map(r => r.id)} strategy={verticalListSortingStrategy}>
      {routines.map(r => (
        <SortableRoutineWrapper key={r.id} id={r.id}>
        {(listeners) => (
        <div style={{
          background: 'var(--card)', borderRadius: '12px', padding: '18px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)', border: '1px solid var(--border)',
          display: 'flex', alignItems: routineEditMode ? 'center' : 'flex-start', gap: '12px'
        }}>
          {/* Edit mode keeps the tile identical — just a selection checkbox (left) and a drag
              handle (right); actions live in the bottom bar. Tapping the tile toggles selection. */}
          {routineEditMode && (
            <button onClick={() => toggleSelectRoutine(r.id)} aria-label="Select routine"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${selectedRoutines.has(r.id) ? 'var(--accent)' : 'var(--border)'}`, background: selectedRoutines.has(r.id) ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedRoutines.has(r.id) && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
            onClick={() => {
              if (routineEditMode) { toggleSelectRoutine(r.id); return; }
              if (activeWorkout?.routine?.id === r.id) { setActiveRoutine(activeWorkout.routine); setView('logging'); onExpand(); return; }
              openRoutine(r);
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontWeight: '700', fontSize: '18px', color: 'var(--text-primary)', lineHeight: 1.1 }}>{r.name}</div>
              {activeWorkout?.routine?.id === r.id && (
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: '20px' }}>Active</span>
              )}
            </div>
            {routineCategories(r).length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {routineCategories(r).join('  •  ')}
              </div>
            )}
            {/* Meta row: last performed · # exercises · avg workout time, separated by dividers. */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
              <span>
                {lastPerformed[r.id] ? (
                  <>Last performed <span style={{ color: 'var(--accent)', fontWeight: '600' }}>{daysAgoText(lastPerformed[r.id])}</span></>
                ) : 'Never performed'}
              </span>
              <span style={{ width: '1px', height: '11px', background: 'var(--border)', flexShrink: 0 }} />
              <span>{r.exercises.length} exercise{r.exercises.length !== 1 ? 's' : ''}</span>
              {avgDuration[r.id] != null && (
                <>
                  <span style={{ width: '1px', height: '11px', background: 'var(--border)', flexShrink: 0 }} />
                  <span>{avgTimeText(avgDuration[r.id])}</span>
                </>
              )}
            </div>
          </div>
          {/* Normal mode: small Start button (top-right). Greyed when the routine has no
              exercises or while a workout is in progress. */}
          {!routineEditMode && (() => {
            const disabled = r.exercises.length === 0 || !!activeWorkout;
            return (
              <button
                onClick={(e) => { e.stopPropagation(); if (!disabled) startWorkoutFromRoutine(r); }}
                disabled={disabled}
                style={{
                  flexShrink: 0, borderRadius: '8px', padding: '7px 12px',
                  fontSize: '13px', fontWeight: '600', lineHeight: 1, whiteSpace: 'nowrap',
                  background: disabled ? 'var(--border)' : '#fff',
                  border: disabled ? '1px solid var(--border)' : '1px solid var(--accent)',
                  color: disabled ? 'var(--text-muted)' : 'var(--accent)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1,
                }}>
                Start Workout
              </button>
            );
          })()}
          {/* Edit mode: drag handle to reorder. */}
          {routineEditMode && (
            <div {...listeners} style={{ touchAction: 'none', cursor: 'grab', padding: '8px 2px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
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

      {/* Edit-mode action bar — floats above the tab bar (like the food log's select bar).
          The routine tiles stay unchanged; these act on the ticked routines. */}
      {routineEditMode && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 82, width: '100%', maxWidth: 'calc(100% - 32px)', zIndex: 150 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.18)', padding: '12px 14px', display: 'flex', gap: 8 }}>
            <button onClick={deleteSelectedRoutines} disabled={selectedRoutines.size === 0}
              style={{ flex: 1, background: '#ff4444', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 14, cursor: selectedRoutines.size === 0 ? 'default' : 'pointer', opacity: selectedRoutines.size === 0 ? 0.4 : 1 }}>
              Delete ({selectedRoutines.size})
            </button>
            <button onClick={duplicateSelectedRoutines} disabled={selectedRoutines.size === 0}
              className="btn-secondary" style={{ flex: 1, opacity: selectedRoutines.size === 0 ? 0.4 : 1, cursor: selectedRoutines.size === 0 ? 'default' : 'pointer' }}>Duplicate</button>
            <button onClick={openRenameModal} disabled={selectedRoutines.size !== 1}
              className="btn-secondary" style={{ flex: 1, opacity: selectedRoutines.size !== 1 ? 0.4 : 1, cursor: selectedRoutines.size !== 1 ? 'default' : 'pointer' }}>Rename</button>
            <button onClick={exitRoutineEdit}
              style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: 'var(--text-primary)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {renameModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '20vh', zIndex: 500 }}
          onClick={() => setRenameModal(null)}>
          <div style={{ background: 'var(--card)', borderRadius: '16px', padding: '24px', width: '300px' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: '600', marginBottom: '16px', fontSize: '16px', color: 'var(--text-primary)' }}>Rename Routine</p>
            <input value={renameModal.value} onChange={e => setRenameModal(m => ({ ...m, value: e.target.value }))}
              className="input" style={{ marginBottom: '16px' }}
              onKeyDown={e => e.key === 'Enter' && submitRenameModal()} autoFocus />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setRenameModal(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={submitRenameModal} className="btn-primary" style={{ flex: 1 }}>Save</button>
            </div>
          </div>
        </div>
      )}
      {loggingModal}
      {exercisePickerSheet}
    </div>
  );

  const renderConfigExercise = (ex) => (
    <SortableExercise key={ex.id} ex={ex} exerciseEditMode={exerciseEditMode} isSelected={selectedExercises.has(ex.id)} onToggleSelect={() => setSelectedExercises(prev => { const next = new Set(prev); next.has(ex.id) ? next.delete(ex.id) : next.add(ex.id); return next; })} sessionLog={sessionLog} updateSet={updateSet} addSet={addSet} deleteSet={deleteSet} isCustom={customExerciseNames.has(ex.name)} restTimers={restTimers[ex.id] || []} addRest={addRest} changeRest={changeRest} deleteRest={deleteRest} />
  );

  if (view === 'exercises') return (
    <>
    <div style={{ padding: '16px', paddingBottom: '80px', display: 'flex', flexDirection: 'column', gap: '8px', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <button onClick={() => { setView('routines'); setExerciseEditMode(false); setSelectedExercises(new Set()); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '15px', fontWeight: '600', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Back
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
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeRoutine.exercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
          {activeRoutine.exercises.map((ex) => renderConfigExercise(ex))}
        </SortableContext>
      </DndContext>

      {/* Add Exercise — white card with blue border, styled like the Add Set button */}
      <button onClick={openExercisePicker}
        style={{ width: '100%', background: 'transparent', border: '1px solid var(--accent)', borderRadius: '12px', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        + Add Exercise
      </button>

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
    // Group completed sessions by calendar day (YYYY-MM-DD) for the month-overview calendar.
    const workoutDayMap = {};
    history.forEach(session => {
      const key = ymd(new Date(session.date));
      (workoutDayMap[key] = workoutDayMap[key] || []).push(session);
    });
    const workoutDays = new Set(Object.keys(workoutDayMap));
    const isAllSelected = history.length > 0 && history.every(s => selectedSessions.has(s.id));

    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

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
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0, display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            )
          )}
          <h2 style={{ margin: 0, color: 'var(--text-primary)', flex: 1 }}>Workout History</h2>
          {!editMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button onClick={() => setCalendarView(v => !v)}
                style={{ background: calendarView ? 'var(--accent-light)' : 'none', border: calendarView ? '1px solid var(--border)' : '1px solid transparent', borderRadius: '8px', cursor: 'pointer', padding: '6px', color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
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

        {/* Calendar view — month-overview style (matches Daily Habits). Days with a
            completed workout show a filled circle; tap one to see that day's sessions. */}
        {calendarView && !editMode && history.length > 0 && (
          <div className="card-flat" style={{ padding: '16px' }}>
            <MonthOverviewCalendar
              markedDays={workoutDays}
              onSelectDay={(key) => {
                const sessions = workoutDayMap[key];
                if (sessions && sessions.length) {
                  setCalendarDayModal({ date: parseYmd(key).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), sessions });
                }
              }}
            />
          </div>
        )}

        {/* List view */}
        {!calendarView && history.map(session => (
          <div key={session.id} className="card-flat" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
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
          <div style={{ position: 'fixed', inset: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '20px' }}
            onClick={() => setCalendarDayModal(null)}>
            <div style={{ background: 'var(--card)', border: '1.5px solid var(--accent)', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '340px', maxHeight: '70vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.22)', animation: 'restTileIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
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