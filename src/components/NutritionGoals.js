import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { MACROS } from './macroColors';
import { useNutritionGoals, GOAL_DEFAULTS } from './useNutritionGoals';

// How far the macros' implied calories may drift from the calorie goal before we flag
// the math as "not adding up" (calories-anchored model). Scales with the goal — 3% or
// 50 kcal, whichever is larger. The 50 floor stays comfortably above integer-gram
// rounding noise (a macro split can always land within ~9 kcal of any target), so a
// normal split isn't flagged but a real mismatch (e.g. macros summing to 2100 on a
// 2000 kcal goal) is.
const calToleranceFor = (goal) => Math.max(50, Math.round(goal * 0.03));

// ─── NUTRITION GOALS TAB ─────────────────────────────────────
// View mode: calorie goal + macro tiles showing today's consumed/total (Dashboard
// style, minus the progress circle). Edit mode: calorie ± / manual entry, and a
// focus-to-expand macro editor where the active macro's grams + % enlarge and the
// other two shrink. Grams ⇄ % stay in sync; math turns red when it doesn't balance.
export default function NutritionGoals({ onGoalsUpdate = () => {} }) {
  // The hook owns the canonical user_goals row (load + persist); `draft` is the local
  // editable working copy, seeded from the loaded goals once they arrive.
  const { goals, loading, saveGoals: persistGoals } = useNutritionGoals();
  const [draft, setDraft] = useState(GOAL_DEFAULTS);
  const [consumed, setConsumed] = useState({ protein: 0, carbs: 0, fats: 0 });
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [calInputMode, setCalInputMode] = useState(false);
  const [calInputValue, setCalInputValue] = useState('');

  // Grams + percent kept as strings so typing partial values feels natural; both stay
  // in sync as the user edits either.
  const [macroDraft, setMacroDraft] = useState({
    proteinG: '0', proteinP: '0', carbsG: '0', carbsP: '0', fatsG: '0', fatsP: '0',
  });

  useEffect(() => { loadConsumed(); }, []);

  // Seed the editable draft from the loaded goals once they're in (only while not
  // editing, so a load that resolves mid-edit can't clobber in-progress changes).
  useEffect(() => { if (!loading && !editMode) setDraft(goals); }, [loading, goals]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const { error } = await persistGoals(payload);
    if (error) { setSaving(false); return; }
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

  // ± steppers (grams ±5, percent ±1) read the latest value functionally so fast/held
  // taps keep counting, and keep grams ⇄ percent in sync.
  const stepGrams = (m, delta) => setMacroDraft(prev => {
    const g = Math.max(0, (Number(prev[`${m.key}G`]) || 0) + delta);
    const p = draft.calorie_goal > 0 ? Math.round(g * m.factor / draft.calorie_goal * 100) : 0;
    return { ...prev, [`${m.key}G`]: String(g), [`${m.key}P`]: String(p) };
  });
  const stepPct = (m, delta) => setMacroDraft(prev => {
    const p = Math.max(0, (Number(prev[`${m.key}P`]) || 0) + delta);
    const g = draft.calorie_goal > 0 ? Math.round(p * draft.calorie_goal / m.factor / 100) : 0;
    return { ...prev, [`${m.key}P`]: String(p), [`${m.key}G`]: String(g) };
  });

  // ─── Math check ───
  const impliedCal =
    (Number(macroDraft.proteinG) || 0) * 4 +
    (Number(macroDraft.carbsG)   || 0) * 4 +
    (Number(macroDraft.fatsG)    || 0) * 9;
  const calDiff = impliedCal - draft.calorie_goal;
  const mathOff = editMode && Math.abs(calDiff) > calToleranceFor(draft.calorie_goal);

  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>Loading…</p>;

  // Matches the rest-timer steppers in the routine editor: clear inside, accent border.
  const calStep = {
    width: 38, height: 38, borderRadius: 10, border: '1.5px solid var(--accent)',
    background: 'var(--card)', color: 'var(--accent)', cursor: 'pointer', fontSize: 24,
    fontWeight: 700, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };
  const macroStep = { ...calStep, width: 26, height: 26, borderRadius: 8, fontSize: 18 };

  return (
    <>
      {/* Daily Calories — label sits outside the tile */}
      <div>
        <p className="section-title" style={{ margin: '0 4px 8px', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'none', letterSpacing: 'normal' }}>Daily Calories</p>
        <div className="card">
          {/* Same size in view + edit — edit just adds the ± flanking the number */}
          <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              {editMode && <button style={calStep} onClick={() => adjustCalorie(-50)}>−</button>}
              {editMode && calInputMode ? (
                <input type="number" inputMode="numeric" value={calInputValue} autoFocus
                  onChange={e => setCalInputValue(e.target.value)} onBlur={commitCalInput}
                  onKeyDown={e => e.key === 'Enter' && commitCalInput()}
                  style={{ width: 150, textAlign: 'center', fontSize: 46, fontWeight: 700, border: 'none', borderBottom: '2px solid var(--accent)', background: 'transparent', color: 'var(--text-primary)', letterSpacing: '-1px', padding: 0, outline: 'none' }} />
              ) : (
                <div onClick={editMode ? () => { setCalInputValue(String(draft.calorie_goal)); setCalInputMode(true); } : undefined}
                  style={{ fontSize: 46, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1, cursor: editMode ? 'text' : 'default', borderBottom: editMode ? '2px solid var(--accent)' : 'none', paddingBottom: editMode ? 3 : 0 }}>
                  {draft.calorie_goal.toLocaleString()}
                </div>
              )}
              {editMode && <button style={calStep} onClick={() => adjustCalorie(50)}>+</button>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>kcal / day</div>
          </div>
        </div>
      </div>

      {/* Macronutrients — label outside; all three share one tile */}
      <div>
        <p className="section-title" style={{ margin: '0 4px 8px', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'none', letterSpacing: 'normal' }}>Macronutrients</p>
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
            // Editable number — black text, slightly enlarged, with a blue underline that
            // signals it's editable (both go red when the macro math doesn't add up).
            const editNum = (w) => ({ width: w, textAlign: 'center', fontSize: 18, fontWeight: 800, color: mathOff ? '#EF4444' : 'var(--text-primary)', border: 'none', borderBottom: `2px solid ${mathOff ? '#EF4444' : 'var(--accent)'}`, background: 'transparent', outline: 'none', padding: '0 0 2px' });
            const unitStyle = { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 2 };

            return (
              <div key={m.key}>
                <div style={{ padding: '14px 0' }}>
                  {/* Name */}
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{m.label}</div>

                  {/* Measurement line. View: "consumed / total" + macro-of-calories %.
                      Edit: consumed "0g /" stays put on the left; the editable total + %
                      nudge toward center with ± steppers. */}
                  {!editMode ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c}g / {goalG}g</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{draft.calorie_goal > 0 ? Math.round(goalG * m.factor / draft.calorie_goal * 100) : 0}%</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>{c}g /</span>
                      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 22, alignItems: 'center' }}>
                        {/* grams ±5 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button style={macroStep} onClick={() => stepGrams(m, -5)}>−</button>
                          <span style={{ display: 'inline-flex', alignItems: 'baseline' }}>
                            <input type="number" inputMode="numeric" value={gStr} onChange={e => setGrams(m, e.target.value)} style={editNum(56)} />
                            <span style={unitStyle}>g</span>
                          </span>
                          <button style={macroStep} onClick={() => stepGrams(m, 5)}>+</button>
                        </div>
                        {/* percent ±1 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button style={macroStep} onClick={() => stepPct(m, -1)}>−</button>
                          <span style={{ display: 'inline-flex', alignItems: 'baseline' }}>
                            <input type="number" inputMode="numeric" value={pStr} onChange={e => setPct(m, e.target.value)} style={editNum(44)} />
                            <span style={unitStyle}>%</span>
                          </span>
                          <button style={macroStep} onClick={() => stepPct(m, 1)}>+</button>
                        </div>
                      </div>
                    </div>
                  )}

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
