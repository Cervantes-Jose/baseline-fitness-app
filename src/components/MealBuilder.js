import React, { useState } from 'react';
import { sumMealComponents } from './foodMath';

// Meal builder page. Controlled by FoodLog: the meal `draft` (name, components,
// servings) lives in the parent so foods picked from the Add Food sheet can be
// appended into `draft.components` while this page stays mounted underneath.
//
// draft shape: { id|null, name, components: [ { food:{name,brandOwner}, serving, unit,
//   grams, calories, protein, carbs, fats, micros:[{name,value,unit}] } ], servings: string }
function MealBuilder({ draft, onChange, onAddFood, onEditComponent, onSave, onClose, onDelete }) {
  // Local buffer for the serving-size field so typing stays smooth (the displayed
  // value is otherwise derived from total ÷ servings, which would fight the cursor).
  const [sizeFocused, setSizeFocused] = useState(false);
  const [sizeText, setSizeText] = useState('');
  const [microsOpen, setMicrosOpen] = useState(false);  // collapsed by default

  const totals = sumMealComponents(draft.components);
  const total = totals.grams;
  const servingsNum = Number(draft.servings) > 0 ? Number(draft.servings) : 1;
  const perServingSize = total > 0 ? Math.round(total / servingsNum) : 0;

  const per = (v) => Math.round((Number(v) || 0) / servingsNum);

  const setServings = (val) => onChange({ ...draft, servings: val });
  const onServingSizeChange = (val) => {
    setSizeText(val);
    const g = Number(val);
    if (g > 0 && total > 0) setServings(String(Math.round((total / g) * 100) / 100));
  };

  const removeComponent = (idx) =>
    onChange({ ...draft, components: draft.components.filter((_, i) => i !== idx) });

  const tiles = [
    { label: 'Calories', value: per(totals.calories), unit: 'kcal', color: '#3B82F6' },
    { label: 'Protein', value: per(totals.protein), unit: 'g', color: '#22C55E' },
    { label: 'Fat', value: per(totals.fats), unit: 'g', color: '#3B82F6' },
    { label: 'Carbs', value: per(totals.carbs), unit: 'g', color: '#EAB308' },
  ];

  const canSave = draft.name.trim().length > 0 && draft.components.length > 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 360, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 8px', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back
        </button>
        {onDelete && (
          <button onClick={onDelete} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0 }}>
            Delete
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 20px 20px' }}>
        {/* Name — underline input matching the custom-food editor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 8px' }}>
          <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: '8px', flexShrink: 0 }}>Meal</span>
        </div>
        <div style={{ margin: '0 0 16px' }}>
          <input value={draft.name} placeholder="Meal name" onChange={e => onChange({ ...draft, name: e.target.value })}
            style={{ width: '100%', fontWeight: '700', fontSize: '22px', color: 'var(--text-primary)', lineHeight: 1.2, border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', outline: 'none', padding: '2px 0' }} />
        </div>

        {/* One tile — per-serving macros + total weight / serving size / servings,
            matching the food detail screen's single-card layout. */}
        <div className="card-flat" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {tiles.map(m => (
              <div key={m.label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: m.color }}>{m.label}</div>
                <div style={{ marginTop: '4px', lineHeight: 1.1 }}>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>{m.value}</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginLeft: '2px' }}>{m.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right', margin: '6px 0 0' }}>per serving</p>

          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Total weight</span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {total}<span style={{ fontSize: '0.8em', fontWeight: '600', color: 'var(--text-muted)', marginLeft: '2px' }}>g</span>
            </span>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Serving Size</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <input type="number" inputMode="decimal"
                value={sizeFocused ? sizeText : (perServingSize || '')}
                onFocus={() => { setSizeFocused(true); setSizeText(String(perServingSize || '')); }}
                onBlur={() => setSizeFocused(false)}
                onChange={e => onServingSizeChange(e.target.value)}
                style={{ width: '64px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', textAlign: 'center', outline: 'none' }} />
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>g</span>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Number of servings</span>
            <input type="number" inputMode="decimal" value={draft.servings} onChange={e => setServings(e.target.value)}
              style={{ width: '64px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', textAlign: 'center', outline: 'none' }} />
          </div>
        </div>

        {/* Micronutrients — collapsible (default collapsed), shown per serving. */}
        {totals.micros.length > 0 && (
          <div className="card-flat" style={{ marginBottom: '12px' }}>
            <button onClick={() => setMicrosOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              <p className="section-title" style={{ margin: 0, color: 'var(--text-primary)', fontWeight: '700' }}>Micronutrients</p>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"
                style={{ transform: microsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)' }}>
                <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {microsOpen && (
              <div style={{ marginTop: '8px' }}>
                {totals.micros.map((m, i) => (
                  <div key={m.name + i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < totals.micros.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{m.name}</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{Math.round((Number(m.value) / servingsNum) * 10) / 10}{m.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add Food */}
        <button onClick={onAddFood}
          style={{ width: '100%', background: 'transparent', border: '1px solid var(--accent)', borderRadius: '12px', color: 'var(--accent)', cursor: 'pointer', fontSize: '15px', fontWeight: '700', padding: '14px 0', marginBottom: '14px' }}>
          + Add Food
        </button>

        {/* Component list */}
        {draft.components.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
            No foods yet — tap “Add Food” to build your meal.
          </p>
        ) : (
          draft.components.map((c, i) => {
            // Components saved with a `source` can be re-opened in the detail screen and
            // re-edited; older ones are tap-to-remove only.
            const editable = !!c.source && onEditComponent;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div onClick={editable ? () => onEditComponent(i) : undefined}
                  style={{ flex: 1, minWidth: 0, cursor: editable ? 'pointer' : 'default' }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{c.food.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {c.grams}g · {c.calories} cal · {c.protein}g P · {c.carbs}g C · {c.fats}g F
                  </div>
                </div>
                {editable && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                <button onClick={() => removeComponent(i)} aria-label="Remove food"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1, padding: '4px 6px', flexShrink: 0 }}>×</button>
              </div>
            );
          })
        )}
      </div>

      {/* Save */}
      <div style={{ padding: '12px 20px 32px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onSave} disabled={!canSave}
          style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', fontSize: '16px', fontWeight: '700',
            background: canSave ? 'var(--accent)' : 'var(--border)', color: canSave ? '#fff' : 'var(--text-muted)',
            cursor: canSave ? 'pointer' : 'default' }}>
          {draft.id ? 'Save Changes' : 'Save Meal'}
        </button>
      </div>
    </div>
  );
}

export default MealBuilder;
