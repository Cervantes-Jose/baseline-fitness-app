import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const DEFAULTS = { calorie_goal: 2000, protein_goal: 180, carbs_goal: 200, fats_goal: 60 };

const MACROS = [
  { label: 'Protein', goalKey: 'protein_goal', mKey: 'protein', factor: 4 },
  { label: 'Carbs',   goalKey: 'carbs_goal',   mKey: 'carbs',   factor: 4 },
  { label: 'Fats',    goalKey: 'fats_goal',    mKey: 'fats',    factor: 9 },
];

function Goals({ onGoalsUpdate = () => {} }) {
  const [draft, setDraft] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [rowId, setRowId] = useState(null);

  const [calInputMode, setCalInputMode] = useState(false);
  const [calInputValue, setCalInputValue] = useState('');

  const [showMacroModal, setShowMacroModal] = useState(false);
  const [modal, setModal] = useState({
    proteinG: '0', proteinP: '0',
    carbsG:   '0', carbsP:   '0',
    fatsG:    '0', fatsP:    '0',
  });

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    const { data, error } = await supabase
      .from('user_goals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) { console.error(error); setLoading(false); return; }
    if (data && data.length > 0) {
      const row = data[0];
      const loaded = {
        calorie_goal: row.calorie_goal ?? DEFAULTS.calorie_goal,
        protein_goal: row.protein_goal ?? DEFAULTS.protein_goal,
        carbs_goal:   row.carbs_goal   ?? DEFAULTS.carbs_goal,
        fats_goal:    row.fats_goal    ?? DEFAULTS.fats_goal,
      };
      setDraft(loaded);
      setRowId(row.id);
    }
    setLoading(false);
  };

  const saveGoals = async () => {
    setSaving(true);
    const payload = {
      calorie_goal: draft.calorie_goal,
      protein_goal: draft.protein_goal,
      carbs_goal:   draft.carbs_goal,
      fats_goal:    draft.fats_goal,
    };
    let error;
    if (rowId) {
      ({ error } = await supabase.from('user_goals').update(payload).eq('id', rowId));
    } else {
      const { data, error: insertError } = await supabase
        .from('user_goals').insert([payload]).select().single();
      error = insertError;
      if (data) setRowId(data.id);
    }
    if (error) { console.error(error); setSaving(false); return; }
    onGoalsUpdate(draft);
    setEditMode(false);
    setCalInputMode(false);
    setSaving(false);
  };

  const adjustCalorie = (delta) => {
    setDraft(prev => ({
      ...prev,
      calorie_goal: Math.min(10000, Math.max(500, prev.calorie_goal + delta)),
    }));
  };

  const commitCalInput = () => {
    const v = Number(calInputValue);
    if (v >= 500 && v <= 10000) {
      setDraft(prev => ({ ...prev, calorie_goal: Math.round(v) }));
    }
    setCalInputMode(false);
  };

  const openMacroModal = () => {
    const toP = (g, factor) => draft.calorie_goal > 0
      ? ((g * factor / draft.calorie_goal) * 100).toFixed(1)
      : '0';
    setModal({
      proteinG: String(draft.protein_goal),
      proteinP: toP(draft.protein_goal, 4),
      carbsG:   String(draft.carbs_goal),
      carbsP:   toP(draft.carbs_goal, 4),
      fatsG:    String(draft.fats_goal),
      fatsP:    toP(draft.fats_goal, 9),
    });
    setShowMacroModal(true);
  };

  const updateMacroGrams = (mKey, g, factor) => {
    const p = draft.calorie_goal > 0
      ? ((Number(g) || 0) * factor / draft.calorie_goal * 100).toFixed(1)
      : '0';
    setModal(prev => ({ ...prev, [`${mKey}G`]: g, [`${mKey}P`]: p }));
  };

  const updateMacroPct = (mKey, p, factor) => {
    const g = Math.round((Number(p) || 0) * draft.calorie_goal / factor / 100);
    setModal(prev => ({ ...prev, [`${mKey}P`]: p, [`${mKey}G`]: String(isNaN(g) ? 0 : g) }));
  };

  const applyMacros = () => {
    setDraft(prev => ({
      ...prev,
      protein_goal: Number(modal.proteinG) || 0,
      carbs_goal:   Number(modal.carbsG)   || 0,
      fats_goal:    Number(modal.fatsG)    || 0,
    }));
    setShowMacroModal(false);
  };

  const macroPct = (g, factor) =>
    draft.calorie_goal > 0 ? Math.round((g * factor / draft.calorie_goal) * 100) : 0;

  const modalTotalCal =
    (Number(modal.proteinG) || 0) * 4 +
    (Number(modal.carbsG)   || 0) * 4 +
    (Number(modal.fatsG)    || 0) * 9;
  const calDiff = modalTotalCal - draft.calorie_goal;

  if (loading) return (
    <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>Loading...</p>
  );

  const btnStyle = {
    width: '52px', height: '52px', borderRadius: '14px',
    background: 'var(--accent-light)', border: 'none', cursor: 'pointer',
    color: 'var(--accent)', fontSize: '28px', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };

  return (
    <div className="content" style={{ paddingBottom: '120px' }}>

      {/* Calorie Goal card */}
      <div className="card">
        <p className="section-title">Calorie Goal</p>
        {editMode ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', gap: '12px' }}>
            <button style={btnStyle} onClick={() => adjustCalorie(-50)}>−</button>

            {calInputMode ? (
              <input
                type="number"
                inputMode="numeric"
                value={calInputValue}
                autoFocus
                onChange={e => setCalInputValue(e.target.value)}
                onBlur={commitCalInput}
                onKeyDown={e => e.key === 'Enter' && commitCalInput()}
                style={{
                  flex: 1, textAlign: 'center', fontSize: '40px', fontWeight: '700',
                  border: '2px solid var(--accent)', borderRadius: '12px',
                  background: 'var(--bg)', color: 'var(--text-primary)',
                  padding: '8px 4px', outline: 'none',
                }}
              />
            ) : (
              <div
                onClick={() => { setCalInputValue(String(draft.calorie_goal)); setCalInputMode(true); }}
                style={{ flex: 1, textAlign: 'center', cursor: 'text' }}
              >
                <div style={{ fontSize: '40px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1 }}>
                  {draft.calorie_goal.toLocaleString()}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>kcal / day</div>
              </div>
            )}

            <button style={btnStyle} onClick={() => adjustCalorie(+50)}>+</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
            <div style={{ fontSize: '48px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1 }}>
              {draft.calorie_goal.toLocaleString()}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>kcal / day</div>
          </div>
        )}
      </div>

      {/* Macronutrient card */}
      <div
        className="card"
        onClick={editMode ? openMacroModal : undefined}
        style={{ cursor: editMode ? 'pointer' : 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <p className="section-title" style={{ marginBottom: 0 }}>Macronutrients</p>
          {editMode && (
            <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '600' }}>Tap to edit</span>
          )}
        </div>

        {MACROS.map(({ label, goalKey, factor }) => {
          const g = draft[goalKey];
          const p = macroPct(g, factor);
          return (
            <div key={label} style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginRight: '12px' }}>{g}g</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent)', minWidth: '36px', textAlign: 'right' }}>{p}%</span>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '3px', background: 'var(--accent)', width: `${Math.min(p, 100)}%`, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Fixed Edit / Save button */}
      <div style={{
        position: 'fixed', bottom: '82px', left: '50%', transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)', maxWidth: '448px', zIndex: 100,
      }}>
        {editMode ? (
          <button onClick={saveGoals} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Goals'}
          </button>
        ) : (
          <button onClick={() => setEditMode(true)} className="btn-primary">
            Edit Goals
          </button>
        )}
      </div>

      {/* Macro Modal */}
      {showMacroModal && (
        <>
          <div onClick={() => setShowMacroModal(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500,
          }} />
          <div style={{
            position: 'fixed', bottom: 0, left: '50%', width: '100%', maxWidth: '480px',
            zIndex: 600, background: 'var(--card)', borderRadius: '24px 24px 0 0',
            transform: 'translateX(-50%)', padding: '24px 20px 40px',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
          }}>
            <p className="section-title" style={{ marginBottom: '20px' }}>Edit Macros</p>

            {MACROS.map(({ label, mKey, factor }) => (
              <div key={mKey} style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>{label}</p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={modal[`${mKey}G`]}
                      onChange={e => updateMacroGrams(mKey, e.target.value, factor)}
                      className="input"
                      style={{ textAlign: 'center' }}
                    />
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>grams</p>
                  </div>
                  <div style={{ paddingTop: '14px', color: 'var(--text-muted)', fontSize: '16px', flexShrink: 0 }}>=</div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={modal[`${mKey}P`]}
                      onChange={e => updateMacroPct(mKey, e.target.value, factor)}
                      className="input"
                      style={{ textAlign: 'center' }}
                    />
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>%</p>
                  </div>
                </div>
              </div>
            ))}

            <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--bg)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total from macros</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{modalTotalCal} kcal</span>
              </div>
              {calDiff > 50 && (
                <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '6px' }}>
                  Exceeds calorie goal by {calDiff} kcal
                </p>
              )}
              {calDiff < -200 && (
                <p style={{ fontSize: '12px', color: '#F59E0B', marginTop: '6px' }}>
                  Under calorie goal by {Math.abs(calDiff)} kcal
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowMacroModal(false)} className="btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={applyMacros} className="btn-primary" style={{ flex: 2 }}>
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Goals;
