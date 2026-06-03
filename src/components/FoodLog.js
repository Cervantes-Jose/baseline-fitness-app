// Requires custom_foods table in Supabase:
// create table custom_foods (id uuid default uuid_generate_v4() primary key, name text, calories numeric, protein numeric, carbs numeric, fats numeric, created_at timestamp default now());
// grant select, insert, update, delete on public.custom_foods to anon, authenticated, service_role;
// alter table public.custom_foods enable row level security;
// create policy "Allow all for now" on public.custom_foods for all using (true) with check (true);
// Remembered serving (added later): alter table public.custom_foods add column saved_serving numeric, add column saved_unit text;
// Editable micronutrients (added later): alter table public.custom_foods add column micros jsonb;
//
// Favorites table:
// create table public.favorite_foods (id uuid default gen_random_uuid() primary key, name text not null, is_custom boolean default false, food jsonb not null, created_at timestamptz default now());
// grant select, insert, update, delete on public.favorite_foods to anon, authenticated, service_role;
// alter table public.favorite_foods enable row level security;
// create policy "Allow all for now" on public.favorite_foods for all using (true) with check (true);
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

const FOOD_SEARCH_URL = 'https://xbvncbvoyatxbdhkkifq.supabase.co/functions/v1/food-search';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhidm5jYnZveWF0eGJkaGtraWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTQzNzgsImV4cCI6MjA5NDk3MDM3OH0.rMAoMAlVvaAgfcAM4um750S-ZFXLccVy45OGe2-VHl0';

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 === 0 ? 12 : i % 12;
  const ampm = i < 12 ? 'AM' : 'PM';
  return { label: `${h} ${ampm}`, range: `${h}:00 ${ampm} – ${h}:59 ${ampm}`, value: i };
});

const PLACEHOLDER_FOODS = [
  { name: 'Chicken Breast',  calories: 165, protein: 31, carbs: 0,  fats: 4  },
  { name: 'Brown Rice',      calories: 216, protein: 5,  carbs: 45, fats: 2  },
  { name: 'Whole Eggs',      calories: 155, protein: 13, carbs: 1,  fats: 11 },
  { name: 'Ground Beef 93%', calories: 218, protein: 27, carbs: 0,  fats: 12 },
  { name: 'Sweet Potato',    calories: 103, protein: 2,  carbs: 24, fats: 0  },
  { name: 'Broccoli',        calories: 55,  protein: 4,  carbs: 11, fats: 1  },
  { name: 'Greek Yogurt',    calories: 100, protein: 17, carbs: 6,  fats: 0  },
  { name: 'Oatmeal',         calories: 158, protein: 6,  carbs: 27, fats: 3  },
  { name: 'Salmon',          calories: 208, protein: 20, carbs: 0,  fats: 13 },
  { name: 'Cottage Cheese',  calories: 206, protein: 25, carbs: 6,  fats: 9  },
  { name: 'Banana',          calories: 105, protein: 1,  carbs: 27, fats: 0  },
  { name: 'Almonds',         calories: 164, protein: 6,  carbs: 6,  fats: 14 },
  { name: 'White Rice',      calories: 206, protein: 4,  carbs: 45, fats: 0  },
  { name: 'Turkey Breast',   calories: 135, protein: 30, carbs: 0,  fats: 1  },
  { name: 'Protein Shake',   calories: 150, protein: 25, carbs: 8,  fats: 3  },
];

const FILTER_TABS = ['Add Food', 'Favorites', 'Meals', 'Nutrition'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── CALENDAR MODAL ─────────────────────────────────────────
function CalendarModal({ selected, onSelect, onClose }) {
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstDay = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const todayStr = new Date().toDateString();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, monthIdx, d));

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500, overflow: 'hidden' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: 'var(--card)', borderRadius: '24px 24px 0 0',
        padding: '12px 20px 44px', zIndex: 501,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={() => setMonth(new Date(year, monthIdx - 1, 1))} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 22, padding: '4px 10px', lineHeight: 1,
          }}>‹</button>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            {MONTH_NAMES[monthIdx]} {year}
          </span>
          <button onClick={() => setMonth(new Date(year, monthIdx + 1, 1))} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 22, padding: '4px 10px', lineHeight: 1,
          }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, padding: '2px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const isToday = d.toDateString() === todayStr;
            const isSel = d.toDateString() === selected.toDateString();
            return (
              <button key={i} onClick={() => onSelect(d)} style={{
                aspectRatio: '1', borderRadius: '50%', border: 'none',
                background: isSel ? 'var(--accent)' : isToday ? 'var(--accent-light)' : 'transparent',
                color: isSel ? '#fff' : isToday ? 'var(--accent)' : 'var(--text-primary)',
                fontWeight: isSel || isToday ? 700 : 400,
                fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{d.getDate()}</button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── MACRO CIRCLE TILE ───────────────────────────────────────
function MacroCircle({ value, goal, color, trackColor, label, isCalories }) {
  const size = 80;
  const sw = 7;
  const radius = (size - sw) / 2;
  const circ = 2 * Math.PI * radius;
  const progress = Math.min(goal > 0 ? value / goal : 0, 1);
  const offset = circ - progress * circ;
  const pct = Math.round(progress * 100);

  return (
    <div style={{
      background: 'var(--card)', borderRadius: 16, padding: '12px 10px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      flexShrink: 0, minWidth: 104,
      border: '1px solid var(--border)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={trackColor} strokeWidth={sw} />
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={sw}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, textAlign: 'center' }}>
            {isCalories ? value : `${value}g`}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1 }}>
            /{isCalories ? goal : `${goal}g`}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{pct}%</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── SERVING / MACRO HELPERS ─────────────────────────────────
// Macros on every food object are stored per "base" grams: USDA search results
// use food.servingSize; recent/custom foods have no servingSize so default to 100g.
const UNIT_TO_GRAMS = { g: 1, oz: 28.35, ml: 1, cup: 240, tbsp: 15 };
const SERVING_UNITS = ['g', 'oz', 'ml', 'cup', 'tbsp', 'serving'];

const baseGramsOf = (food) => (Number(food?.servingSize) > 0 ? Number(food.servingSize) : 100);

const servingToGrams = (amount, unit, baseGrams) => {
  const a = Number(amount) || 0;
  if (unit === 'serving') return a * baseGrams;   // 1 serving = the food's base serving size
  return a * (UNIT_TO_GRAMS[unit] ?? 1);
};

const scaleOf = (food, serving, unit) => {
  const base = baseGramsOf(food);
  return base > 0 ? servingToGrams(serving, unit, base) / base : 1;
};

const computeMacros = (food, serving, unit, servings = 1) => {
  const s = scaleOf(food, serving, unit) * (Number(servings) || 0);
  return {
    calories: Math.round((Number(food?.calories) || 0) * s),
    protein: Math.round((Number(food?.protein) || 0) * s),
    carbs: Math.round((Number(food?.carbs) || 0) * s),
    fats: Math.round((Number(food?.fats) || 0) * s),
  };
};

// A food's preferred serving (set via the detail screen); falls back to the USDA
// serving size, else 100g.
const defaultServingOf = (food) => ({
  serving: food?.savedServing != null ? food.savedServing
    : (Number(food?.servingSize) > 0 ? Number(food.servingSize) : 100),
  unit: food?.savedUnit || food?.servingSizeUnit || 'g',
});

// Micronutrients: tolerant parse of common USDA foodNutrients shapes. Values are
// per base serving, so we scale them by the current serving scale. May need
// tuning to match the food-search edge function's exact output shape.
const MACRO_NAME_RE = /protein|carbohydrate|total lipid|\bfat\b|fatty|energy|calorie/i;
const DV_REFERENCE = {
  Fiber: 28, Sugars: 50, Sodium: 2300, Cholesterol: 300, Potassium: 4700,
  Calcium: 1300, Iron: 18, 'Vitamin C': 90, 'Vitamin D': 20, 'Vitamin A': 900,
};
// Editable micronutrient rows for custom foods. Keys match DV_REFERENCE so %DV could
// be derived later; values stored as a `micros` jsonb object on the custom_foods row.
const CUSTOM_MICRO_FIELDS = [
  { key: 'Fiber', label: 'Fiber', unit: 'g' },
  { key: 'Sugars', label: 'Sugar', unit: 'g' },
  { key: 'Sodium', label: 'Sodium', unit: 'mg' },
  { key: 'Cholesterol', label: 'Cholesterol', unit: 'mg' },
  { key: 'Potassium', label: 'Potassium', unit: 'mg' },
  { key: 'Calcium', label: 'Calcium', unit: 'mg' },
  { key: 'Iron', label: 'Iron', unit: 'mg' },
  { key: 'Vitamin A', label: 'Vitamin A', unit: 'mcg' },
  { key: 'Vitamin C', label: 'Vitamin C', unit: 'mg' },
  { key: 'Vitamin D', label: 'Vitamin D', unit: 'mcg' },
];

const cleanNutrientName = (name) => String(name).split(',')[0].trim();
const parseMicros = (food, scale) => {
  const arr = food?.foodNutrients || food?.nutrients || [];
  if (!Array.isArray(arr)) return [];
  return arr
    .map(n => ({
      name: cleanNutrientName(n.nutrientName || n.name || n.nutrient?.name || ''),
      raw: n.value ?? n.amount ?? n.nutrient?.amount,
      unit: String(n.unitName || n.unit || n.nutrient?.unitName || '').toLowerCase(),
    }))
    .filter(n => n.name && n.raw != null && !MACRO_NAME_RE.test(n.name))
    .map(n => {
      const value = Number(n.raw) * scale;
      const ref = DV_REFERENCE[n.name];
      return {
        name: n.name,
        value: Math.round(value * 10) / 10,
        unit: n.unit,
        dv: ref ? Math.round((value / ref) * 100) : null,
      };
    });
};

// Build the serving/unit/snapshot stored on a logged food_entries row so it can be
// reopened in the detail screen and re-scaled. Normalized to grams so custom + USDA foods
// behave uniformly: snapshot.servingSize === stored serving ⇒ scaleOf === 1 ⇒ the stored
// (already-adjusted) macros reproduce exactly, and changing the serving scales them.
const buildLoggedFields = (food, serving, unit, servings, macros) => {
  const count = Number(servings) || 0;
  const grams = Math.round(servingToGrams(serving, unit, baseGramsOf(food)) * count) || 0;
  let nutrients;
  if (food.isCustom && food.micros) {
    nutrients = CUSTOM_MICRO_FIELDS
      .map(m => ({ name: m.label, value: Math.round((Number(food.micros[m.key]) || 0) * count * 10) / 10, unit: m.unit }))
      .filter(n => n.value > 0);
  } else {
    nutrients = parseMicros(food, scaleOf(food, serving, unit) * count).map(n => ({ name: n.name, value: n.value, unit: n.unit }));
  }
  const snapshot = {
    name: food.name,
    brandOwner: food.brandOwner || null,
    calories: macros.calories, protein: macros.protein, carbs: macros.carbs, fats: macros.fats,
    servingSize: grams || 1,
    servingSizeUnit: 'g',
    nutrients,
  };
  return { serving: grams, unit: 'g', food: snapshot };
};

// ─── FOOD DETAIL VIEW ────────────────────────────────────────
function FoodDetailView({ food, serving, unit, servings, onServing, onUnit, onServings, onBack, onAdd, edit, editing, onStartEdit, onEditField, onEditMicro, favorited, onToggleFavorite, hourLabel, entryMode, entryDirty }) {
  const [showAllMicros, setShowAllMicros] = useState(false);
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);

  const isCustom = !!edit;          // a custom food (has editable definition data)
  const editable = isCustom && editing;   // fields are currently shown as inputs
  const count = Number(servings) || 0;

  // Custom foods define macros per serving (held in `edit`, which mirrors the saved
  // values in read mode). When editing, the tiles show that per-serving definition; in
  // read mode they scale by number of servings like any other food detail.
  const perServing = isCustom
    ? { calories: Number(edit.calories) || 0, protein: Number(edit.protein) || 0, carbs: Number(edit.carbs) || 0, fats: Number(edit.fats) || 0 }
    : null;
  const macros = editable
    ? perServing
    : isCustom
      ? {
          calories: Math.round(perServing.calories * count),
          protein: Math.round(perServing.protein * count),
          carbs: Math.round(perServing.carbs * count),
          fats: Math.round(perServing.fats * count),
        }
      : computeMacros(food, serving, unit, count);
  const scale = scaleOf(food, serving, unit) * count;

  const micros = parseMicros(food, scale);
  const shownMicros = showAllMicros ? micros : micros.slice(0, 6);

  const macroCells = [
    { label: 'Calories', key: 'calories', value: macros.calories, unit: 'kcal', color: '#3B82F6' },
    { label: 'Protein', key: 'protein', value: macros.protein, unit: 'g', color: '#22C55E' },
    { label: 'Fat', key: 'fats', value: macros.fats, unit: 'g', color: '#3B82F6' },
    { label: 'Carbs', key: 'carbs', value: macros.carbs, unit: 'g', color: '#EAB308' },
  ];

  // Custom food, read mode: show stored micros (scaled by number of servings), hiding zeros.
  const customMicrosShown = isCustom && !editable
    ? CUSTOM_MICRO_FIELDS
        .map(m => ({ ...m, value: Math.round((Number(edit.micros[m.key]) || 0) * count * 10) / 10 }))
        .filter(m => m.value > 0)
    : [];

  // Switching units keeps the same real amount: convert the serving number to the new unit.
  const changeUnit = (newUnit) => {
    if (newUnit !== unit) {
      const base = baseGramsOf(food);
      const grams = servingToGrams(serving, unit, base);
      const perNew = newUnit === 'serving' ? base : (UNIT_TO_GRAMS[newUnit] ?? 1);
      if (perNew > 0) onServing(String(Math.round((grams / perNew) * 100) / 100));
    }
    onUnit(newUnit);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '15px', fontWeight: '600', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>← Back</button>
          {!editable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {isCustom && (
                <button onClick={onStartEdit} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '15px', fontWeight: '600', padding: '4px 0' }}>Edit</button>
              )}
              <button onClick={onToggleFavorite}
                style={{ background: favorited ? 'var(--accent-light)' : 'var(--accent)', border: 'none', cursor: 'pointer', color: favorited ? 'var(--accent)' : '#fff', fontSize: '13px', fontWeight: '500', lineHeight: 1, padding: '7px 12px', borderRadius: '8px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {favorited ? '★ Remove from Favorites' : '☆ Add to Favorites'}
              </button>
            </div>
          )}
        </div>

        <div style={{ margin: '8px 0 16px' }}>
          {editable ? (
            <input value={edit.name} placeholder="Custom Food" onChange={e => onEditField('name', e.target.value)}
              style={{ width: '100%', fontWeight: '700', fontSize: '22px', color: 'var(--text-primary)', lineHeight: 1.2, border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', outline: 'none', padding: '2px 0' }} />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ fontWeight: '700', fontSize: '22px', color: 'var(--text-primary)', lineHeight: 1.2 }}>{isCustom ? edit.name : food.name}</div>
                {hourLabel && <span style={{ flexShrink: 0, background: 'var(--accent-light)', color: 'var(--accent)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>{hourLabel}</span>}
              </div>
              {!isCustom && food.brandOwner && <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{food.brandOwner}</div>}
            </>
          )}
        </div>

        {/* Macros */}
        <div className="card-flat" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {macroCells.map(m => (
              <div key={m.label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: m.color }}>{m.label}</div>
                {editable ? (
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '2px' }}>
                    <input type="number" inputMode="decimal" value={edit[m.key]} placeholder="0" onChange={e => onEditField(m.key, e.target.value)}
                      style={{ width: '46px', padding: '4px 2px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: '16px', fontWeight: '700', textAlign: 'center', outline: 'none' }} />
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>{m.unit}</span>
                  </div>
                ) : (
                  <div style={{ marginTop: '4px', lineHeight: 1.1 }}>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>{m.value}</span>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginLeft: '2px' }}>{m.unit}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Serving Size</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <input type="number" inputMode="decimal" value={serving} onChange={e => onServing(e.target.value)}
                style={{ width: '64px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', textAlign: 'center', outline: 'none' }} />
              <div style={{ position: 'relative' }}>
                <button onClick={() => setUnitMenuOpen(o => !o)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                  {unit}
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" style={{ transform: unitMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {unitMenuOpen && (
                  <>
                    <div onClick={() => setUnitMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 11, minWidth: '90px' }}>
                      {SERVING_UNITS.map(u => (
                        <button key={u} onClick={() => { changeUnit(u); setUnitMenuOpen(false); }}
                          style={{ display: 'block', width: '100%', padding: '8px 14px', background: u === unit ? 'var(--accent-light)' : 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: u === unit ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {u}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Number of servings</span>
            <input type="number" inputMode="decimal" value={servings} onChange={e => onServings(e.target.value)}
              style={{ width: '64px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', textAlign: 'center', outline: 'none' }} />
          </div>
        </div>

        {/* Micronutrients — editable inputs while editing a custom food; static rows for a
            saved custom food (read mode); parsed values for USDA/recent foods. */}
        {editable ? (
          <div className="card-flat" style={{ marginBottom: '12px' }}>
            <p className="section-title" style={{ marginBottom: '8px' }}>Micronutrients</p>
            {CUSTOM_MICRO_FIELDS.map((m, i) => (
              <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < CUSTOM_MICRO_FIELDS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{m.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="number" inputMode="decimal" value={edit.micros[m.key]} placeholder="0" onChange={e => onEditMicro(m.key, e.target.value)}
                    style={{ width: '64px', padding: '4px 6px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', textAlign: 'right', outline: 'none' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '26px' }}>{m.unit}</span>
                </div>
              </div>
            ))}
          </div>
        ) : isCustom ? (
          customMicrosShown.length > 0 && (
            <div className="card-flat" style={{ marginBottom: '12px' }}>
              <p className="section-title" style={{ marginBottom: '8px' }}>Micronutrients</p>
              {customMicrosShown.map((m, i) => (
                <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < customMicrosShown.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{m.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{m.value}{m.unit}</span>
                </div>
              ))}
            </div>
          )
        ) : micros.length > 0 && (
          <div className="card-flat" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <p className="section-title" style={{ margin: 0 }}>Micronutrients</p>
              {micros.length > 6 && (
                <button onClick={() => setShowAllMicros(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '13px', fontWeight: '600', padding: 0 }}>
                  {showAllMicros ? 'Show Less' : 'View All'}
                </button>
              )}
            </div>
            {shownMicros.map((m, i) => (
              <div key={m.name + i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < shownMicros.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{m.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{m.value}{m.unit}</span>
                  {m.dv != null && <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '34px', textAlign: 'right' }}>{m.dv}%</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky action — when editing a logged entry, stay blank until something changes. */}
      {entryMode ? (
        entryDirty && (
          <div style={{ padding: '12px 20px 32px', borderTop: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
            <button onClick={onAdd} className="btn-primary" style={{ width: '100%' }}>Save</button>
          </div>
        )
      ) : (
        <div style={{ padding: '12px 20px 32px', borderTop: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
          <button onClick={onAdd} className="btn-primary" style={{ width: '100%' }}>{editable ? 'Save Food' : 'Add Food'}</button>
        </div>
      )}
    </div>
  );
}

// ─── FOOD LOG ────────────────────────────────────────────────
function FoodLog({ showToast = () => {}, calorieGoal = 2000, proteinGoal = 180, carbsGoal = 200, fatsGoal = 60 }) {
  const currentHour = new Date().getHours();

  const [date, setDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Add Food');
  const [foods, setFoods] = useState({});
  const [loading, setLoading] = useState(true);

  const [showAddFoodScreen, setShowAddFoodScreen] = useState(false);
  const [addFoodOpen, setAddFoodOpen] = useState(false);   // drives the slide-up / drag transform
  const [addFoodDragY, setAddFoodDragY] = useState(0);
  const addFoodDragStart = useRef(null);
  const [addFoodHour, setAddFoodHour] = useState(currentHour);
  const [hourMenuOpen, setHourMenuOpen] = useState(false);   // hour-picker dropdown in Add Food
  const [searchQuery, setSearchQuery] = useState('');
  const [recentFoodList, setRecentFoodList] = useState([]);

  // Favorited foods (snapshot of each food, keyed by name). Persisted in favorite_foods.
  const [favorites, setFavorites] = useState([]);

  // Barcode scanner (ZXing camera) + Open Food Facts lookup.
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);   // looking up a found barcode
  const [scannerError, setScannerError] = useState('');   // on-screen camera error (mobile debug)
  const codeReaderRef = useRef(null);
  const videoRef = useRef(null);

  // Foods confirmed for logging (via the left checkbox or the detail screen).
  // Keyed by food name → { food, serving, unit, adjustedMacros }.
  const [checkedFoods, setCheckedFoods] = useState({});
  const [detailFood, setDetailFood] = useState(null);   // food being viewed on the detail screen
  const [detailServing, setDetailServing] = useState('100');
  const [detailUnit, setDetailUnit] = useState('g');
  const [detailServings, setDetailServings] = useState('1');
  // When set, the detail screen is editing an existing logged entry (tap a food in the
  // timeline). Holds the row id + original serving/unit/servings to detect changes.
  const [editingEntry, setEditingEntry] = useState(null);

  // Long-press multi-select on the timeline: trash + checkbox per food, with a Delete/Copy bar.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState([]);   // full entry objects
  const [copyMode, setCopyMode] = useState(false);              // picking a destination hour
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);

  // Custom foods (user-defined). Pinned at the top of the Add Food list.
  const [customFoods, setCustomFoods] = useState([]);
  // Custom-food detail data. null = not viewing a custom food. Shape:
  // { id|null, name, calories, protein, carbs, fats, micros: { [key]: string } }
  const [customEdit, setCustomEdit] = useState(null);
  const [customEditing, setCustomEditing] = useState(false);  // fields shown as editable inputs
  const [customMenuOpen, setCustomMenuOpen] = useState(null);     // id of food whose ··· menu is open
  const [customMenuPos, setCustomMenuPos] = useState({ top: 0, right: 0 });

  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const searchDebounceRef = useRef(null);

  const isToday = date.toDateString() === new Date().toDateString();
  const dateStr = date.toLocaleDateString();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadFoods(); }, [date]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadFavorites(); }, []);

  useEffect(() => {
    if (showAddFoodScreen) { loadRecentFoods(); loadCustomFoods(); loadFavorites(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddFoodScreen]);

  useEffect(() => {
    if (!showAddFoodScreen) return;
    const query = searchQuery.trim();
    if (!query) {
      clearTimeout(searchDebounceRef.current);
      setSearchResults(null);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => searchFoods(query), 400);
    return () => clearTimeout(searchDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, showAddFoodScreen]);

  const loadFoods = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('food_entries')
      .select('*')
      .eq('date', dateStr)
      .order('created_at', { ascending: true });
    if (error) { console.error(error); setLoading(false); return; }
    const grouped = {};
    data.forEach(entry => {
      if (!grouped[entry.hour]) grouped[entry.hour] = [];
      grouped[entry.hour].push(entry);
    });
    setFoods(grouped);
    setLoading(false);
  };

  const loadRecentFoods = async () => {
    // Only foods logged in the last 7 days count as "recent".
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('food_entries')
      .select('name, calories, protein, carbs, fats')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(200);
    const seen = new Set();
    const recent = [];
    if (data) {
      for (const entry of data) {
        if (!seen.has(entry.name) && recent.length < 15) {
          seen.add(entry.name);
          recent.push({ name: entry.name, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fats: entry.fats });
        }
      }
    }
    for (const p of PLACEHOLDER_FOODS) {
      if (recent.length >= 15) break;
      if (!seen.has(p.name)) { seen.add(p.name); recent.push(p); }
    }
    setRecentFoodList(recent);
  };

  const loadCustomFoods = async () => {
    const { data } = await supabase
      .from('custom_foods')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCustomFoods(data.map(f => ({
      ...f,
      isCustom: true,
      savedServing: f.saved_serving ?? undefined,
      savedUnit: f.saved_unit ?? undefined,
      micros: f.micros || undefined,
    })));
  };

  // ─── Favorites ─────────────────────────────────────────────
  const loadFavorites = async () => {
    const { data } = await supabase
      .from('favorite_foods')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setFavorites(data.map(r => ({ id: r.id, name: r.name, isCustom: r.is_custom, food: r.food })));
  };

  const isFavorite = (name) => favorites.some(f => f.name === name);

  // Persist a favorite (snapshot of the food). No-op if already favorited.
  const addFavorite = async (food) => {
    if (!food?.name || isFavorite(food.name)) return;
    const payload = { name: food.name, is_custom: !!food.isCustom, food };
    const { data, error } = await supabase.from('favorite_foods').insert([payload]).select().single();
    if (error) { console.error('Failed to add favorite:', error); return; }
    setFavorites(prev => [{ id: data.id, name: data.name, isCustom: data.is_custom, food: data.food }, ...prev]);
  };

  const removeFavorite = async (name) => {
    setFavorites(prev => prev.filter(f => f.name !== name));
    const { error } = await supabase.from('favorite_foods').delete().eq('name', name);
    if (error) console.error('Failed to remove favorite:', error);
  };

  const toggleFavorite = (food) => {
    if (isFavorite(food.name)) removeFavorite(food.name);
    else addFavorite(food);
  };

  // Open the detail page for a custom food. Pass null to create a new one (starts editable);
  // existing foods open read-only unless startEditing is true (··· Edit / top-right Edit).
  const openCustomDetail = (food, startEditing = false) => {
    const existing = food && food.id != null;
    const microStrings = CUSTOM_MICRO_FIELDS.reduce((o, m) => { o[m.key] = '0'; return o; }, {});
    if (existing && food.micros) {
      for (const [k, v] of Object.entries(food.micros)) microStrings[k] = String(v);
    }
    setCustomEdit({
      id: existing ? food.id : null,
      name: existing ? (food.name || '') : 'Custom Food',
      calories: existing ? String(food.calories ?? '') : '',
      protein: existing ? String(food.protein ?? '') : '',
      carbs: existing ? String(food.carbs ?? '') : '',
      fats: existing ? String(food.fats ?? '') : '',
      micros: microStrings,
    });
    const { serving, unit } = defaultServingOf(food || {});
    setDetailServing(String(serving));
    setDetailUnit(unit);
    setDetailServings('1');
    setCustomEditing(!existing || startEditing);   // new foods start editable
    setDetailFood(existing ? food : { name: 'Custom Food', isCustom: true });
  };

  const editCustomField = (key, val) => setCustomEdit(e => ({ ...e, [key]: val }));
  const editCustomMicro = (key, val) => setCustomEdit(e => ({ ...e, micros: { ...e.micros, [key]: val } }));

  // Save the edited custom food to the library (insert or update) and stage it into the
  // log. Custom-food macros are stored per serving; the logged amount = macros × servings.
  const saveCustomDetail = async () => {
    const e = customEdit;
    if (!e) return;
    const name = (e.name || '').trim() || 'Custom Food';
    const macros = {
      calories: Number(e.calories) || 0,
      protein: Number(e.protein) || 0,
      carbs: Number(e.carbs) || 0,
      fats: Number(e.fats) || 0,
    };
    const micros = {};
    CUSTOM_MICRO_FIELDS.forEach(m => { micros[m.key] = Number(e.micros[m.key]) || 0; });
    const serving = Number(detailServing) || 0;
    const unit = detailUnit;
    const servings = Number(detailServings) || 0;
    const payload = { name, ...macros, micros, saved_serving: serving, saved_unit: unit };

    const { data: row, error } = e.id
      ? await supabase.from('custom_foods').update(payload).eq('id', e.id).select().single()
      : await supabase.from('custom_foods').insert([payload]).select().single();
    if (error) { console.error('Failed to save custom food:', error); return; }

    const food = { ...row, isCustom: true, micros, savedServing: serving, savedUnit: unit };
    setCustomFoods(prev => e.id ? prev.map(f => (f.id === e.id ? food : f)) : [food, ...prev]);

    // New custom foods are automatically favorited; edits refresh the favorite snapshot.
    if (!e.id) {
      addFavorite(food);
    } else if (isFavorite(name)) {
      setFavorites(prev => prev.map(f => (f.name === name ? { ...f, food } : f)));
      supabase.from('favorite_foods').update({ food }).eq('name', name)
        .then(({ error }) => { if (error) console.error('Failed to update favorite:', error); });
    }

    const adjusted = {
      calories: Math.round(macros.calories * servings),
      protein: Math.round(macros.protein * servings),
      carbs: Math.round(macros.carbs * servings),
      fats: Math.round(macros.fats * servings),
    };
    setCheckedFoods(prev => ({ ...prev, [name]: { food, serving, unit, servings, adjustedMacros: adjusted } }));
    setCustomEdit(null);
    setCustomEditing(false);
    setDetailFood(null);
  };

  // Read mode: stage an already-saved custom food into the log (× number of servings).
  const addCustomToLog = () => {
    const e = customEdit;
    if (!e) return;
    const name = (e.name || '').trim() || 'Custom Food';
    const servings = Number(detailServings) || 0;
    const adjusted = {
      calories: Math.round((Number(e.calories) || 0) * servings),
      protein: Math.round((Number(e.protein) || 0) * servings),
      carbs: Math.round((Number(e.carbs) || 0) * servings),
      fats: Math.round((Number(e.fats) || 0) * servings),
    };
    setCheckedFoods(prev => ({ ...prev, [name]: { food: detailFood, serving: Number(detailServing) || 0, unit: detailUnit, servings, adjustedMacros: adjusted } }));
    setCustomEdit(null);
    setCustomEditing(false);
    setDetailFood(null);
  };

  const deleteCustomFood = async (food) => {
    setCustomMenuOpen(null);
    setCustomFoods(prev => prev.filter(f => f.id !== food.id));
    setCheckedFoods(prev => { const n = { ...prev }; delete n[food.name]; return n; });
    if (isFavorite(food.name)) removeFavorite(food.name);
    await supabase.from('custom_foods').delete().eq('id', food.id);
  };

  const searchFoods = async (query) => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `${FOOD_SEARCH_URL}?query=${encodeURIComponent(query)}`,
        { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : (data.foods || []));
    } catch (err) {
      console.error('Food search error:', err);
      setSearchError('Search unavailable');
      setSearchResults(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const deleteFood = (id, hour) => {
    const item = (foods[hour] || []).find(f => f.id === id);
    if (!item) return;
    setFoods(prev => ({ ...prev, [hour]: prev[hour].filter(f => f.id !== id) }));
    showToast(
      `"${item.name}" deleted`,
      () => setFoods(prev => ({ ...prev, [hour]: [...(prev[hour] || []), item] })),
      async () => { await supabase.from('food_entries').delete().eq('id', id); }
    );
  };

  // ─── Long-press multi-select ───────────────────────────────
  const startLongPress = (entry) => {
    longPressFired.current = false;
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setSelectMode(true);
      setSelectedEntries(prev => prev.some(e => e.id === entry.id) ? prev : [...prev, entry]);
    }, 450);
  };
  const cancelLongPress = () => clearTimeout(longPressTimer.current);

  const toggleSelectEntry = (entry) => {
    setSelectedEntries(prev => prev.some(e => e.id === entry.id) ? prev.filter(e => e.id !== entry.id) : [...prev, entry]);
  };

  const onFoodTap = (entry) => {
    if (longPressFired.current) { longPressFired.current = false; return; }  // ignore click after long-press
    if (copyMode) copyToHour(entry.hour);
    else if (selectMode) toggleSelectEntry(entry);
    else openLoggedFood(entry);
  };

  const exitSelectMode = () => { setSelectMode(false); setSelectedEntries([]); setCopyMode(false); };

  const bulkDeleteSelected = async () => {
    const ids = selectedEntries.map(e => e.id);
    if (ids.length === 0) return;
    setFoods(prev => {
      const next = {};
      for (const [h, list] of Object.entries(prev)) next[h] = list.filter(f => !ids.includes(f.id));
      return next;
    });
    exitSelectMode();
    const { error } = await supabase.from('food_entries').delete().in('id', ids);
    if (error) { console.error(error); loadFoods(); }
  };

  // Copy the selected foods to the tapped hour on the currently-shown date.
  const copyToHour = async (hour) => {
    const inserts = selectedEntries.map(e => ({
      name: e.name, calories: e.calories, protein: e.protein, carbs: e.carbs, fats: e.fats,
      hour, date: dateStr, serving: e.serving ?? null, unit: e.unit ?? null, food: e.food ?? null,
    }));
    const count = inserts.length;
    exitSelectMode();
    const { error } = await supabase.from('food_entries').insert(inserts);
    if (error) { console.error(error); return; }
    loadFoods();
    showToast(`Copied ${count} food${count !== 1 ? 's' : ''} to ${HOURS[hour].label}`, null, null);
  };

  const openAddFood = (hour) => { setAddFoodHour(hour); setAddFoodDragY(0); setShowAddFoodScreen(true); };

  // From the Favorites tab: open the Add Food sheet straight into this food's detail.
  const openFavoriteDetail = (fav) => {
    setAddFoodHour(currentHour);
    setAddFoodDragY(0);
    setShowAddFoodScreen(true);
    if (fav.isCustom) openCustomDetail(fav.food, false);
    else openDetail(fav.food);
  };

  // Tap a logged food in the timeline → open the detail to re-adjust its serving.
  const openLoggedFood = (entry) => {
    // Reconstruct from the stored snapshot; older rows without one fall back to best-effort.
    const snap = entry.food || {
      name: entry.name, brandOwner: null,
      calories: Number(entry.calories) || 0, protein: Number(entry.protein) || 0,
      carbs: Number(entry.carbs) || 0, fats: Number(entry.fats) || 0,
      servingSize: 100, servingSizeUnit: 'g', nutrients: [],
    };
    const serving = String(entry.serving != null ? entry.serving : (snap.servingSize || 100));
    const unit = entry.unit || 'g';
    setAddFoodHour(entry.hour);
    setAddFoodDragY(0);
    setShowAddFoodScreen(true);
    setCustomEdit(null);
    setCustomEditing(false);
    setDetailServing(serving);
    setDetailUnit(unit);
    setDetailServings('1');
    setEditingEntry({ id: entry.id, hour: entry.hour, origServing: serving, origUnit: unit, origServings: '1' });
    setDetailFood(snap);
  };

  // Save changes to a logged entry's serving (recompute macros + refresh the snapshot).
  const saveLoggedEntry = async () => {
    const e = editingEntry;
    if (!e) return;
    const food = detailFood;
    const serving = Number(detailServing) || 0;
    const unit = detailUnit;
    const servings = Number(detailServings) || 0;
    const macros = computeMacros(food, serving, unit, servings);
    const fields = buildLoggedFields(food, serving, unit, servings, macros);
    const update = { calories: macros.calories, protein: macros.protein, carbs: macros.carbs, fats: macros.fats, ...fields };
    const { error } = await supabase.from('food_entries').update(update).eq('id', e.id);
    if (error) { console.error('Failed to update entry:', error); return; }
    setEditingEntry(null);
    closeAddFood();
    loadFoods();
  };

  // Slide the sheet up once it has mounted (next frame), so the transform animates.
  useEffect(() => {
    if (showAddFoodScreen) {
      const id = requestAnimationFrame(() => setAddFoodOpen(true));
      return () => cancelAnimationFrame(id);
    }
  }, [showAddFoodScreen]);

  // Release the camera if the component unmounts mid-scan.
  useEffect(() => () => { if (codeReaderRef.current) codeReaderRef.current.reset(); }, []);

  const closeAddFood = () => {
    stopScanner();                   // ensure camera is released if the sheet closes
    setAddFoodOpen(false);           // slide down
    setAddFoodDragY(0);
    setTimeout(() => {               // unmount + reset after the slide-out finishes
      setShowAddFoodScreen(false);
      setSearchQuery('');
      setCheckedFoods({});
      setDetailFood(null);
      setEditingEntry(null);
      setSearchResults(null);
      setSearchError(null);
    }, 350);
  };

  // ─── Barcode scanner ───────────────────────────────────────
  const startScanner = async () => {
    setScannerError('');
    setShowScanner(true);
    try {
      // Loaded on demand so ZXing stays out of the initial bundle.
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      codeReaderRef.current = new BrowserMultiFormatReader();

      // Request the back camera directly via constraints (newer ZXing dropped
      // listVideoInputDevices), so no device enumeration is needed.
      await codeReaderRef.current.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result, error) => {
          if (result) {
            stopScanner();
            handleBarcodeResult(result.getText());
          }
        }
      );
    } catch (err) {
      console.error('Camera error full:', err);
      setScannerError(err.message || err.toString() || 'Unknown error');
      // Keep the overlay open so the on-screen error is visible (close via the × button).
      showToast('Camera not available', null, null);
    }
  };

  const stopScanner = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    setScannerError('');
    setShowScanner(false);
  };

  const handleBarcodeResult = async (barcode) => {
    setScanning(true);
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();

      if (data.status !== 1 || !data.product) {
        showToast('Product not found', null, null);
        setScanning(false);
        return;
      }

      const p = data.product;
      const nutriments = p.nutriments || {};
      const food = {
        name: p.product_name || p.product_name_en || 'Unknown Product',
        brandOwner: p.brands || null,
        servingSize: p.serving_quantity || 100,
        servingSizeUnit: p.serving_quantity_unit || 'g',
        calories: nutriments['energy-kcal_serving'] || nutriments['energy-kcal_100g'] || 0,
        protein: nutriments['proteins_serving'] || nutriments['proteins_100g'] || 0,
        carbs: nutriments['carbohydrates_serving'] || nutriments['carbohydrates_100g'] || 0,
        fats: nutriments['fat_serving'] || nutriments['fat_100g'] || 0,
        nutrients: [
          { name: 'Fiber', value: nutriments['fiber_serving'] || nutriments['fiber_100g'] || 0, unit: 'g' },
          { name: 'Sugar', value: nutriments['sugars_serving'] || nutriments['sugars_100g'] || 0, unit: 'g' },
          { name: 'Sodium', value: nutriments['sodium_serving'] || nutriments['sodium_100g'] || 0, unit: 'mg' },
          { name: 'Cholesterol', value: nutriments['cholesterol_serving'] || nutriments['cholesterol_100g'] || 0, unit: 'mg' },
        ].filter(n => n.value > 0),
        fromBarcode: true,
      };

      setScanning(false);
      openDetail(food);
    } catch (err) {
      console.error('Barcode lookup error:', err);
      showToast('Could not look up product', null, null);
      setScanning(false);
    }
  };

  const onAddFoodPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    addFoodDragStart.current = e.clientY;
  };
  const onAddFoodPointerMove = (e) => {
    if (addFoodDragStart.current === null) return;
    setAddFoodDragY(Math.max(0, e.clientY - addFoodDragStart.current));
  };
  const onAddFoodPointerUp = (e) => {
    if (addFoodDragStart.current === null) return;
    const dy = Math.max(0, e.clientY - addFoodDragStart.current);
    addFoodDragStart.current = null;
    if (dy > 80) closeAddFood();
    else setAddFoodDragY(0);
  };

  // Instant check from a recent/custom row — adds the food at its saved serving.
  const toggleChecked = (food) => {
    setCheckedFoods(prev => {
      const next = { ...prev };
      if (next[food.name]) { delete next[food.name]; return next; }
      const { serving, unit } = defaultServingOf(food);
      next[food.name] = { food, serving, unit, servings: 1, adjustedMacros: computeMacros(food, serving, unit) };
      return next;
    });
  };

  const openDetail = (food) => {
    const { serving, unit } = defaultServingOf(food);
    setDetailServing(String(serving));
    setDetailUnit(unit);
    setDetailServings('1');
    setCustomEdit(null);
    setCustomEditing(false);
    setDetailFood(food);
  };

  // Confirm serving from the detail screen: save the preferred serving back to the
  // source list and add the food (with adjusted macros) to checkedFoods.
  const confirmDetail = () => {
    const food = detailFood;
    if (!food) return;
    const serving = Number(detailServing) || 0;
    const unit = detailUnit;
    const servings = Number(detailServings) || 0;
    const macros = computeMacros(food, serving, unit, servings);
    // We store savedServing/savedUnit rather than overwriting servingSize/servingSizeUnit
    // so the per-serving macro basis used for scaling stays intact. Custom foods persist
    // these to the row (remembered across sessions). Recent/USDA foods only remember the
    // serving for the current session — food_entries stores adjusted-total macros with no
    // per-base reference, so a saved serving can't be re-scaled correctly there.
    if (food.isCustom) {
      setCustomFoods(prev => prev.map(f => (f.id === food.id ? { ...f, savedServing: serving, savedUnit: unit } : f)));
      supabase.from('custom_foods').update({ saved_serving: serving, saved_unit: unit }).eq('id', food.id)
        .then(({ error }) => { if (error) console.error('Failed to persist serving:', error); });
    } else {
      setRecentFoodList(prev => {
        if (prev.some(f => f.name === food.name)) {
          return prev.map(f => (f.name === food.name ? { ...f, savedServing: serving, savedUnit: unit } : f));
        }
        // New USDA result: add to recents so next time it appears with the saved serving.
        return [{ ...food, savedServing: serving, savedUnit: unit }, ...prev];
      });
    }
    setCheckedFoods(prev => ({ ...prev, [food.name]: { food, serving, unit, servings, adjustedMacros: macros } }));
    setDetailFood(null);
  };

  const handleAddChecked = async () => {
    const items = Object.values(checkedFoods);
    if (items.length === 0) return;
    const inserts = items.map(({ food, serving, unit, servings, adjustedMacros }) => ({
      name: food.name,
      calories: adjustedMacros.calories,
      protein: adjustedMacros.protein,
      carbs: adjustedMacros.carbs,
      fats: adjustedMacros.fats,
      hour: addFoodHour,
      date: dateStr,
      ...buildLoggedFields(food, serving, unit, servings ?? 1, adjustedMacros),
    }));
    const { data, error } = await supabase.from('food_entries').insert(inserts).select();
    if (error) { console.error(error); return; }
    const newFoods = { ...foods };
    data.forEach(entry => {
      if (!newFoods[entry.hour]) newFoods[entry.hour] = [];
      newFoods[entry.hour].push(entry);
    });
    setFoods(newFoods);
    closeAddFood();
  };

  const allFoods = Object.values(foods).flat();
  const totals = allFoods.reduce((acc, f) => ({
    calories: acc.calories + Number(f.calories),
    protein: acc.protein + Number(f.protein),
    carbs: acc.carbs + Number(f.carbs),
    fats: acc.fats + Number(f.fats),
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  const changeDate = (dir) => {
    const d = new Date(date);
    d.setDate(d.getDate() + dir);
    setDate(d);
  };

  const navDateText = isToday
    ? `Today, ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const checkedCount = Object.keys(checkedFoods).length;
  const isSearchActive = searchQuery.trim().length > 0;
  // Custom foods are pinned at the top, so exclude their names from the recent/search list below to avoid duplicates.
  const customNames = new Set(customFoods.map(f => f.name));
  const displayedFoods = (isSearchActive && !searchError ? (searchResults || []) : recentFoodList).filter(f => !customNames.has(f.name));
  const displayedCustomFoods = isSearchActive
    ? customFoods.filter(f => f.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : customFoods;
  const listLabel = isSearchActive ? 'Results' : 'Recent';

  // Break out of the .content wrapper's 20px padding
  return (
    <div style={{ margin: '-20px' }}>

      {/* Calendar button — fixed to App header's right slot */}
      <button onClick={() => setShowCalendar(true)} style={{
        position: 'fixed', top: 0, right: 0, zIndex: 150,
        padding: '24px 20px 16px',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/>
          <path d="M16 2v4M8 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M3 10h18" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </button>

      {/* ─── DATE NAV ───────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 20px 8px',
      }}>
        <button onClick={() => changeDate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 22, padding: '2px 8px', lineHeight: 1,
        }}>‹</button>
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--accent)' }}>{navDateText}</span>
        <button onClick={() => changeDate(1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 22, padding: '2px 8px', lineHeight: 1,
        }}>›</button>
      </div>

      {/* ─── MACRO CIRCLES ──────────────────────────────────── */}
      <div style={{
        display: 'flex', overflowX: 'auto', gap: 10,
        padding: '12px 16px',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        <MacroCircle value={totals.calories} goal={calorieGoal} color="#3B82F6" trackColor="#DBEAFE" label="Calories" isCalories />
        <MacroCircle value={totals.protein}  goal={proteinGoal} color="#22C55E" trackColor="#DCFCE7" label="Protein" />
        <MacroCircle value={totals.fats}     goal={fatsGoal}    color="#3B82F6" trackColor="#DBEAFE" label="Fat" />
        <MacroCircle value={totals.carbs}    goal={carbsGoal}   color="#EAB308" trackColor="#FEF9C3" label="Carbs" />
        <div style={{ minWidth: 4, flexShrink: 0 }} />
      </div>

      {/* ─── FILTER TABS ────────────────────────────────────── */}
      <style>{`
        .fl-tab-inactive { background: #F3F4F6; }
        [data-theme="dark"] .fl-tab-inactive { background: var(--border); }
      `}</style>
      <div style={{
        display: 'flex', overflowX: 'auto', gap: 8,
        padding: '4px 16px 12px',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {FILTER_TABS.map(tab => {
          const isActive = activeFilter === tab;
          return (
            <button key={tab}
              className={isActive ? '' : 'fl-tab-inactive'}
              onClick={() => {
                if (tab === 'Add Food' || tab === 'Favorites') setActiveFilter(tab);
                else showToast('Coming soon', null, null);
              }} style={{
                flexShrink: 0, padding: '7px 16px', borderRadius: 20,
                border: 'none',
                background: isActive ? 'var(--accent)' : undefined,
                color: isActive ? '#fff' : 'var(--text-primary)',
                fontWeight: 500, fontSize: 13, cursor: 'pointer',
              }}>{tab}</button>
          );
        })}
        <div style={{ minWidth: 4, flexShrink: 0 }} />
      </div>

      {/* ─── FAVORITES LIST ─────────────────────────────────── */}
      {activeFilter === 'Favorites' ? (
        <div style={{ padding: '8px 20px 40px' }}>
          {favorites.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '40px 20px' }}>
              No favorites yet. Tap a food and choose “Add to Favorites” to see it here.
            </p>
          ) : favorites.map(fav => {
            const f = fav.food || {};
            return (
              <div key={fav.id} onClick={() => openFavoriteDetail(fav)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{fav.name}</span>
                    {fav.isCustom && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: 8 }}>Custom</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {Math.round(Number(f.calories) || 0)} cal · {Math.round(Number(f.protein) || 0)}g P · {Math.round(Number(f.carbs) || 0)}g C · {Math.round(Number(f.fats) || 0)}g F
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeFavorite(fav.name); }} aria-label="Remove favorite"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 18, padding: '2px 6px', lineHeight: 1, flexShrink: 0 }}>★</button>
              </div>
            );
          })}
        </div>
      ) : loading ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Loading...</p>
      ) : (
        <div style={{ position: 'relative', paddingBottom: 40 }}>
          {/* Vertical connecting line through dot centers */}
          <div style={{
            position: 'absolute', left: 28, top: 0, bottom: 0,
            width: 1, background: 'var(--border)', zIndex: 0,
          }} />

          {HOURS.map(h => {
            const hourFoods = foods[h.value] || [];
            const isNow = isToday && h.value === currentHour;
            const [num, ap] = h.label.split(' ');
            return (
              <React.Fragment key={h.value}>
                {/* [dot col 16px] [hour label 44px] [tile] */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '3px 20px', gap: 8 }}>
                  {/* Dot column — line runs through its center */}
                  <div style={{
                    width: 16, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', zIndex: 1,
                  }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      border: '2px solid #3B82F6',
                      background: hourFoods.length > 0 ? '#3B82F6' : 'var(--card)',
                    }} />
                  </div>

                  {/* Hour label — two lines */}
                  <div style={{ width: 44, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isNow ? 'var(--accent)' : 'var(--text-primary)', lineHeight: 1 }}>{num}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1, marginTop: 2 }}>{ap}</span>
                  </div>

                  {/* Card — also a copy target while in copy mode */}
                  <div onClick={() => { if (copyMode) copyToHour(h.value); }} style={{
                    flex: 1, background: isNow ? 'var(--accent-light)' : 'var(--card)',
                    borderRadius: 12,
                    border: copyMode ? '1px dashed var(--accent)' : (isNow ? '1px solid var(--accent)' : '1px solid var(--border)'),
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                    padding: '14px 16px',
                    cursor: copyMode ? 'pointer' : 'default',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={(e) => { e.stopPropagation(); copyMode ? copyToHour(h.value) : openAddFood(h.value); }} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--accent)', fontWeight: 600, fontSize: 13, padding: 0,
                      }}>+ Add Food</button>
                    </div>
                    {hourFoods.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(() => {
                          const ht = hourFoods.reduce((a, f) => ({
                            calories: a.calories + Number(f.calories || 0),
                            protein: a.protein + Number(f.protein || 0),
                            carbs: a.carbs + Number(f.carbs || 0),
                            fats: a.fats + Number(f.fats || 0),
                          }), { calories: 0, protein: 0, carbs: 0, fats: 0 });
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, fontWeight: 700, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                              <span style={{ color: '#3B82F6' }}>Calories: {ht.calories}</span>
                              <span style={{ color: '#22C55E' }}>P: {ht.protein}g</span>
                              <span style={{ color: '#3B82F6' }}>F: {ht.fats}g</span>
                              <span style={{ color: '#EAB308' }}>C: {ht.carbs}g</span>
                            </div>
                          );
                        })()}
                        {hourFoods.map(f => {
                          const isSel = selectedEntries.some(e => e.id === f.id);
                          return (
                            <div key={f.id}
                              onClick={(e) => { e.stopPropagation(); onFoodTap(f); }}
                              onPointerDown={() => startLongPress(f)}
                              onPointerUp={cancelLongPress}
                              onPointerLeave={cancelLongPress}
                              onPointerCancel={cancelLongPress}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                              {selectMode && (
                                <div style={{
                                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                  border: isSel ? 'none' : '2px solid var(--border)', background: isSel ? 'var(--accent)' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {isSel && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{f.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{f.calories} cal · {f.protein}g P</div>
                              </div>
                              {selectMode && (
                                <button onClick={(e) => { e.stopPropagation(); deleteFood(f.id, h.value); }} aria-label="Delete food"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4444', padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m1 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section dividers after 5 AM and 11 AM */}
                {(h.value === 5 || h.value === 11) && (
                  <div style={{ margin: '4px 20px 4px 96px', borderTop: '1px dashed var(--border)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ─── CALENDAR MODAL ─────────────────────────────────── */}
      {showCalendar && (
        <CalendarModal
          selected={date}
          onSelect={d => { setDate(d); setShowCalendar(false); }}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* ─── ADD FOOD SCREEN ────────────────────────────────── */}
      {showAddFoodScreen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg)',
          display: 'flex', flexDirection: 'column',
          transform: addFoodOpen ? `translateY(${addFoodDragY}px)` : 'translateY(100%)',
          transition: addFoodDragY > 0 ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <style>{`
            @keyframes slideUpBar  { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            @keyframes spin        { to { transform: rotate(360deg); } }
          `}</style>

          {/* Drag handle — drag down to dismiss */}
          <div
            onPointerDown={onAddFoodPointerDown}
            onPointerMove={onAddFoodPointerMove}
            onPointerUp={onAddFoodPointerUp}
            style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', flexShrink: 0, userSelect: 'none', touchAction: 'none' }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
          </div>

          {detailFood ? (
            <FoodDetailView
              food={detailFood}
              serving={detailServing}
              unit={detailUnit}
              servings={detailServings}
              onServing={setDetailServing}
              onUnit={setDetailUnit}
              onServings={setDetailServings}
              edit={customEdit}
              editing={customEditing}
              onStartEdit={() => setCustomEditing(true)}
              onEditField={editCustomField}
              onEditMicro={editCustomMicro}
              favorited={isFavorite(detailFood.name)}
              onToggleFavorite={() => toggleFavorite(detailFood)}
              hourLabel={HOURS[addFoodHour].label}
              entryMode={!!editingEntry}
              entryDirty={!!editingEntry && (detailServing !== editingEntry.origServing || detailUnit !== editingEntry.origUnit || detailServings !== editingEntry.origServings)}
              onBack={() => { setDetailFood(null); setCustomEdit(null); setCustomEditing(false); setEditingEntry(null); }}
              onAdd={editingEntry ? saveLoggedEntry : (customEditing ? saveCustomDetail : (customEdit ? addCustomToLog : confirmDetail))}
            />
          ) : (
          <>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px 12px', gap: '10px', background: 'var(--bg)' }}>
            <span style={{ flex: 1, fontWeight: '700', fontSize: '17px', color: 'var(--text-primary)' }}>Add Food</span>
            <button onClick={() => openCustomDetail(null)} aria-label="Add custom food"
              style={{ background: 'var(--accent)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '13px', fontWeight: '500', lineHeight: 1, padding: '7px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              + Add Custom Food
            </button>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setHourMenuOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-light)', color: 'var(--accent)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                {HOURS[addFoodHour].label}
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" style={{ transform: hourMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {hourMenuOpen && (
                <>
                  <div onClick={() => setHourMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 11, minWidth: '110px', maxHeight: '240px', overflowY: 'auto' }}>
                    {HOURS.map(h => (
                      <button key={h.value} onClick={() => { setAddFoodHour(h.value); setHourMenuOpen(false); }}
                        style={{ display: 'block', width: '100%', padding: '8px 14px', background: h.value === addFoodHour ? 'var(--accent-light)' : 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: h.value === addFoodHour ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {h.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ padding: '0 20px 12px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: '32px', top: 0, bottom: '12px', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: 'var(--text-muted)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <input
              placeholder="Search for a food"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input"
              style={{ paddingLeft: '44px', paddingRight: '48px' }}
            />
            <div style={{ position: 'absolute', right: '32px', top: 0, bottom: '12px', display: 'flex', alignItems: 'center' }}>
              {searchLoading ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <button onClick={startScanner} aria-label="Scan barcode"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '4px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="2"  y="4" width="2" height="16"/>
                    <rect x="6"  y="4" width="1" height="16"/>
                    <rect x="9"  y="4" width="2" height="16"/>
                    <rect x="13" y="4" width="1" height="16"/>
                    <rect x="16" y="4" width="2" height="16"/>
                    <rect x="20" y="4" width="2" height="16"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>

            {displayedCustomFoods.map(food => {
              const checked = !!checkedFoods[food.name];
              return (
                <div key={'custom-' + food.id} onClick={() => openCustomDetail(food, false)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                }}>
                  <button onClick={(e) => { e.stopPropagation(); toggleChecked(food); }}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      border: checked ? 'none' : '2px solid var(--border)',
                      background: checked ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s',
                    }}>
                      {checked && <span style={{ color: 'white', fontSize: '12px', lineHeight: 1 }}>✓</span>}
                    </div>
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{food.name}</span>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: '8px' }}>Custom</span>
                      {isFavorite(food.name) && <span style={{ fontSize: '10px', fontWeight: '700', color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: '8px', whiteSpace: 'nowrap' }}>★ Favorite</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {food.calories} cal · {food.protein}g P · {food.carbs}g C · {food.fats}g F
                    </div>
                  </div>
                  <button onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setCustomMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                    setCustomMenuOpen(customMenuOpen === food.id ? null : food.id);
                  }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px', padding: '4px 6px', letterSpacing: '2px', lineHeight: 1, flexShrink: 0 }}>···</button>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              );
            })}

            {searchError && (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                {searchError} — showing recent foods
              </p>
            )}

            {(!isSearchActive || searchError || (searchResults && searchResults.length > 0)) && (
              <p className="section-title" style={{ marginBottom: '4px', fontWeight: 800, color: 'var(--text-secondary)' }}>{searchError ? 'Recent' : listLabel}</p>
            )}

            {isSearchActive && !searchLoading && !searchError && searchResults && searchResults.length === 0 && (
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>No results found</p>
            )}

            {displayedFoods.map(food => {
              // Recent rows get an instant-check circle; live USDA search results don't.
              const showCheckbox = !(isSearchActive && !searchError);
              const checked = !!checkedFoods[food.name];
              const ds = defaultServingOf(food);
              const dm = computeMacros(food, ds.serving, ds.unit);
              return (
                <div key={food.name + (food.brandOwner || '')} onClick={() => openDetail(food)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                }}>
                  {showCheckbox && (
                    <button onClick={(e) => { e.stopPropagation(); toggleChecked(food); }}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%',
                        border: checked ? 'none' : '2px solid var(--border)',
                        background: checked ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s',
                      }}>
                        {checked && <span style={{ color: 'white', fontSize: '12px', lineHeight: 1 }}>✓</span>}
                      </div>
                    </button>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{food.name}</span>
                      {isFavorite(food.name) && <span style={{ fontSize: '10px', fontWeight: '700', color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: '8px', whiteSpace: 'nowrap' }}>★ Favorite</span>}
                    </div>
                    {food.brandOwner && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{food.brandOwner}</div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {dm.calories} cal · {dm.protein}g P · {dm.carbs}g C · {dm.fats}g F
                    </div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              );
            })}
          </div>

          {checkedCount > 0 && (
            <div style={{
              padding: '12px 20px 32px', borderTop: '1px solid var(--border)',
              background: 'var(--bg)', animation: 'slideUpBar 0.2s ease forwards',
            }}>
              <button onClick={handleAddChecked} className="btn-primary">
                Add {checkedCount} Food{checkedCount !== 1 ? 's' : ''}
              </button>
            </div>
          )}
          </>
          )}

          {/* Custom food ··· menu */}
          {customMenuOpen && <div onClick={() => setCustomMenuOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 440 }} />}
          {customMenuOpen && (() => {
            const food = customFoods.find(f => f.id === customMenuOpen);
            if (!food) return null;
            return (
              <div style={{
                position: 'fixed', top: customMenuPos.top, right: customMenuPos.right,
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px',
                overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 441, minWidth: '140px',
              }}>
                <button onClick={() => { setCustomMenuOpen(null); openCustomDetail(food, true); }}
                  style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>Edit</button>
                <button onClick={() => deleteCustomFood(food)}
                  style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: '#ff4444' }}>Delete</button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Barcode camera scanner — full-screen, above the Add Food sheet */}
      {showScanner && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'black', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={stopScanner} aria-label="Close scanner" style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'white', fontSize: 28, cursor: 'pointer', zIndex: 2 }}>×</button>
          <video ref={videoRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          {/* Viewfinder overlay */}
          <div style={{ position: 'relative', zIndex: 1, width: 260, height: 260, border: '2px solid white', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--accent)', animation: 'scanLine 2s linear infinite' }} />
          </div>
          <p style={{ color: 'white', marginTop: 24, fontSize: 14, zIndex: 1 }}>
            {scanning ? 'Looking up product...' : 'Scanning for barcode...'}
          </p>
          {scannerError ? (
            <p style={{ color: '#EF4444', marginTop: 8, fontSize: 12, zIndex: 1, textAlign: 'center', padding: '0 20px' }}>
              Error: {scannerError}
            </p>
          ) : null}
          <style>{`
            @keyframes scanLine {
              0% { top: 0; }
              50% { top: calc(100% - 2px); }
              100% { top: 0; }
            }
          `}</style>
        </div>
      )}

      {/* ─── SELECT / COPY BAR ──────────────────────────────── */}
      {selectMode && (selectedEntries.length > 0 || copyMode) && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 72, zIndex: 350, display: 'flex', justifyContent: 'center', padding: '0 16px', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 480, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 6px 24px rgba(0,0,0,0.18)', padding: '12px 14px' }}>
            {copyMode && (
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>
                Tap an hour to copy {selectedEntries.length} food{selectedEntries.length !== 1 ? 's' : ''} there — switch the date first to copy to another day.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {copyMode ? (
                <button onClick={() => setCopyMode(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              ) : (
                <>
                  <button onClick={bulkDeleteSelected}
                    style={{ flex: 1, background: '#ff4444', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                    Delete ({selectedEntries.length})
                  </button>
                  <button onClick={() => setCopyMode(true)} className="btn-secondary" style={{ flex: 1 }}>Copy</button>
                  <button onClick={exitSelectMode}
                    style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: 'var(--text-primary)' }}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FoodLog;
