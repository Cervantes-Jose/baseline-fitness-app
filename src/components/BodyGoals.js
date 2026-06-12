import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { DEFAULT_MEASUREMENT_NAMES, getDefaultUnit } from './Measurements';
import { GOOD, BAD } from './goalColor';

// A measurement's `goal` (numeric, nullable) lives on the `measurements` row — it's
// user-owned target data, covered by the table's owner RLS policy. Weight/Body Fat are
// just measurements named that way; "common" ones come from DEFAULT_MEASUREMENT_NAMES,
// anything else is Custom (keeps its badge here too).

const DEFAULT_NAME_SET = new Set(DEFAULT_MEASUREMENT_NAMES.map(n => n.toLowerCase()));

const fmt = (n) => (n == null || isNaN(n)) ? '—' : (Math.round(n * 10) / 10).toFixed(1);

// Progress from the earliest logged value toward the goal (0..1).
const progressOf = (start, current, goal) => {
  if (start == null || current == null || goal == null) return 0;
  if (goal === start) return current === goal ? 1 : 0;
  return Math.max(0, Math.min(1, (current - start) / (goal - start)));
};

export default function BodyGoals({ metricSystem = 'imperial' }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftGoals, setDraftGoals] = useState({}); // { [id]: number | '' | null }
  const [showAdd, setShowAdd] = useState(false);
  const [defaultIds, setDefaultIds] = useState(() => new Set());

  // eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) { setLoading(false); return; }
    setDefaultIds(new Set(JSON.parse(localStorage.getItem(`defaultMeasurementIds_${uid}`) || '[]')));
    const [{ data: meas }, { data: ents }] = await Promise.all([
      supabase.from('measurements').select('id, name, goal').eq('user_id', uid).order('created_at', { ascending: true }),
      supabase.from('measurement_entries').select('measurement_id, value, unit, created_at').eq('user_id', uid).order('created_at', { ascending: true }),
    ]);
    const byId = {};
    (ents || []).forEach(e => { (byId[e.measurement_id] = byId[e.measurement_id] || []).push(e); });
    const list = (meas || []).map(m => {
      const nums = (byId[m.id] || []).map(e => ({ v: Number(e.value), unit: e.unit })).filter(x => !isNaN(x.v));
      const first = nums[0], last = nums[nums.length - 1];
      return {
        id: m.id,
        name: m.name,
        goal: m.goal == null ? null : Number(m.goal),
        unit: last?.unit || getDefaultUnit(m.name, metricSystem),
        current: last ? last.v : null,
        start: first ? first.v : null,
        hasData: nums.length > 0,
      };
    });
    setRows(list);
    setLoading(false);
  };

  const isCustom = (r) => !(defaultIds.has(r.id) || DEFAULT_NAME_SET.has((r.name || '').toLowerCase()));
  const goalFor = (r) => (editMode ? draftGoals[r.id] : r.goal);
  const hasGoal = (r) => { const g = goalFor(r); return g != null && g !== ''; };

  const enterEdit = () => {
    const seed = {};
    rows.forEach(r => { seed[r.id] = r.goal; });
    setDraftGoals(seed);
    setEditMode(true);
  };

  const setGoal = (id, val) => setDraftGoals(prev => ({ ...prev, [id]: val === '' ? '' : Number(val) }));
  const stepGoal = (id, delta) => setDraftGoals(prev => ({ ...prev, [id]: Math.max(0, Math.round(((Number(prev[id]) || 0) + delta) * 10) / 10) }));
  const removeGoal = (id) => setDraftGoals(prev => ({ ...prev, [id]: null }));
  const addGoals = (ids) => setDraftGoals(prev => {
    const next = { ...prev };
    ids.forEach(id => { const r = rows.find(x => x.id === id); next[id] = r?.current != null ? Math.round(r.current * 10) / 10 : 0; });
    return next;
  });

  const save = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) { setSaving(false); return; }
    // Persist only the goals that actually changed.
    for (const r of rows) {
      const d = draftGoals[r.id];
      const dv = (d === '' || d == null) ? null : Number(d);
      const orig = r.goal == null ? null : Number(r.goal);
      if (dv !== orig) {
        await supabase.from('measurements').update({ goal: dv }).eq('id', r.id).eq('user_id', uid);
      }
    }
    setEditMode(false);
    setSaving(false);
    await load();
  };

  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>Loading…</p>;

  // Any measurement can have a goal, even one with no entries yet (its card just shows
  // "—" for current until data is logged).
  const goalRows = rows.filter(r => hasGoal(r));
  const addable = rows.filter(r => !hasGoal(r));

  const stepBtn = {
    width: 26, height: 26, borderRadius: 8, border: '1.5px solid var(--accent)', background: 'var(--card)',
    color: 'var(--accent)', cursor: 'pointer', fontSize: 18, fontWeight: 700, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };

  return (
    <>
      <p className="section-title" style={{ margin: '4px 4px 8px' }}>Body Composition Goals</p>

      {goalRows.length === 0 && (
        <div className="card-flat" style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          {editMode ? 'Tap “Add Measurement Goal” to set your first goal.' : 'No body goals yet — tap Edit Body Goals to add one.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {goalRows.map(r => {
          const goal = Number(goalFor(r));
          const prog = progressOf(r.start, r.current, goal);
          const toGo = r.current != null ? Math.abs(goal - r.current) : null;
          // Direction: green while progressing toward the goal; red if the latest value
          // has moved away from the goal (opposite side of where we started).
          const movingAway = r.start != null && r.current != null
            && Math.sign(r.current - r.start) !== 0 && Math.sign(goal - r.start) !== 0
            && Math.sign(r.current - r.start) !== Math.sign(goal - r.start);
          const barColor = movingAway ? BAD : GOOD;
          return (
            <div key={r.id} className="card-flat">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{r.name}</span>
                {isCustom(r) && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: 8 }}>Custom</span>
                )}
                {editMode && (
                  <button onClick={() => removeGoal(r.id)} aria-label="Remove goal"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{fmt(r.current)}<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 2 }}>{r.unit}</span></div>
                </div>
                {/* small centered divider, not edge-to-edge */}
                <div style={{ width: 1, height: 34, background: 'var(--border)', flexShrink: 0, margin: '0 14px' }} />
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Goal</div>
                  {editMode ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
                      <button style={stepBtn} onClick={() => stepGoal(r.id, -1)}>−</button>
                      <span style={{ display: 'inline-flex', alignItems: 'baseline' }}>
                        <input type="number" inputMode="decimal" value={draftGoals[r.id] ?? ''} onChange={e => setGoal(r.id, e.target.value)}
                          style={{ width: 70, textAlign: 'center', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', border: 'none', borderBottom: '2px solid var(--accent)', background: 'transparent', outline: 'none', padding: '0 0 2px' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 2 }}>{r.unit}</span>
                      </span>
                      <button style={stepBtn} onClick={() => stepGoal(r.id, 1)}>+</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>{fmt(goal)}<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 2 }}>{r.unit}</span></div>
                  )}
                </div>
              </div>

              <div style={{ height: 7, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginTop: 12 }}>
                <div style={{ width: `${prog * 100}%`, height: '100%', borderRadius: 4, background: barColor, transition: 'width 0.4s ease, background 0.3s ease' }} />
              </div>
              {toGo != null && (
                <div style={{ fontSize: 12, color: movingAway ? BAD : 'var(--text-muted)', marginTop: 8, fontWeight: movingAway ? 600 : 400 }}>
                  {movingAway ? `Moving away — ${fmt(toGo)} ${r.unit} from goal` : `${fmt(toGo)} ${r.unit} to go`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Measurement Goal (edit mode only) */}
      {editMode && (
        <button onClick={() => setShowAdd(true)}
          style={{ width: '100%', marginTop: 12, padding: '13px', background: 'transparent', border: '1.5px solid var(--accent)', borderRadius: 12, color: 'var(--accent)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          + Add Measurement Goal
        </button>
      )}

      {/* Fixed Edit / Save */}
      <div style={{ position: 'fixed', bottom: 82, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: 448, zIndex: 100 }}>
        {editMode ? (
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Body Goals'}</button>
        ) : (
          <button onClick={enterEdit} className="btn-primary">Edit Body Goals</button>
        )}
      </div>

      {showAdd && (
        <AddGoalSheet
          items={addable.map(r => ({ id: r.id, name: r.name, custom: isCustom(r) }))}
          onClose={() => setShowAdd(false)}
          onAdd={(ids) => { addGoals(ids); setShowAdd(false); }}
        />
      )}
    </>
  );
}

// ─── ADD GOAL BOTTOM SHEET ───────────────────────────────────
// Lists every measurement that doesn't have a goal yet (data or not); check any to add
// (no search — there aren't many). Custom measurements keep their badge. Swipe the
// handle/title down to dismiss.
function AddGoalSheet({ items, onClose, onAdd }) {
  const [shown, setShown] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const startRef = useRef(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const onDown = (e) => { startRef.current = e.clientY; setDragging(true); try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {} };
  const onMove = (e) => { if (dragging) setDragY(Math.max(0, e.clientY - startRef.current)); };
  const onUp = () => {
    setDragging(false);
    if (dragY > 100) { setClosing(true); setTimeout(onClose, 280); }   // dismissed
    else setDragY(0);                                                  // snap back
  };

  const sheetTransform = (closing || !shown) ? 'translateY(100%)' : `translateY(${dragY}px)`;

  return createPortal(
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', opacity: (shown && !closing) ? 1 : 0, transition: 'opacity 0.28s ease', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, background: 'var(--card)', borderRadius: '20px 20px 0 0', transform: sheetTransform, transition: dragging ? 'none' : 'transform 0.32s cubic-bezier(0.32,0.72,0,1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', padding: '10px 20px 28px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        {/* Drag handle + title = the grab region for swipe-to-dismiss */}
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ cursor: 'grab', touchAction: 'none', paddingBottom: 2 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 14px' }}>Add Measurement Goal</p>
        </div>

        {items.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '20px 0' }}>Every measurement already has a goal.</p>
        ) : (
          <div style={{ overflowY: 'auto', marginBottom: 14 }}>
            {items.map(it => {
              const on = selected.has(it.id);
              return (
                <div key={it.id} onClick={() => toggle(it.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 4px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{it.name}</span>
                  {it.custom && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: 8 }}>Custom</span>
                  )}
                  <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {on && <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={() => onAdd([...selected])} disabled={selected.size === 0} className="btn-primary" style={{ opacity: selected.size ? 1 : 0.5 }}>
          {selected.size ? `Add ${selected.size} goal${selected.size > 1 ? 's' : ''}` : 'Add'}
        </button>
      </div>
    </div>,
    document.body
  );
}
