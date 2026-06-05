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


// Palette for the routine accent bar (matches the Measurements color set).
const CHART_COLORS = ['#3B82F6', '#22C55E', '#EAB308', '#A855F7', '#F97316', '#EF4444', '#06B6D4', '#EC4899'];

// Pick a stable, random-looking color per routine by hashing its id so it
// doesn't flicker between renders the way Math.random() would.
const routineColor = (id) => {
  const str = String(id);
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return CHART_COLORS[hash % CHART_COLORS.length];
};

function formatHMS(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
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
const REST_STEP_SECONDS = 30;    // +/- buttons adjust by 30s

function SortableExercise({ ex, exerciseEditMode, isSelected, onToggleSelect, sessionLog, updateSet, addSet, deleteSet, restTimers = [], addRest, changeRest, deleteRest, inSuperset = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ex.id });
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);
  // Which rest slot (set index) is being manually edited, and its draft text.
  const [editingRest, setEditingRest] = useState(null);
  const [restDraft, setRestDraft] = useState('');

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [expanded, sessionLog, restTimers, editingRest]);

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
  // Grouped (superset) exercises hide per-set rests — rests live at the group level instead.
  const renderRestSlot = (idx) => {
    if (inSuperset) return null;
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
          {exerciseEditMode && !inSuperset && (
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
                Add Set
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

// Group a flat exercise list into render units: consecutive exercises sharing a
// superset_id become one { type:'group' } unit; everything else is a 'single'.
function groupExercises(exercises) {
  const units = [];
  let i = 0;
  while (i < exercises.length) {
    const gid = exercises[i].superset_id;
    if (gid) {
      const members = [];
      while (i < exercises.length && exercises[i].superset_id === gid) { members.push(exercises[i]); i++; }
      units.push({ type: 'group', groupId: gid, exercises: members });
    } else {
      units.push({ type: 'single', ex: exercises[i] });
      i++;
    }
  }
  return units;
}

// Indented gutter with a vertical line + circles that visually binds the
// exercises of a superset together (like the food-log timeline). `rows` is an
// array of { node, circle } — circle marks an exercise (vs the rest block).
function SupersetWrap({ rows }) {
  return (
    <div style={{ position: 'relative' }}>
      {rows.map((row, i) => {
        const isFirst = i === 0;
        const isLast = i === rows.length - 1;
        return (
          <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
            <div style={{ width: '16px', position: 'relative', flexShrink: 0 }}>
              {/* Continuous line from the first circle down to the last row */}
              <div style={{ position: 'absolute', left: '7px', top: isFirst ? '20px' : 0, bottom: isLast ? '8px' : 0, width: '2px', background: 'var(--accent)', opacity: 0.4 }} />
              {row.circle && <div style={{ position: 'absolute', left: '2px', top: '14px', width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--accent)', background: 'var(--bg)' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0, marginBottom: '8px' }}>{row.node}</div>
          </div>
        );
      })}
    </div>
  );
}

// Config-view rest editor for a superset group: 5 slots in the same divider
// style as the per-set rests — "── Rest 1  [− 1:30 +]  Delete ──", or a
// "── + Add Rest ──" divider when a slot is deleted.
function GroupRestConfig({ gid, rests, addGroupRest, changeGroupRest, deleteGroupRest }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const stepBtnStyle = {
    width: '28px', height: '28px', borderRadius: '8px', border: '1px solid var(--border)',
    background: 'var(--card)', color: 'var(--accent)', cursor: 'pointer', fontSize: '18px',
    fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0,
  };
  const commit = () => {
    if (editing === null) return;
    const parsed = parseRest(draft);
    if (parsed !== null) changeGroupRest(gid, editing, parsed);
    setEditing(null); setDraft('');
  };
  return (
    <>
      {Array.from({ length: 5 }).map((_, idx) => {
        const value = rests[idx];
        if (value === null || value === undefined) {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <button onClick={() => addGroupRest(gid, idx)}
                style={{ background: 'transparent', border: '1px solid var(--accent)', borderRadius: '8px', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', padding: '5px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                + Add Rest
              </button>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
          );
        }
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)', whiteSpace: 'nowrap' }}>Rest {idx + 1}</span>
              <button onClick={() => changeGroupRest(gid, idx, value - REST_STEP_SECONDS)} disabled={value <= 0} aria-label="Decrease rest"
                style={{ ...stepBtnStyle, opacity: value <= 0 ? 0.4 : 1, cursor: value <= 0 ? 'default' : 'pointer' }}>−</button>
              {editing === idx ? (
                <input value={draft} autoFocus onChange={e => setDraft(e.target.value)} onBlur={commit}
                  onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(null); setDraft(''); } }}
                  placeholder="m:ss" inputMode="numeric"
                  className="input" style={{ width: '64px', padding: '6px', textAlign: 'center', fontSize: '15px' }} />
              ) : (
                <button onClick={() => { setEditing(idx); setDraft(formatRest(value)); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', minWidth: '54px', textAlign: 'center', padding: 0 }}>
                  {formatRest(value)}
                </button>
              )}
              <button onClick={() => changeGroupRest(gid, idx, value + REST_STEP_SECONDS)} aria-label="Increase rest" style={stepBtnStyle}>+</button>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <button onClick={() => deleteGroupRest(gid, idx)}
                style={{ background: 'transparent', border: '1px solid #EF4444', borderRadius: '8px', cursor: 'pointer', color: '#EF4444', fontSize: '12px', fontWeight: '600', padding: '5px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

function LoggingExerciseCard({ ex, sessionLog, updateSet, addSet, deleteSet, checkedSets, toggleCheck, isExpanded, onToggleExpand, onDeleteExercise, onRenameExercise, restTimers = [], activeRest, restRemaining, restStatus = {}, onSkipRest = () => {} }) {
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [nameDraft, setNameDraft] = useState(ex.name);

  useEffect(() => {
    if (contentRef.current) setContentHeight(contentRef.current.scrollHeight);
  }, [isExpanded, sessionLog, checkedSets, editMode, restTimers, restStatus, activeRest]);

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
              <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }}>{ex.name}</div>
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
      <div style={{ height: isExpanded ? `${contentHeight}px` : '0px', overflow: 'hidden', opacity: isExpanded ? 1 : 0, transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease', willChange: 'height', transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
        <div ref={contentRef} style={{ padding: '0 16px 16px', transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}>
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
                inputMode="decimal"
                placeholder="0" className="input" style={{ padding: '10px', textAlign: 'center' }} />
              <input value={set.reps} onChange={e => updateSet(ex.id, idx, 'reps', e.target.value)}
                inputMode="numeric" pattern="[0-9]*"
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
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
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

function Workouts({ activeWorkout, setActiveWorkout, workoutSeconds, initialView, workoutExpanded = false, onCollapse = () => {}, onWorkoutStart = () => {}, onExpand = () => {}, showToast = () => {}, resetKey = 0, metricSystem = 'imperial', workoutPaused = false, onTogglePause = () => {}, activeRest = null, restRemaining = 0, completedRest = null, onStartRest = () => {}, onSkipRest = () => {} }) {
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
  const [menuOpen, setMenuOpen] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [renamingRoutine, setRenamingRoutine] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const sessionLogRef = useRef(sessionLog);
  // Rest timers keyed by exercise id: array where index i = rest (seconds) after set i, or null/undefined for no timer.
  const [restTimers, setRestTimers] = useState(savedLog?.restTimers || {});
  const restTimersRef = useRef(restTimers);
  // Finished rest states during the active workout: { [exId]: { [slotIdx]: 'completed' | 'skipped' } }.
  // The *running* rest itself is owned by App (activeRest prop); this only tracks the after-state.
  const [restStatus, setRestStatus] = useState(savedLog?.restStatus || {});
  // Superset between-round rests keyed by group id: { [gid]: [s0..s4] } (null = deleted).
  const [supersetRests, setSupersetRests] = useState(savedLog?.supersetRests || {});
  // Active-workout superset progress: current round per group, and finished rest labels.
  const [supersetRound, setSupersetRound] = useState(savedLog?.supersetRound || {});
  const [supersetRestStatus, setSupersetRestStatus] = useState(savedLog?.supersetRestStatus || {});
  const [checkedSets, setCheckedSets] = useState(savedLog?.checkedSets || {});
  const [expandedExId, setExpandedExId] = useState(savedLog?.expandedExId ?? null);
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
    restTimersRef.current = restTimers;
  }, [restTimers]);

  // Mirror the live logging state to localStorage while a workout is active.
  // App removes the key when the workout ends (finish/discard).
  useEffect(() => {
    if (!activeWorkout) return;
    try {
      localStorage.setItem('activeWorkoutLog', JSON.stringify({
        routine: activeRoutine, sessionLog, checkedSets, restStatus, restTimers, expandedExId,
        supersetRests, supersetRound, supersetRestStatus,
      }));
    } catch {}
  }, [activeWorkout, activeRoutine, sessionLog, checkedSets, restStatus, restTimers, expandedExId, supersetRests, supersetRound, supersetRestStatus]);

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

  // When App reports a rest finished naturally, flip it to "...Completed". For a
  // superset's between-round rest, also advance the group to the next round.
  useEffect(() => {
    if (!completedRest) return;
    if (completedRest.kind === 'superset') {
      const gid = completedRest.groupId, round = completedRest.slotIdx;
      setSupersetRestStatus(prev => ({ ...prev, [gid]: { ...(prev[gid] || {}), [round]: 'completed' } }));
      const members = activeRoutine?.exercises?.filter(e => e.superset_id === gid) || [];
      advanceSupersetRound(gid, round, members);
    } else {
      markRestStatus(completedRest.exId, completedRest.slotIdx, 'completed');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedRest?.token]);

  // Tapping the Skip Rest button: stop the running rest and label the slot "Rest Skipped".
  const handleSkipRest = (exId, slotIdx) => {
    markRestStatus(exId, slotIdx, 'skipped');
    onSkipRest();
  };

  // Skip a superset's between-round rest: label it and advance the round.
  const handleSkipSupersetRest = (gid, round) => {
    setSupersetRestStatus(prev => ({ ...prev, [gid]: { ...(prev[gid] || {}), [round]: 'skipped' } }));
    onSkipRest();
    const members = activeRoutine.exercises.filter(e => e.superset_id === gid);
    advanceSupersetRound(gid, round, members);
  };

  // Drive the superset alternation when a set is checked: collapse the current
  // exercise and expand the next; after the last one, run that round's rest.
  const handleSupersetCheck = (gid, exId, setIdx, nowChecked) => {
    const members = activeRoutine.exercises.filter(e => e.superset_id === gid);
    const j = members.findIndex(e => e.id === exId);
    const round = supersetRound[gid] || 0;
    if (!nowChecked) {
      if (activeRest?.kind === 'superset' && activeRest.groupId === gid && activeRest.slotIdx === round) onSkipRest();
      return;
    }
    if (setIdx !== round) return; // only the active round's set advances the group
    if (j < members.length - 1) {
      setExpandedExId(members[j + 1].id);
    } else {
      const dur = (supersetRests[gid] || [])[round];
      setSupersetRestStatus(prev => ({ ...prev, [gid]: { ...(prev[gid] || {}), [round]: undefined } }));
      if (typeof dur === 'number' && dur > 0) {
        onStartRest({ exId: gid, slotIdx: round, duration: dur, groupId: gid, kind: 'superset' });
      } else {
        advanceSupersetRound(gid, round, members);
      }
    }
  };

  // Persist an exercise's full rest-timer array to its row. The exercises table
  // GRANT/RLS already cover all columns, so this is a plain column update.
  const persistRest = async (exId, arr) => {
    const { error } = await supabase.from('exercises').update({ rest_timers: arr }).eq('id', exId);
    if (error) console.error(error);
  };

  // Write a new rest-timer array into both state and ref, then persist.
  const commitRestTimers = (exId, arr) => {
    const next = { ...restTimersRef.current, [exId]: arr };
    restTimersRef.current = next;
    setRestTimers(next);
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
        .insert(routine.exercises.map((ex, idx) => ({ routine_id: newRoutine.id, name: ex.name, position: idx, rest_timers: ex.rest_timers || [] }))).select();
      if (exError) { console.error(exError); return; }
      setRoutines([...routines, { ...newRoutine, exercises: newExercises.map(e => ({ ...e, lastSession: null })) }]);
    } else {
      setRoutines([...routines, { ...newRoutine, exercises: [] }]);
    }
  };

  // Build the per-group rest map from exercises' superset_rests column.
  const buildSupersetRests = (exercises) => {
    const map = {};
    exercises.forEach(ex => {
      if (ex.superset_id && !map[ex.superset_id]) {
        const r = ex.superset_rests;
        map[ex.superset_id] = Array.isArray(r) ? r : (typeof r === 'string' ? JSON.parse(r) : []);
      }
    });
    return map;
  };

  const openRoutine = (routine) => {
    const prefilled = {};
    const prefilledRest = {};
    routine.exercises.forEach(ex => {
      prefilled[ex.id] = ex.lastSession?.sets?.length > 0
        ? ex.lastSession.sets
        : [{ sets: '', reps: '', weight: '' }];
      const rt = ex.rest_timers;
      prefilledRest[ex.id] = Array.isArray(rt) ? rt : (typeof rt === 'string' ? JSON.parse(rt) : []);
    });
    setActiveRoutine(routine);
    setSessionLog(prefilled);
    setRestTimers(prefilledRest);
    restTimersRef.current = prefilledRest;
    setSupersetRests(buildSupersetRests(routine.exercises));
    setExerciseEditMode(false);
    setSelectedExercises(new Set());
    setView('exercises');
  };

  // Create a superset from the selected exercises: assign a shared id, pull them
  // contiguous, seed 5 default rests, and persist positions + grouping.
  const createSuperset = async () => {
    if (selectedExercises.size < 2 || !activeRoutine) return;
    const gid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `ss-${Date.now()}`;
    const rests = [REST_DEFAULT_SECONDS, REST_DEFAULT_SECONDS, REST_DEFAULT_SECONDS, REST_DEFAULT_SECONDS, REST_DEFAULT_SECONDS];
    const exs = activeRoutine.exercises;
    const selectedInOrder = exs.filter(e => selectedExercises.has(e.id));
    const nonSelected = exs.filter(e => !selectedExercises.has(e.id));
    const firstIdx = exs.findIndex(e => selectedExercises.has(e.id));
    const insertAt = exs.slice(0, firstIdx).filter(e => !selectedExercises.has(e.id)).length;
    const reordered = [...nonSelected.slice(0, insertAt), ...selectedInOrder, ...nonSelected.slice(insertAt)];
    const next = reordered.map((e, idx) => selectedExercises.has(e.id)
      ? { ...e, position: idx, superset_id: gid, superset_rests: rests }
      : { ...e, position: idx });
    setActiveRoutine(prev => ({ ...prev, exercises: next }));
    setRoutines(prev => prev.map(r => r.id === activeRoutine.id ? { ...r, exercises: next } : r));
    setSupersetRests(prev => ({ ...prev, [gid]: rests }));
    setExerciseEditMode(false);
    setSelectedExercises(new Set());
    await Promise.all(next.map((e, idx) => {
      const patch = { position: idx };
      if (selectedInOrder.some(s => s.id === e.id)) { patch.superset_id = gid; patch.superset_rests = rests; }
      return supabase.from('exercises').update(patch).eq('id', e.id);
    }));
  };

  const ungroupSuperset = async (gid) => {
    const next = activeRoutine.exercises.map(e => e.superset_id === gid ? { ...e, superset_id: null, superset_rests: null } : e);
    setActiveRoutine(prev => ({ ...prev, exercises: next }));
    setRoutines(prev => prev.map(r => r.id === activeRoutine.id ? { ...r, exercises: next } : r));
    setSupersetRests(prev => { const n = { ...prev }; delete n[gid]; return n; });
    await supabase.from('exercises').update({ superset_id: null, superset_rests: null }).eq('superset_id', gid);
  };

  // Group rest config (write to all members of the group so any can be read back).
  const commitGroupRests = (gid, arr) => {
    setSupersetRests(prev => ({ ...prev, [gid]: arr }));
    supabase.from('exercises').update({ superset_rests: arr }).eq('superset_id', gid)
      .then(({ error }) => { if (error) console.error(error); });
  };
  const addGroupRest = (gid, idx) => { const arr = [...(supersetRests[gid] || [])]; arr[idx] = REST_DEFAULT_SECONDS; commitGroupRests(gid, arr); };
  const changeGroupRest = (gid, idx, sec) => { const arr = [...(supersetRests[gid] || [])]; arr[idx] = Math.max(0, sec); commitGroupRests(gid, arr); };
  const deleteGroupRest = (gid, idx) => { const arr = [...(supersetRests[gid] || [])]; arr[idx] = null; commitGroupRests(gid, arr); };

  // Advance a superset to its next round (expand the first exercise), or mark done.
  const advanceSupersetRound = (gid, round, members) => {
    const maxSets = Math.max(0, ...members.map(m => (sessionLogRef.current[m.id] || []).length));
    setSupersetRound(prev => ({ ...prev, [gid]: round + 1 }));
    if (round + 1 < maxSets && members[0]) setExpandedExId(members[0].id);
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
    setCheckedSets(prev => {
      const arr = [...(prev[exId] || [])];
      arr[setIdx] = nowChecked;
      return { ...prev, [exId]: arr };
    });
    // Superset members use group-level alternation + between-round rests instead.
    const exObj = activeRoutine?.exercises?.find(e => e.id === exId);
    if (exObj?.superset_id) {
      handleSupersetCheck(exObj.superset_id, exId, setIdx, nowChecked);
      return;
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
    setSupersetRound({});
    setSupersetRestStatus({});
    setSupersetRests(buildSupersetRests(activeRoutine.exercises));
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

  // A single logging card. `inSuperset` hides its per-set rests (group rests are
  // rendered separately at the bottom of the group).
  const renderLoggingCard = (ex, inSuperset = false) => (
    <LoggingExerciseCard
      key={ex.id}
      ex={ex}
      sessionLog={sessionLog}
      updateSet={updateSet}
      addSet={addSet}
      deleteSet={deleteSet}
      checkedSets={checkedSets[ex.id] || []}
      toggleCheck={(idx) => toggleCheck(ex.id, idx)}
      restTimers={inSuperset ? [] : (restTimers[ex.id] || [])}
      activeRest={activeRest}
      restRemaining={restRemaining}
      restStatus={restStatus[ex.id] || {}}
      onSkipRest={(idx) => handleSkipRest(ex.id, idx)}
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
  );

  // The stacked group-rest tiles shown at the bottom of a superset in the
  // logging view (Rest 1…5; only configured rests appear).
  const renderGroupRests = (gid) => {
    const arr = supersetRests[gid] || [];
    if (!arr.some(v => typeof v === 'number')) return null;
    return (
      <div>
        {arr.map((val, r) => typeof val === 'number' ? (
          <RestRow
            key={r}
            name={`Rest ${r + 1}`}
            duration={val}
            running={activeRest?.kind === 'superset' && activeRest.groupId === gid && activeRest.slotIdx === r}
            remaining={restRemaining}
            status={supersetRestStatus[gid]?.[r]}
            onSkip={() => handleSkipSupersetRest(gid, r)}
          />
        ) : null)}
      </div>
    );
  };

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
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {groupExercises(activeRoutine.exercises).map(unit => unit.type === 'single'
            ? renderLoggingCard(unit.ex)
            : (
              <SupersetWrap key={unit.groupId} rows={unit.exercises.flatMap((ex, i) => {
                const row = { node: renderLoggingCard(ex, true), circle: true };
                return i === 0
                  ? [row, { node: renderGroupRests(unit.groupId), circle: false }]
                  : [row];
              })} />
            )
          )}
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
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
            style={{ background: 'var(--accent)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '13px', fontWeight: '500', lineHeight: 1, padding: '7px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            + Add Routine
          </button>
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
          borderLeft: `3px solid ${routineColor(r.id)}`,
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

  const renderConfigExercise = (ex, inSuperset = false) => (
    <SortableExercise key={ex.id} ex={ex} exerciseEditMode={exerciseEditMode} isSelected={selectedExercises.has(ex.id)} onToggleSelect={() => setSelectedExercises(prev => { const next = new Set(prev); next.has(ex.id) ? next.delete(ex.id) : next.add(ex.id); return next; })} sessionLog={sessionLog} updateSet={updateSet} addSet={addSet} deleteSet={deleteSet} restTimers={restTimers[ex.id] || []} addRest={addRest} changeRest={changeRest} deleteRest={deleteRest} inSuperset={inSuperset} />
  );

  if (view === 'exercises') return (
    <>
    <div style={{ padding: '16px', paddingBottom: '80px', display: 'flex', flexDirection: 'column', gap: '8px', WebkitOverflowScrolling: 'touch' }}>
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
          {!exerciseEditMode && activeRoutine?.exercises?.length > 0 && (
            <button onClick={() => { setExerciseEditMode(true); setSelectedExercises(new Set()); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '14px', fontWeight: '600', padding: '4px 8px' }}>
              Edit
            </button>
          )}
          <button onClick={openExercisePicker} aria-label="Add exercise"
            style={{ background: 'var(--accent)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '13px', fontWeight: '500', lineHeight: 1, padding: '7px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            + Add Exercise
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeRoutine.exercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
          {groupExercises(activeRoutine.exercises).map(unit => unit.type === 'single'
            ? renderConfigExercise(unit.ex)
            : (
              <div key={unit.groupId}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 2px 6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Superset</span>
                  {exerciseEditMode && (
                    <button onClick={() => ungroupSuperset(unit.groupId)}
                      style={{ background: 'transparent', border: '1px solid #EF4444', borderRadius: '8px', color: '#EF4444', cursor: 'pointer', fontSize: '12px', fontWeight: '600', padding: '5px 12px' }}>
                      Ungroup Superset
                    </button>
                  )}
                </div>
                <SupersetWrap rows={unit.exercises.flatMap((ex, i) => {
                  const row = { node: renderConfigExercise(ex, true), circle: true };
                  // Rests sit between the exercises (after the first one).
                  return i === 0
                    ? [row, { node: <GroupRestConfig gid={unit.groupId} rests={supersetRests[unit.groupId] || []} addGroupRest={addGroupRest} changeGroupRest={changeGroupRest} deleteGroupRest={deleteGroupRest} />, circle: false }]
                    : [row];
                })} />
              </div>
            )
          )}
        </SortableContext>
      </DndContext>

    </div>
    {!exerciseEditMode && activeRoutine.exercises.length > 0 && (
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
    {/* Edit-mode action bar (mirrors the food-log select bar) */}
    {exerciseEditMode && (
      <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 6, width: '100%', maxWidth: 'calc(100% - 32px)', zIndex: 350, animation: 'selectBarIn 0.22s ease-out' }}>
        <div style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.18)', padding: '12px 14px', display: 'flex', gap: 8 }}>
          <button onClick={createSuperset} disabled={selectedExercises.size < 2}
            style={{ flex: 1, background: selectedExercises.size >= 2 ? 'var(--accent)' : 'var(--border)', color: selectedExercises.size >= 2 ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 14, cursor: selectedExercises.size >= 2 ? 'pointer' : 'default' }}>
            Superset
          </button>
          <button onClick={deleteSelectedExercises} disabled={selectedExercises.size === 0}
            style={{ flex: 1, background: '#ff4444', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 14, cursor: selectedExercises.size === 0 ? 'default' : 'pointer', opacity: selectedExercises.size === 0 ? 0.4 : 1 }}>
            Delete{selectedExercises.size > 0 ? ` (${selectedExercises.size})` : ''}
          </button>
          <button onClick={() => { setExerciseEditMode(false); setSelectedExercises(new Set()); }}
            style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: 'var(--text-primary)' }}>
            Save
          </button>
        </div>
        <style>{`@keyframes selectBarIn { 0% { opacity: 0; transform: translateX(-50%) scaleX(0.4); } 100% { opacity: 1; transform: translateX(-50%) scaleX(1); } }`}</style>
      </div>
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