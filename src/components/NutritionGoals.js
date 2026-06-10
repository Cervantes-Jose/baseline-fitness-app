import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { MACROS } from './macroColors';

const DEFAULTS = { calorie_goal: 2000, protein_goal: 180, carbs_goal: 200, fats_goal: 60 };

// How far the macros' implied calories may drift from the calorie goal before we flag
// the math as "not adding up" (calories-anchored model). Scales with the goal — 5% or
// 100 kcal, whichever is larger — so a normal split isn't flagged but a gross mismatch
// (e.g. 500g protein on a 100 kcal goal) is.
const calToleranceFor = (goal) => Math.max(100, Math.round(goal * 0.05));

// ─── NUTRITION GOALS TAB ─────────────────────────────────────
// View mode: calorie goal + macro tiles showing today's consumed/total (Dashboard
// style, minus the progress circle). Edit mode: calorie ± / manual entry, and a
// focus-to-expand macro editor where the active macro's grams + % enlarge and the
// other two shrink. Grams ⇄ % stay in sync; math turns red when it doesn't balance.
export default function NutritionGoals({ onGoalsUpdate = () => {} }) {
  const [draft, setDraft] = useState(DEFAULTS);
  const [consumed, setConsumed] = useState({ protein: 0, carbs: 0, fats: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [rowId, setRowId] = useState(null);

  const [calInputMode, setCalInputMode] = useState(false);
  const [calInputValue, setCalInputValue] = useState('');

  // Grams + percent kept as strings so typing partial values feels natural; both stay
  // in sync as the user edits either.
  const [macroDraft, setMacroDraft] = useState({
    proteinG: '0', proteinP: '0', carbsG: '0', carbsP: '0', fatsG: '0', fatsP: '0',
  });

  useEffect(() => { loadGoals(); loadConsumed(); }, []);

  const loadGoals = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('user_goals').select('*').eq('user_id', uid)
      .order('created_at', { ascending: false }).limit(1);
    if (error) { console.error(error); setLoading(false); return; }
    if (data && data.length > 0) {
      const row = data[0];
      setDraft({
        calorie_goal: row.calorie_goal ?? DEFAULTS.calorie_goal,
        protein_goal: row.protein_goal ?? DEFAULTS.protein_goal,
        carbs_goal:   row.carbs_goal   ?? DEFAULTS.carbs_goal,
        fats_goal:    row.fats_goal    ?? DEFAULTS.fats_goal,
      });
      setRowId(row.id);
    }
    setLoading(false);
  };

  // Today's logged macros, so the view-mode tiles can show consumed / total.
  const loadConsumed = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const today = new Date().toLocaleDateString();
    const { data: food } = await supabase
      .from('food_entries').select('protein, carbs, fats')
      .eq('user_id', uid).eq('date', today);
    if (food) {
      setConsumed({
        protein: Math.round(food.reduce((s, f) => s + Number(f.protein || 0), 0)),
        carbs:   Math.round(food.reduce((s, f) => s + Number(f.carbs   || 0), 0)),
        fats:    Math.round(food.reduce((s, f) => s + Number(f.fats    || 0), 0)),
      });
    }
  };

  const seedMacroDraft = (d) => {
    const toP = (g, factor) => d.calorie_goal > 0 ? String(Math.round(g * factor / d.calorie_goal * 100)) : '0';
    setMacroDraft({
      proteinG: String(d.protein_goal), proteinP: toP(d.protein_goal, 4),
      carbsG:   String(d.carbs_goal),   carbsP:   toP(d.carbs_goal, 4),
      fatsG:    String(d.fats_goal),    fatsP:    toP(d.fats_goal, 9),
    });
  };

  const enterEdit = () => { seedMacroDraft(draft); setEditMode(true); };

  const saveGoals = async () => {
    setSaving(true);
    const next = {
      ...draft,
      protein_goal: Number(macroDraft.proteinG) || 0,
      carbs_goal:   Number(macroDraft.carbsG)   || 0,
      fats_goal:    Number(macroDraft.fatsG)    || 0,
    };
    const payload = {
      calorie_goal: next.calorie_goal, protein_goal: next.protein_goal,
      carbs_goal: next.carbs_goal, fats_goal: next.fats_goal,
    };
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) { setSaving(false); return; }
    let error;
    if (rowId) {
      ({ error } = await supabase.from('user_goals').update(payload).eq('id', rowId).eq('user_id', uid));
    } else {
      const { data, error: insErr } = await supabase
        .from('user_goals').insert([{ ...payload, user_id: uid }]).select().single();
      error = insErr;
      if (data) setRowId(data.id);
    }
    if (error) { console.error(error); setSaving(false); return; }
    setDraft(next);
    onGoalsUpdate(next);
    setEditMode(false);
    setCalInputMode(false);
    setSaving(false);
  };

  const adjustCalorie = (delta) =>
    setDraft(prev => ({ ...prev, calorie_goal: Math.min(10000, Math.max(500, prev.calorie_goal + delta)) }));

  const commitCalInput = () => {
    const v = Number(calInputValue);
    if (v >= 500 && v <= 10000) setDraft(prev => ({ ...prev, calorie_goal: Math.round(v) }));
    setCalInputMode(false);
  };

  // Grams ⇄ percent two-way sync (calories-anchored: % is the macro's share of the
  // calorie goal, grams derive from it and vice-versa).
  const setGrams = (m, val) => {
    const g = val === '' ? '' : String(Math.max(0, Math.round(Number(val) || 0)));
    const p = draft.calorie_goal > 0 ? String(Math.round((Number(g) || 0) * m.factor / draft.calorie_goal * 100)) : '0';
    setMacroDraft(prev => ({ ...prev, [`${m.key}G`]: g, [`${m.key}P`]: p }));
  };
  const setPct = (m, val) => {
    const p = val === '' ? '' : String(Math.max(0, Math.round(Number(val) || 0)));
    const g = draft.calorie_goal > 0 ? String(Math.round((Number(p) || 0) * draft.calorie_goal / m.factor / 100)) : '0';
    setMacroDraft(prev => ({ ...prev, [`${m.key}P`]: p, [`${m.key}G`]: g }));
  };

  // ─── Math check ───
  const impliedCal =
    (Number(macroDraft.proteinG) || 0) * 4 +
    (Number(macroDraft.carbsG)   || 0) * 4 +
    (Number(macroDraft.fatsG)    || 0) * 9;
  const calDiff = impliedCal - draft.calorie_goal;
  const mathOff = editMode && Math.abs(calDiff) > calToleranceFor(draft.calorie_goal);

  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>Loading…</p>;

  const calBtn = {
    width: 52, height: 52, borderRadius: 14, background: 'var(--accent-light)', border: 'none',
    cursor: 'pointer', color: 'var(--accent)', fontSize: 28, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };

  return (
    <>
      {/* Daily Calories — label sits outside the tile */}
      <div>
        <p className="section-title" style={{ margin: '0 4px 8px' }}>Daily Calories</p>
        <div className="card">
          {editMode ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <button style={calBtn} onClick={() => adjustCalorie(-50)}>−</button>
              {calInputMode ? (
                <input type="number" inputMode="numeric" value={calInputValue} autoFocus
                  onChange={e => setCalInputValue(e.target.value)} onBlur={commitCalInput}
                  onKeyDown={e => e.key === 'Enter' && commitCalInput()}
                  style={{ flex: 1, textAlign: 'center', fontSize: 38, fontWeight: 700, border: '2px solid var(--accent)', borderRadius: 12, background: 'var(--bg)', color: 'var(--text-primary)', padding: '8px 4px', outline: 'none' }} />
              ) : (
                <div onClick={() => { setCalInputValue(String(draft.calorie_goal)); setCalInputMode(true); }} style={{ flex: 1, textAlign: 'center', cursor: 'text' }}>
                  <div style={{ fontSize: 38, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1 }}>{draft.calorie_goal.toLocaleString()}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>kcal / day</div>
                </div>
              )}
              <button style={calBtn} onClick={() => adjustCalorie(50)}>+</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 46, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1 }}>{draft.calorie_goal.toLocaleString()}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>kcal / day</div>
            </div>
          )}
        </div>
      </div>

      {/* Macronutrients — label outside; all three share one tile */}
      <div>
        <p className="section-title" style={{ margin: '0 4px 8px' }}>Macronutrients</p>
        <div className="card" style={{ padding: '2px 16px' }}>
          {MACROS.map((m, i) => {
            const c = consumed[m.key];
            const gStr = macroDraft[`${m.key}G`];
            const pStr = macroDraft[`${m.key}P`];
            const goalG = draft[m.goalKey];
            const numColor = mathOff ? '#EF4444' : m.color;
            // Bar = today's consumed share of the goal (live goal while editing).
            const curGoal = editMode ? (Number(gStr) || 0) : goalG;
            const barPct = curGoal > 0 ? Math.min(c / curGoal * 100, 100) : 0;
            // Inline editable number — same size as the static text, just made editable.
            const editNum = (w) => ({ width: w, textAlign: 'center', fontSize: 13, fontWeight: 700, color: numColor, border: 'none', borderBottom: `1.5px solid ${numColor}`, background: 'transparent', outline: 'none', padding: '0 0 1px' });

            return (
              <div key={m.key}>
                <div style={{ padding: '14px 0' }}>
                  {/* Name */}
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{m.label}</div>

                  {/* Measurement line — the % aligns here with the macro total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                    {editMode ? (
                      <>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          {c}g /{' '}
                          <input type="number" inputMode="numeric" value={gStr} onChange={e => setGrams(m, e.target.value)} style={editNum(44)} />
                          <span style={{ color: numColor, fontWeight: 700 }}>g</span>
                        </span>
                        <span style={{ fontSize: 13 }}>
                          <input type="number" inputMode="numeric" value={pStr} onChange={e => setPct(m, e.target.value)} style={editNum(34)} />
                          <span style={{ color: numColor, fontWeight: 700 }}>%</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c}g / {goalG}g</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{goalG > 0 ? Math.round(c / goalG * 100) : 0}%</span>
                      </>
                    )}
                  </div>

                  {/* Bar — track is var(--border) so the empty state stays visible */}
                  <div style={{ height: 7, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginTop: 12 }}>
                    <div style={{ width: `${barPct}%`, height: '100%', borderRadius: 4, background: numColor, transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                {/* Inset divider between macros */}
                {i < MACROS.length - 1 && <div style={{ height: 1, background: 'var(--border)' }} />}
              </div>
            );
          })}
        </div>

        {/* Math check */}
        {editMode && (
          <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: mathOff ? '#FEE2E2' : 'var(--bg)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: mathOff ? '#B91C1C' : 'var(--text-secondary)', fontWeight: mathOff ? 700 : 500 }}>Calories from macros</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: mathOff ? '#B91C1C' : 'var(--text-primary)' }}>{impliedCal} kcal</span>
            </div>
            {mathOff && (
              <p style={{ fontSize: 12, color: '#B91C1C', marginTop: 6 }}>
                {calDiff > 0 ? `That's ${calDiff} kcal over` : `That's ${Math.abs(calDiff)} kcal under`} your {draft.calorie_goal.toLocaleString()} kcal goal — adjust the macros so they add up.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Fixed Edit / Save */}
      <div style={{ position: 'fixed', bottom: 82, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: 448, zIndex: 100 }}>
        {editMode ? (
          <button onClick={saveGoals} disabled={saving || mathOff} className="btn-primary" style={{ opacity: mathOff ? 0.5 : 1 }}>
            {saving ? 'Saving…' : mathOff ? 'Macros don’t add up' : 'Save Nutrition Goals'}
          </button>
        ) : (
          <button onClick={enterEdit} className="btn-primary">Edit Nutrition Goals</button>
        )}
      </div>
    </>
  );
}
