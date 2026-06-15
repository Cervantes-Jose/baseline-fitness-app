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
import { supabase, supabaseAnonKey } from '../supabaseClient';
import Nutrition from './Nutrition';
import MealBuilder from './MealBuilder';
import Fab from './Fab';
import HourPickerSheet from './HourPickerSheet';
import {
  UNIT_TO_GRAMS, SERVING_UNITS, baseGramsOf, servingToGrams, scaleOf, computeMacros,
  customServingScale, defaultServingOf, parseMicros, buildLoggedFields, CUSTOM_MICRO_FIELDS,
  buildMealComponent, sumMealComponents, mealAsFood,
} from './foodMath';

const FOOD_SEARCH_URL = 'https://xbvncbvoyatxbdhkkifq.supabase.co/functions/v1/food-search';

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

const FILTER_TABS = ['Add Food', 'Favorites', 'Custom Foods', 'Meals', 'Nutrition'];
// Pills shown at the top of the Add Food sheet (when not actively searching).
const ADD_FOOD_PILLS = [
  { id: 'recent', label: 'Recent' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'meals', label: 'Meals' },
  { id: 'custom', label: 'Custom Foods' },
];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── CALENDAR MODAL ─────────────────────────────────────────
function CalendarModal({ selected, onSelect, onClose }) {
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  // Lock background scroll while the calendar sheet is open (same pattern as the
  // other portal/overlay sheets) so the page behind doesn't scroll under it.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
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
// A single macro ring. Rendered as a borderless cell (flex:1) inside the combined macro
// tile, with vertical dividers between cells — see the MACRO CIRCLES section below.
function MacroCircle({ value, goal, color, trackColor, label, isCalories }) {
  const size = 62;
  const sw = 6;
  const radius = (size - sw) / 2;
  const circ = 2 * Math.PI * radius;
  const progress = Math.min(goal > 0 ? value / goal : 0, 1);
  const offset = circ - progress * circ;
  const pct = Math.round(progress * 100);

  return (
    <div style={{
      flex: 1, minWidth: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={trackColor} strokeWidth={sw} />
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={sw}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, textAlign: 'center' }}>
            {isCalories ? value : `${value}g`}
          </div>
          <div style={{ fontSize: 8, color: 'var(--text-muted)', lineHeight: 1 }}>
            /{isCalories ? goal : `${goal}g`}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5 }}>{pct}%</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>{label}</div>
    </div>
  );
}

// ─── SERVING / MACRO HELPERS ─────────────────────────────────
// ─── FOOD DETAIL VIEW ────────────────────────────────────────
function FoodDetailView({ food, serving, unit, servings, onServing, onUnit, onServings, onBack, hideBack, onAdd, edit, editing, onStartEdit, onEditField, onEditMicro, favorited, onToggleFavorite, hour, onHourChange, entryMode, entryDirty, addLabel }) {
  const [showAllMicros, setShowAllMicros] = useState(false);
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
  const [hourMenuOpen, setHourMenuOpen] = useState(false);   // hour-picker dropdown in the detail view

  const isCustom = !!edit;          // a custom food (has editable definition data)
  const editable = isCustom && editing;   // fields are currently shown as inputs
  const count = Number(servings) || 0;

  // Custom foods define macros for their saved serving (held in `edit`, which mirrors the
  // saved values in read mode). When editing, the tiles show that per-serving definition;
  // in read mode they scale by the serving size (relative to the defined serving) and the
  // number of servings — the same way any other food detail scales.
  const perServing = isCustom
    ? { calories: Number(edit.calories) || 0, protein: Number(edit.protein) || 0, carbs: Number(edit.carbs) || 0, fats: Number(edit.fats) || 0 }
    : null;
  const customScale = isCustom ? customServingScale(food, serving, unit) * count : 1;
  const macros = editable
    ? perServing
    : isCustom
      ? {
          calories: Math.round(perServing.calories * customScale),
          protein: Math.round(perServing.protein * customScale),
          carbs: Math.round(perServing.carbs * customScale),
          fats: Math.round(perServing.fats * customScale),
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

  // Custom food, read mode: show stored micros (scaled like the macros), hiding zeros.
  const customMicrosShown = isCustom && !editable
    ? CUSTOM_MICRO_FIELDS
        .map(m => ({ ...m, value: Math.round((Number(edit.micros[m.key]) || 0) * customScale * 10) / 10 }))
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

  // In edit mode, changing the serving size rescales the per-serving macros/micros
  // proportionally (e.g. 100 g / 360 cal → set 50 g → 180 cal). We scale from a base
  // captured when the field gains focus, so typing intermediate values doesn't compound
  // rounding errors. Clearing the field leaves the macros untouched until a real value.
  const sizeBaseRef = useRef(null);
  const captureSizeBase = () => {
    sizeBaseRef.current = {
      grams: servingToGrams(serving, unit, baseGramsOf(food)),
      calories: Number(edit?.calories) || 0,
      protein: Number(edit?.protein) || 0,
      carbs: Number(edit?.carbs) || 0,
      fats: Number(edit?.fats) || 0,
      micros: edit ? { ...edit.micros } : {},
    };
  };
  const changeServingSize = (val) => {
    onServing(val);
    if (!editable) return;
    const base = sizeBaseRef.current;
    if (!base || !(base.grams > 0)) return;
    const newGrams = servingToGrams(val, unit, baseGramsOf(food));
    if (!(newGrams > 0)) return;   // empty / 0 — wait for a real value before rescaling
    const r = newGrams / base.grams;
    onEditField('calories', String(Math.round(base.calories * r)));
    onEditField('protein', String(Math.round(base.protein * r)));
    onEditField('carbs', String(Math.round(base.carbs * r)));
    onEditField('fats', String(Math.round(base.fats * r)));
    CUSTOM_MICRO_FIELDS.forEach(m => {
      const bv = Number(base.micros[m.key]) || 0;
      if (bv > 0) onEditMicro(m.key, String(Math.round(bv * r * 10) / 10));
    });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          {hideBack ? (
            /* Opened from a main tab — no Back button; slide the sheet down to dismiss. */
            <div style={{ flexShrink: 0 }} />
          ) : (
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '15px', fontWeight: '600', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Back
            </button>
          )}
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
                {hour != null && (onHourChange ? (
                  /* Add mode: hour is an editable dropdown picker. */
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button onClick={() => setHourMenuOpen(o => !o)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-light)', color: 'var(--accent)', padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                      {HOURS[hour].label}
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" style={{ transform: hourMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <HourPickerSheet open={hourMenuOpen} hours={HOURS} value={hour}
                      onSelect={onHourChange} onClose={() => setHourMenuOpen(false)} />
                  </div>
                ) : (
                  /* Edit mode: hour shown read-only; use the Move button to change it. */
                  <span style={{ flexShrink: 0, background: 'var(--accent-light)', color: 'var(--accent)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>{HOURS[hour].label}</span>
                ))}
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
              <input type="number" inputMode="decimal" value={serving}
                onFocus={editable ? captureSizeBase : undefined}
                onChange={e => (editable ? changeServingSize(e.target.value) : onServing(e.target.value))}
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
          <button onClick={onAdd} className="btn-primary" style={{ width: '100%' }}>{editable ? 'Save Food' : (addLabel || 'Add Food')}</button>
        </div>
      )}
    </div>
  );
}

// ─── FOOD LOG ────────────────────────────────────────────────
function FoodLog({ showToast = () => {}, calorieGoal = 2000, proteinGoal = 180, carbsGoal = 200, fatsGoal = 60, onSelectModeChange = () => {}, workoutBarVisible = false }) {
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
  // Last portion (serving/unit/servings) used for each food, keyed by name. Lets re-adding
  // or editing a food default to what you last entered instead of the food's base serving.
  const [lastPortions, setLastPortions] = useState({});
  // Free-text filter for the Favorites / Custom Foods / Meals tabs (cleared on tab switch).
  const [listSearch, setListSearch] = useState('');
  // Which list the Add Food sheet shows when not actively searching.
  const [addFoodTab, setAddFoodTab] = useState('recent');   // 'recent' | 'favorites' | 'meals' | 'custom'

  // Favorited foods (snapshot of each food, keyed by name). Persisted in favorite_foods.
  const [favorites, setFavorites] = useState([]);

  // Saved meals (groups of foods logged as one entry, per serving). Persisted in `meals`.
  const [meals, setMeals] = useState([]);
  // The meal being built/edited (null = builder closed). Controlled so foods picked
  // from the Add Food sheet append into its components while the builder stays mounted.
  // Shape: { id|null, name, components:[...], servings: string }
  const [mealDraft, setMealDraft] = useState(null);
  // True while the Add Food sheet is picking a food *for the meal builder* (vs. logging).
  const [addFoodMealMode, setAddFoodMealMode] = useState(false);
  // Index of the meal component currently being re-edited (null = adding a new one). When
  // set, confirming the detail replaces that component instead of appending.
  const [editingMealComponentIdx, setEditingMealComponentIdx] = useState(null);

  // Barcode scanner (ZXing camera) + Open Food Facts lookup.
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);   // looking up a found barcode
  const [scannerError, setScannerError] = useState('');   // on-screen camera error (mobile debug)
  // Flashlight/torch — only some devices expose it (Android Chrome yes, iOS Safari no).
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
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
  const [moveMode, setMoveMode] = useState(false);              // select bar: picking a destination hour to move selected foods
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);

  // Custom foods (user-defined). Pinned at the top of the Add Food list.
  const [customFoods, setCustomFoods] = useState([]);
  // Custom-food detail data. null = not viewing a custom food. Shape:
  // { id|null, name, calories, protein, carbs, fats, micros: { [key]: string } }
  const [customEdit, setCustomEdit] = useState(null);
  const [customEditing, setCustomEditing] = useState(false);  // fields shown as editable inputs
  // True when the custom-food editor was opened from the main Custom Foods tab (vs. from
  // inside the Add Food sheet). On save we return to where it was opened from.
  const [customFromMain, setCustomFromMain] = useState(false);
  // True when the detail view was opened from a main tab (Favorites / Custom Foods)
  // rather than from inside the Add Food sheet. On Back we close the whole sheet so the
  // user returns to that main screen instead of landing on the Add Food list.
  const [detailFromMain, setDetailFromMain] = useState(false);
  // Main Custom Foods tab: quick rename/delete mode + in-progress name edits keyed by id.
  const [customEditMode, setCustomEditMode] = useState(false);
  const [nameDrafts, setNameDrafts] = useState({});

  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const searchDebounceRef = useRef(null);
  const searchAbortRef = useRef(null);

  const isToday = date.toDateString() === new Date().toDateString();
  const dateStr = date.toLocaleDateString();

  // Tell App.js when select/edit mode is active (move mode lives inside it) so it can
  // swap the main tab bar for the select bar (which replaces it at the bottom).
  // Reset on unmount so the tab bar isn't left hidden if the user navigates away.
  useEffect(() => {
    onSelectModeChange(selectMode);
    return () => onSelectModeChange(false);
  }, [selectMode, onSelectModeChange]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadFoods(); }, [date]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadFavorites(); loadCustomFoods(); loadMeals(); loadLastPortions(); }, []);

  // Leave the Custom Foods quick-edit mode when navigating away from that tab.
  useEffect(() => {
    if (activeFilter !== 'Custom Foods' && customEditMode) { setCustomEditMode(false); setNameDrafts({}); }
  }, [activeFilter, customEditMode]);

  // Long-press multi-select only applies to the main log timeline. Switching filter tabs
  // (Favorites/Custom Foods/Meals/Nutrition) moves off that view, so cancel any in-progress
  // selection — otherwise the fixed select bar lingers over an unrelated screen. (Leaving
  // the Food section entirely unmounts FoodLog, which clears it via the cleanup below.)
  useEffect(() => {
    setSelectMode(false); setSelectedEntries([]); setCopyMode(false); setMoveMode(false);
  }, [activeFilter]);

  // Reset the list filter whenever the tab changes so a stale query doesn't hide items.
  useEffect(() => { setListSearch(''); }, [activeFilter]);

  useEffect(() => {
    if (showAddFoodScreen) { loadRecentFoods(); loadCustomFoods(); loadFavorites(); loadLastPortions(); }
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
    // 600ms (not less): USDA calls take ~700ms, so a shorter delay lets the next
    // keystroke abort an in-flight request (logged as a 500) and burns an extra
    // rate-limit count per pause. Longer debounce = fewer aborts + less count burn.
    searchDebounceRef.current = setTimeout(() => searchFoods(query), 600);
    return () => clearTimeout(searchDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, showAddFoodScreen]);

  const loadFoods = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data, error } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', uid)
      .eq('date', dateStr)
      .order('created_at', { ascending: true });
    if (error) { setLoading(false); return; }
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
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from('food_entries')
      .select('name, calories, protein, carbs, fats')
      .eq('user_id', uid)
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

  // Build the "last portion per food" map from logged entries (newest first, first hit
  // per name wins). Lets openDetail/openCustomDetail default to your most recent portion.
  const loadLastPortions = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from('food_entries')
      .select('name, serving, unit, servings, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(500);
    if (!data) return;
    const map = {};
    for (const e of data) {
      if (e.name == null || map[e.name] || e.serving == null) continue;
      map[e.name] = { serving: Number(e.serving), unit: e.unit || 'g', servings: Number(e.servings) || 1 };
    }
    setLastPortions(map);
  };

  // Record the portion just logged/edited so the next open defaults to it (in-memory; the
  // DB row is the source of truth and rebuilds this on reload).
  const rememberPortion = (name, serving, unit, servings) => {
    if (!name) return;
    setLastPortions(prev => ({ ...prev, [name]: { serving: Number(serving) || 0, unit, servings: Number(servings) || 1 } }));
  };

  const loadCustomFoods = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from('custom_foods')
      .select('*')
      .eq('user_id', uid)
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
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from('favorite_foods')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (data) setFavorites(data.map(r => ({ id: r.id, name: r.name, isCustom: r.is_custom, food: r.food })));
  };

  // ─── Meals ─────────────────────────────────────────────────
  const loadMeals = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (data) setMeals(data.map(m => ({
      ...m,
      components: Array.isArray(m.components) ? m.components : (typeof m.components === 'string' ? JSON.parse(m.components) : []),
      micros: Array.isArray(m.micros) ? m.micros : (typeof m.micros === 'string' ? JSON.parse(m.micros) : []),
    })));
  };

  const openMealBuilder = (meal = null) => {
    setAddFoodMealMode(false);
    setMealDraft(meal
      ? { id: meal.id, name: meal.name, components: meal.components || [], servings: String(meal.servings || 1) }
      : { id: null, name: '', components: [], servings: '1' });
  };
  const closeMealBuilder = () => { setMealDraft(null); setAddFoodMealMode(false); setEditingMealComponentIdx(null); };

  // From the builder's "Add Food": open the Add Food sheet in meal mode (picking a
  // food appends it to the meal instead of logging it). The builder stays mounted below.
  const openMealFoodPicker = () => {
    setAddFoodMealMode(true);
    setEditingMealComponentIdx(null);   // picking a new food, not editing an existing component
    setSearchQuery('');
    setDetailFood(null);
    setCustomEdit(null);
    setCustomEditing(false);
    setAddFoodTab('recent');
    setAddFoodDragY(0);
    setShowAddFoodScreen(true);
  };

  // Tap an existing meal component to re-edit it: reopen the detail screen with the
  // stored food + serving inputs. Only components saved with a `source` (added after the
  // edit feature shipped) are editable; older ones are tap-to-remove only.
  const openMealComponent = (idx) => {
    const c = mealDraft?.components[idx];
    if (!c || !c.source) return;
    setAddFoodMealMode(true);
    setEditingMealComponentIdx(idx);
    setAddFoodDragY(0);
    setShowAddFoodScreen(true);
    if (c.source.isCustom) openCustomDetail(c.source, false);
    else openDetail(c.source);
    // Restore the exact serving/unit/servings that were logged (override the opener's
    // last-portion/default seeding).
    setDetailServing(String(c.serving));
    setDetailUnit(c.unit);
    setDetailServings(String(c.servings != null ? c.servings : 1));
  };

  // Append (or, when editing, replace) the food currently open in the detail screen.
  const addDetailToMeal = () => {
    const food = detailFood;
    if (!food) return;
    const component = buildMealComponent(food, Number(detailServing) || 0, detailUnit, Number(detailServings) || 1);
    setMealDraft(prev => {
      if (!prev) return prev;
      const components = editingMealComponentIdx != null
        ? prev.components.map((c, i) => (i === editingMealComponentIdx ? component : c))
        : [...prev.components, component];
      return { ...prev, components };
    });
    setEditingMealComponentIdx(null);
    setDetailFood(null);
    setCustomEdit(null);
    setCustomEditing(false);
    closeAddFood();   // slide the picker away, revealing the builder
  };

  const saveMeal = async () => {
    if (!mealDraft) return;
    const t = sumMealComponents(mealDraft.components);
    const servings = Number(mealDraft.servings) > 0 ? Number(mealDraft.servings) : 1;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const payload = {
      name: mealDraft.name.trim(), components: mealDraft.components,
      total_grams: t.grams, servings,
      calories: t.calories, protein: t.protein, carbs: t.carbs, fats: t.fats,
      micros: t.micros,
    };
    const { error } = mealDraft.id
      ? await supabase.from('meals').update(payload).eq('id', mealDraft.id).eq('user_id', uid)
      : await supabase.from('meals').insert([{ ...payload, user_id: uid }]);
    if (error) { return; }
    await loadMeals();
    closeMealBuilder();
    showToast(mealDraft.id ? 'Meal updated' : 'Meal saved', null, null);
  };

  const deleteMeal = async (meal) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    setMeals(prev => prev.filter(m => m.id !== meal.id));
    closeMealBuilder();
    const { error } = await supabase.from('meals').delete().eq('id', meal.id).eq('user_id', uid);
    if (error) { loadMeals(); }
  };

  // Log a saved meal: open the Add Food sheet straight into its detail at one serving.
  const openMealDetail = (meal) => {
    setAddFoodHour(currentHour);
    setAddFoodDragY(0);
    setShowAddFoodScreen(true);
    openDetail(mealAsFood(meal));
  };

  const isFavorite = (name) => favorites.some(f => f.name === name);

  // Persist a favorite (snapshot of the food). No-op if already favorited.
  const addFavorite = async (food) => {
    if (!food?.name || isFavorite(food.name)) return;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const payload = { name: food.name, is_custom: !!food.isCustom, food, user_id: uid };
    const { data, error } = await supabase.from('favorite_foods').insert([payload]).select().single();
    if (error) { return; }
    setFavorites(prev => [{ id: data.id, name: data.name, isCustom: data.is_custom, food: data.food }, ...prev]);
  };

  const removeFavorite = async (name) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    setFavorites(prev => prev.filter(f => f.name !== name));
    await supabase.from('favorite_foods').delete().eq('name', name).eq('user_id', uid);
  };

  const toggleFavorite = (food) => {
    if (isFavorite(food.name)) removeFavorite(food.name);
    else addFavorite(food);
  };

  // Open the detail page for a custom food. Pass null to create a new one (starts editable);
  // existing foods open read-only unless startEditing is true (··· Edit / top-right Edit).
  const openCustomDetail = (food, startEditing = false) => {
    setCustomFromMain(false);   // opened from within the sheet; openCustomFoodDetail overrides to true
    setDetailFromMain(false);   // ditto for Back behavior; main-tab openers override to true
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
    // A custom food's serving SIZE is part of its definition (saved_serving/saved_unit),
    // so always show that — never a previously logged serving, which would mask edits to
    // the size and make saves look like they didn't take. Only the number-of-servings
    // count is remembered from the last log.
    const last = existing ? lastPortions[food?.name] : null;
    const { serving, unit } = defaultServingOf(food || {});
    setDetailServing(String(serving));
    setDetailUnit(unit);
    setDetailServings(String(last?.servings || 1));
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
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
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
      ? await supabase.from('custom_foods').update(payload).eq('id', e.id).eq('user_id', uid).select().single()
      : await supabase.from('custom_foods').insert([{ ...payload, user_id: uid }]).select().single();
    if (error) { return; }

    const food = { ...row, isCustom: true, micros, savedServing: serving, savedUnit: unit };
    setCustomFoods(prev => e.id ? prev.map(f => (f.id === e.id ? food : f)) : [food, ...prev]);

    // New custom foods are automatically favorited; edits refresh the favorite snapshot.
    if (!e.id) {
      addFavorite(food);
    } else if (isFavorite(name)) {
      setFavorites(prev => prev.map(f => (f.name === name ? { ...f, food } : f)));
      supabase.from('favorite_foods').update({ food }).eq('name', name).eq('user_id', uid);
    }

    // Opened from the main Custom Foods tab: just save to the library and return to
    // that screen — don't stage it into the log or stay on the Add Food sheet.
    if (customFromMain) {
      setCustomEdit(null);
      setCustomEditing(false);
      setDetailFood(null);
      closeAddFood();
      return;
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

  // Read mode: stage an already-saved custom food into the log. Scale by the serving size
  // (relative to the food's defined serving) and the number of servings — matches the
  // detail-view tiles and buildLoggedFields.
  const addCustomToLog = () => {
    const e = customEdit;
    if (!e) return;
    const name = (e.name || '').trim() || 'Custom Food';
    const serving = Number(detailServing) || 0;
    const servings = Number(detailServings) || 0;
    const sc = customServingScale(detailFood, serving, detailUnit) * servings;
    const adjusted = {
      calories: Math.round((Number(e.calories) || 0) * sc),
      protein: Math.round((Number(e.protein) || 0) * sc),
      carbs: Math.round((Number(e.carbs) || 0) * sc),
      fats: Math.round((Number(e.fats) || 0) * sc),
    };
    setCheckedFoods(prev => ({ ...prev, [name]: { food: detailFood, serving, unit: detailUnit, servings, adjustedMacros: adjusted } }));
    setCustomEdit(null);
    setCustomEditing(false);
    setDetailFood(null);
  };

  const deleteCustomFood = async (food) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    setCustomFoods(prev => prev.filter(f => f.id !== food.id));
    setCheckedFoods(prev => { const n = { ...prev }; delete n[food.name]; return n; });
    if (isFavorite(food.name)) removeFavorite(food.name);
    await supabase.from('custom_foods').delete().eq('id', food.id).eq('user_id', uid);
  };

  // Quick-rename from the Custom Foods edit mode. No-op when the name is unchanged.
  // Keeps the favorite (which is keyed by name) in sync if this food is favorited.
  const commitRename = async (food, raw) => {
    const newName = (raw ?? '').trim() || 'Custom Food';
    if (newName === food.name) return;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    setCustomFoods(prev => prev.map(f => (f.id === food.id ? { ...f, name: newName } : f)));
    const { error } = await supabase.from('custom_foods').update({ name: newName }).eq('id', food.id).eq('user_id', uid);
    if (error) { return; }
    if (isFavorite(food.name)) {
      const snap = { ...food, name: newName };
      setFavorites(prev => prev.map(fv => (fv.name === food.name ? { ...fv, name: newName, food: snap } : fv)));
      supabase.from('favorite_foods').update({ name: newName, food: snap }).eq('name', food.name).eq('user_id', uid);
    }
  };

  // Leave edit mode, flushing any pending name edits first.
  const exitCustomEditMode = async () => {
    await Promise.all(customFoods.map(f => commitRename(f, nameDrafts[f.id] ?? f.name)));
    setNameDrafts({});
    setCustomEditMode(false);
  };

  const searchFoods = async (query) => {
    if (searchAbortRef.current) searchAbortRef.current.abort();
    searchAbortRef.current = new AbortController();
    setSearchLoading(true);
    setSearchError(null);
    try {
      // Send the user's JWT (not the public anon key) so the function can
      // identify the account and apply per-user rate limits server-side.
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setSearchError('Search unavailable'); setSearchResults(null); return; }
      const res = await fetch(
        `${FOOD_SEARCH_URL}?query=${encodeURIComponent(query)}`,
        { headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseAnonKey }, signal: searchAbortRef.current.signal }
      );
      if (res.status === 429) {
        setSearchError('Too many searches — please slow down and try again in a moment.');
        setSearchResults(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : (data.foods || []));
    } catch (err) {
      if (err.name === 'AbortError') return;
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
      async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) return;
        await supabase.from('food_entries').delete().eq('id', id).eq('user_id', uid);
      }
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
    else if (moveMode) moveSelectedToHour(entry.hour);
    else if (selectMode) toggleSelectEntry(entry);
    else openLoggedFood(entry);
  };

  const exitSelectMode = () => { setSelectMode(false); setSelectedEntries([]); setCopyMode(false); setMoveMode(false); };

  const bulkDeleteSelected = async () => {
    const ids = selectedEntries.map(e => e.id);
    if (ids.length === 0) return;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    setFoods(prev => {
      const next = {};
      for (const [h, list] of Object.entries(prev)) next[h] = list.filter(f => !ids.includes(f.id));
      return next;
    });
    exitSelectMode();
    const { error } = await supabase.from('food_entries').delete().eq('user_id', uid).in('id', ids);
    if (error) { loadFoods(); }
  };

  // Copy the selected foods to the tapped hour on the currently-shown date.
  const copyToHour = async (hour) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const inserts = selectedEntries.map(e => ({
      name: e.name, calories: e.calories, protein: e.protein, carbs: e.carbs, fats: e.fats,
      hour, date: dateStr, serving: e.serving ?? null, unit: e.unit ?? null, servings: e.servings ?? null, food: e.food ?? null,
      user_id: uid,
    }));
    const count = inserts.length;
    exitSelectMode();
    const { error } = await supabase.from('food_entries').insert(inserts);
    if (error) { return; }
    loadFoods();
    showToast(`Copied ${count} food${count !== 1 ? 's' : ''} to ${HOURS[hour].label}`, null, null);
  };

  // Move the selected foods (long-press bar) to the tapped hour on the shown date.
  const moveSelectedToHour = async (hour) => {
    const ids = selectedEntries.map(e => e.id);
    const count = ids.length;
    exitSelectMode();
    if (count === 0) return;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { error } = await supabase.from('food_entries').update({ hour, date: dateStr }).eq('user_id', uid).in('id', ids);
    if (error) { loadFoods(); return; }
    loadFoods();
    showToast(`Moved ${count} food${count !== 1 ? 's' : ''} to ${HOURS[hour].label}`, null, null);
  };

  const openAddFood = (hour) => { setAddFoodHour(hour); setAddFoodDragY(0); setShowAddFoodScreen(true); };

  // From the Favorites tab: open the Add Food sheet straight into this food's detail.
  const openFavoriteDetail = (fav) => {
    setAddFoodHour(currentHour);
    setAddFoodDragY(0);
    setShowAddFoodScreen(true);
    if (fav.isCustom) openCustomDetail(fav.food, false);
    else openDetail(fav.food);
    setDetailFromMain(true);   // override: Back returns to the main Favorites screen
  };

  // From the main Custom Foods tab: open the Add Food sheet straight into a custom
  // food's detail (view, or edit when startEditing). Safe to call when the sheet is
  // already open — setShowAddFoodScreen(true) is a no-op in that case.
  const openCustomFoodDetail = (food, startEditing = false) => {
    setAddFoodHour(currentHour);
    setAddFoodDragY(0);
    setShowAddFoodScreen(true);
    openCustomDetail(food, startEditing);
    setCustomFromMain(true);   // override: this open originated on the main Custom Foods tab
    setDetailFromMain(true);   // override: Back returns to the main Custom Foods screen
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
    // Older rows (logged before servings was stored) collapse to 1; the snapshot already
    // bakes the count into its total, so 1 reproduces them correctly.
    const servings = String(entry.servings != null ? entry.servings : 1);
    setAddFoodHour(entry.hour);
    setAddFoodDragY(0);
    setShowAddFoodScreen(true);
    setCustomEdit(null);
    setCustomEditing(false);
    setDetailServing(serving);
    setDetailUnit(unit);
    setDetailServings(servings);
    setEditingEntry({ id: entry.id, hour: entry.hour, origServing: serving, origUnit: unit, origServings: servings });
    setDetailFood(snap);
  };

  // Save changes to a logged entry's serving (recompute macros + refresh the snapshot).
  const saveLoggedEntry = async () => {
    const e = editingEntry;
    if (!e) return;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const food = detailFood;
    const serving = Number(detailServing) || 0;
    const unit = detailUnit;
    const servings = Number(detailServings) || 0;
    const macros = computeMacros(food, serving, unit, servings);
    const fields = buildLoggedFields(food, serving, unit, servings, macros);
    const update = { calories: macros.calories, protein: macros.protein, carbs: macros.carbs, fats: macros.fats, ...fields };
    const { error } = await supabase.from('food_entries').update(update).eq('id', e.id).eq('user_id', uid);
    if (error) { return; }
    rememberPortion(food.name, fields.serving, fields.unit, fields.servings);
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
    setAddFoodMealMode(false);       // leave meal-pick mode if it was on
    setTimeout(() => {               // unmount + reset after the slide-out finishes
      setShowAddFoodScreen(false);
      setSearchQuery('');
      setCheckedFoods({});
      setDetailFood(null);
      setDetailFromMain(false);
      setCustomEdit(null);
      setCustomEditing(false);
      setCustomFromMain(false);
      setEditingMealComponentIdx(null);
      setEditingEntry(null);
      setSearchResults(null);
      setSearchError(null);
      setAddFoodTab('recent');
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

      // The stream is now attached to the video element. Check whether the camera
      // track can drive the torch; if so, reveal the flashlight toggle.
      const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.() || {};
      setTorchSupported(!!caps.torch);
      setTorchOn(false);
    } catch (err) {
      setScannerError(err.message || err.toString() || 'Unknown error');
      // Keep the overlay open so the on-screen error is visible (close via the × button).
      showToast('Camera not available', null, null);
    }
  };

  // Toggle the camera torch via the live video track. The track turns the light off
  // on its own when the stream stops, so we just track on/off state here.
  const toggleTorch = async () => {
    const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      // torch unsupported on this device — ignore
    }
  };

  const stopScanner = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    setScannerError('');
    setTorchOn(false);
    setTorchSupported(false);
    setShowScanner(false);
  };

  const handleBarcodeResult = async (barcode) => {
    setScanning(true);
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`);
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
    } catch {
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
      const last = lastPortions[food.name];
      const { serving, unit } = last || defaultServingOf(food);
      const servings = last?.servings || 1;
      next[food.name] = { food, serving, unit, servings, adjustedMacros: computeMacros(food, serving, unit, servings) };
      return next;
    });
  };

  const openDetail = (food) => {
    // Default to the last portion used for this food; fall back to its base serving.
    // Meals keep their own per-serving basis, so don't override them.
    const last = !food?.isMeal ? lastPortions[food?.name] : null;
    const { serving, unit } = last || defaultServingOf(food);
    setDetailServing(String(serving));
    setDetailUnit(unit);
    setDetailServings(String(last?.servings || 1));
    setCustomEdit(null);
    setCustomEditing(false);
    setDetailFromMain(false);   // opened from within the sheet; main-tab openers override to true
    setDetailFood(food);
  };

  // Confirm serving from the detail screen: save the preferred serving back to the
  // source list and add the food (with adjusted macros) to checkedFoods.
  const confirmDetail = async () => {
    const food = detailFood;
    if (!food) return;
    const serving = Number(detailServing) || 0;
    const unit = detailUnit;
    const servings = Number(detailServings) || 0;
    const macros = computeMacros(food, serving, unit, servings);
    // A saved meal logs as one entry — don't write it into recents/savedServing.
    if (food.isMeal) {
      setCheckedFoods(prev => ({ ...prev, [food.name]: { food, serving, unit, servings, adjustedMacros: macros } }));
      setDetailFood(null);
      return;
    }
    // We store savedServing/savedUnit rather than overwriting servingSize/servingSizeUnit
    // so the per-serving macro basis used for scaling stays intact. Custom foods persist
    // these to the row (remembered across sessions). Recent/USDA foods only remember the
    // serving for the current session — food_entries stores adjusted-total macros with no
    // per-base reference, so a saved serving can't be re-scaled correctly there.
    if (food.isCustom) {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      setCustomFoods(prev => prev.map(f => (f.id === food.id ? { ...f, savedServing: serving, savedUnit: unit } : f)));
      supabase.from('custom_foods').update({ saved_serving: serving, saved_unit: unit }).eq('id', food.id).eq('user_id', uid);
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
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const inserts = items.map(({ food, serving, unit, servings, adjustedMacros }) => ({
      name: food.name,
      calories: adjustedMacros.calories,
      protein: adjustedMacros.protein,
      carbs: adjustedMacros.carbs,
      fats: adjustedMacros.fats,
      hour: addFoodHour,
      date: dateStr,
      user_id: uid,
      ...buildLoggedFields(food, serving, unit, servings ?? 1, adjustedMacros),
    }));
    const { data, error } = await supabase.from('food_entries').insert(inserts).select();
    if (error) { return; }
    const newFoods = { ...foods };
    data.forEach(entry => {
      if (!newFoods[entry.hour]) newFoods[entry.hour] = [];
      newFoods[entry.hour].push(entry);
      // Remember each logged portion (matches what loadLastPortions reads back).
      rememberPortion(entry.name, entry.serving, entry.unit, entry.servings);
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

  // ─── Add Food sheet row renderers ───────────────────────────
  // Extracted so the pill tabs (Recent / Favorites / Meals / Custom) and the
  // search results can all reuse the same row markup without duplication.
  const renderCustomRow = (food) => {
    const checked = !!checkedFoods[food.name];
    return (
      <div key={'custom-' + food.id} onClick={() => openCustomDetail(food, false)} style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer',
      }}>
        {!addFoodMealMode && (
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
            <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: '8px' }}>Custom</span>
            {isFavorite(food.name) && <span style={{ fontSize: '10px', fontWeight: '700', color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: '8px', whiteSpace: 'nowrap' }}>★ Favorite</span>}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {food.calories} cal · {food.protein}g P · {food.carbs}g C · {food.fats}g F
          </div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    );
  };

  const renderFoodRow = (food, showCheckbox) => {
    const checked = !!checkedFoods[food.name];
    const ds = defaultServingOf(food);
    const dm = computeMacros(food, ds.serving, ds.unit);
    return (
      <div key={food.name + (food.brandOwner || '')} onClick={() => openDetail(food)} style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer',
      }}>
        {showCheckbox && !addFoodMealMode && (
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
  };

  // Filter a list of {name} items by the active list search query (no-op when empty).
  const filterByName = (arr) => {
    const q = listSearch.trim().toLowerCase();
    return q ? arr.filter(x => (x.name || '').toLowerCase().includes(q)) : arr;
  };

  // Search bar shown atop the Favorites / Custom Foods / Meals tabs (matches the exercise picker).
  const renderListSearch = (placeholder) => (
    <input
      value={listSearch}
      onChange={e => setListSearch(e.target.value)}
      placeholder={placeholder}
      className="input"
      style={{ width: '100%', marginBottom: 10 }}
    />
  );

  const renderFavoriteRow = (fav) => {
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
            <span style={{ fontSize: 10, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: 8, whiteSpace: 'nowrap' }}>★ Favorite</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {Math.round(Number(f.calories) || 0)} cal · {Math.round(Number(f.protein) || 0)}g P · {Math.round(Number(f.carbs) || 0)}g C · {Math.round(Number(f.fats) || 0)}g F
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); removeFavorite(fav.name); }} aria-label="Remove favorite"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 18, padding: '2px 6px', lineHeight: 1, flexShrink: 0 }}>★</button>
      </div>
    );
  };

  const emptyState = (text) => (
    <p style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', padding: '40px 20px' }}>{text}</p>
  );

  // Meal row, log style (Favorites + Meals pill in the Add Food sheet): per-serving
  // macros under the name, "per serving" on the right. Tapping logs it at one serving.
  const renderMealLogRow = (meal) => {
    const s = Number(meal.servings) > 0 ? Number(meal.servings) : 1;
    const per = (v) => Math.round((Number(v) || 0) / s);
    return (
      <div key={'mealrow-' + meal.id} onClick={() => openMealDetail(meal)} style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{meal.name}</span>
            <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: '8px' }}>Meal</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {per(meal.calories)} cal · {per(meal.protein)}g P · {per(meal.carbs)}g C · {per(meal.fats)}g F
          </div>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>per serving</span>
      </div>
    );
  };

  // Meal row, manage style (Meals tab): total weight · serving size · servings.
  // Tapping opens the builder to edit it.
  const renderMealManageRow = (meal) => {
    const s = Number(meal.servings) > 0 ? Number(meal.servings) : 1;
    const perServingGrams = Math.round((Number(meal.total_grams) || 0) / s);
    return (
      <div key={'mealmanage-' + meal.id} onClick={() => openMealBuilder(meal)} style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{meal.name}</span>
            <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: '8px' }}>Meal</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {meal.total_grams}g total · {perServingGrams}g/serving · {s} serving{s !== 1 ? 's' : ''}
          </div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    );
  };

  // Break out of the .content wrapper's 20px padding
  return (
    <div style={{ margin: '-20px', position: 'relative' }}>

      {/* Calendar button — pinned to the top-right of the content (scrolls away
          with the page, rather than floating fixed over the whole screen). */}
      <button onClick={() => setShowCalendar(true)} style={{
        position: 'absolute', top: 0, right: 0, zIndex: 150,
        padding: '26px 20px 8px',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--accent)', display: 'flex', alignItems: 'center',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/>
          <path d="M16 2v4M8 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M3 10h18" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </button>

      {/* ─── DATE NAV ───────────────────────────────────────── */}
      {/* Extra horizontal padding pulls the ‹ › arrows inward so the right arrow
          clears the fixed calendar icon at the top-right. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '28px 56px 8px',
      }}>
        <button onClick={() => changeDate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 22, padding: '2px 8px', lineHeight: 1,
        }}>‹</button>
        {/* Tapping the date jumps back to today when viewing any other day. */}
        <button onClick={() => { if (!isToday) setDate(new Date()); }} disabled={isToday} style={{
          background: 'none', border: 'none', padding: '2px 8px',
          fontWeight: 600, fontSize: 15, color: 'var(--accent)',
          cursor: isToday ? 'default' : 'pointer',
        }}>{navDateText}</button>
        <button onClick={() => changeDate(1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 22, padding: '2px 8px', lineHeight: 1,
        }}>›</button>
      </div>

      {/* ─── MACRO CIRCLES ──────────────────────────────────── */}
      {/* One combined tile with vertical dividers between rings (like the workout stats tile). */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '14px 4px',
          display: 'flex', alignItems: 'center',
        }}>
          {[
            { value: totals.calories, goal: calorieGoal, color: '#3B82F6', trackColor: '#DBEAFE', label: 'Calories', isCalories: true },
            { value: totals.protein,  goal: proteinGoal, color: '#22C55E', trackColor: '#DCFCE7', label: 'Protein' },
            { value: totals.fats,     goal: fatsGoal,    color: '#3B82F6', trackColor: '#DBEAFE', label: 'Fat' },
            { value: totals.carbs,    goal: carbsGoal,   color: '#EAB308', trackColor: '#FEF9C3', label: 'Carbs' },
          ].map((m, i) => (
            <React.Fragment key={m.label}>
              {i > 0 && <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '4px 0' }} />}
              <MacroCircle {...m} />
            </React.Fragment>
          ))}
        </div>
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
                if (tab === 'Add Food' || tab === 'Favorites' || tab === 'Custom Foods' || tab === 'Nutrition' || tab === 'Meals') setActiveFilter(tab);
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
          {favorites.length === 0 && meals.length === 0
            ? emptyState('No favorites yet. Tap a food and choose “Add to Favorites” to see it here.')
            : <>
                {renderListSearch('Search favorites...')}
                {(() => {
                  const fm = filterByName(meals), ff = filterByName(favorites);
                  return fm.length === 0 && ff.length === 0
                    ? emptyState('No favorites match your search.')
                    : <>{fm.map(renderMealLogRow)}{ff.map(renderFavoriteRow)}</>;
                })()}
              </>}
        </div>
      ) : activeFilter === 'Meals' ? (
        /* ─── MEALS LIST ─────────────────────────────────────── */
        <div style={{ padding: '8px 20px 40px' }}>
          {meals.length === 0
            ? emptyState('No meals yet. Tap “+ Add Meal” to build one from your foods.')
            : <>
                {renderListSearch('Search meals...')}
                {(() => {
                  const fm = filterByName(meals);
                  return fm.length === 0
                    ? emptyState('No meals match your search.')
                    : fm.map(renderMealManageRow);
                })()}
              </>}
        </div>
      ) : activeFilter === 'Custom Foods' ? (
        /* ─── CUSTOM FOODS LIST ──────────────────────────────── */
        <div style={{ padding: '8px 20px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
            {customFoods.length > 0 && (
              <button onClick={() => (customEditMode ? exitCustomEditMode() : setCustomEditMode(true))}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 15, fontWeight: 600, padding: '4px 0', flexShrink: 0 }}>
                {customEditMode ? 'Done' : 'Edit'}
              </button>
            )}
          </div>
          {customFoods.length === 0 ? (
            emptyState('No custom foods yet. Tap “+ Add Custom Food” to create one.')
          ) : (() => {
            const fc = filterByName(customFoods);
            return <>
              {renderListSearch('Search custom foods...')}
              {fc.length === 0
                ? emptyState('No custom foods match your search.')
                : fc.map(food => (
            customEditMode ? (
              /* Edit mode: inline rename + quick delete. */
              <div key={'mcustom-' + food.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <input
                  value={nameDrafts[food.id] ?? food.name}
                  onChange={(e) => setNameDrafts(prev => ({ ...prev, [food.id]: e.target.value }))}
                  onBlur={() => commitRename(food, nameDrafts[food.id] ?? food.name)}
                  aria-label="Custom food name"
                  style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', outline: 'none', padding: '2px 0' }} />
                <button onClick={() => deleteCustomFood(food)} aria-label="Delete custom food"
                  style={{ background: 'none', border: 'none', color: '#ff4444', fontSize: 13, fontWeight: 600, padding: '4px 6px', cursor: 'pointer', flexShrink: 0 }}>Delete</button>
              </div>
            ) : (
              <div key={'mcustom-' + food.id} onClick={() => openCustomFoodDetail(food, false)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{food.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: 8 }}>Custom</span>
                    {isFavorite(food.name) && <span style={{ fontSize: 10, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: 8, whiteSpace: 'nowrap' }}>★ Favorite</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {food.calories} cal · {food.protein}g P · {food.carbs}g C · {food.fats}g F
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )
          ))}
            </>;
          })()}
        </div>
      ) : activeFilter === 'Nutrition' ? (
        <Nutrition selectedDate={date} />
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

                  {/* Card — also a copy/move target while picking a destination hour */}
                  <div onClick={() => { if (copyMode) copyToHour(h.value); else if (moveMode) moveSelectedToHour(h.value); }} style={{
                    flex: 1, background: isNow ? 'var(--accent-light)' : 'var(--card)',
                    borderRadius: 12,
                    border: (copyMode || moveMode) ? '1px dashed var(--accent)' : (isNow ? '1px solid var(--accent)' : '1px solid var(--border)'),
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                    padding: '14px 16px',
                    cursor: (copyMode || moveMode) ? 'pointer' : 'default',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={(e) => { e.stopPropagation(); copyMode ? copyToHour(h.value) : moveMode ? moveSelectedToHour(h.value) : openAddFood(h.value); }} style={{
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
                          // Portion added, e.g. "50g" or "50g ×3" (omit for older rows missing it).
                          const portion = f.serving != null
                            ? `${Math.round((Number(f.serving) || 0) * 100) / 100}${f.unit || 'g'}${Number(f.servings) > 1 ? ` ×${Number(f.servings)}` : ''}`
                            : null;
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
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{f.calories} cal · {f.protein}g P · {f.carbs}g C · {f.fats}g F{portion ? ` · ${portion}` : ''}</div>
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
              hour={addFoodHour}
              onHourChange={editingEntry ? undefined : setAddFoodHour}
              entryMode={!!editingEntry}
              entryDirty={!!editingEntry && (detailServing !== editingEntry.origServing || detailUnit !== editingEntry.origUnit || detailServings !== editingEntry.origServings)}
              hideBack={detailFromMain}
              onBack={() => {
                // Editing an existing meal component: cancel back to the builder, not the
                // food picker list (there was no list step to return to).
                if (editingMealComponentIdx != null) { setEditingMealComponentIdx(null); closeAddFood(); return; }
                setDetailFood(null); setCustomEdit(null); setCustomEditing(false); setEditingEntry(null);
              }}
              addLabel={addFoodMealMode ? (editingMealComponentIdx != null ? 'Update Food' : 'Add to Meal') : undefined}
              onAdd={(addFoodMealMode && !customEditing) ? addDetailToMeal : (editingEntry ? saveLoggedEntry : (customEditing ? saveCustomDetail : (customEdit ? addCustomToLog : confirmDetail)))}
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
              <HourPickerSheet open={hourMenuOpen} hours={HOURS} value={addFoodHour}
                onSelect={setAddFoodHour} onClose={() => setHourMenuOpen(false)} />
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

          {/* Pills — pick which list to show. Hidden while actively searching. */}
          {!isSearchActive && (
            <div style={{ display: 'flex', gap: 8, padding: '0 20px 12px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {ADD_FOOD_PILLS.map(p => {
                const active = addFoodTab === p.id;
                return (
                  <button key={p.id} className={active ? '' : 'fl-tab-inactive'} onClick={() => setAddFoodTab(p.id)}
                    style={{ flexShrink: 0, padding: '7px 16px', borderRadius: 20, border: 'none', background: active ? 'var(--accent)' : undefined, color: active ? '#fff' : 'var(--text-primary)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
            {isSearchActive ? (
              /* Search overrides the pills: custom matches first, then live results. */
              <>
                {displayedCustomFoods.map(renderCustomRow)}
                {searchError && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                    {searchError} — showing recent foods
                  </p>
                )}
                {(searchError || (searchResults && searchResults.length > 0)) && (
                  <p className="section-title" style={{ marginBottom: '4px', fontWeight: 800, color: 'var(--text-secondary)' }}>{searchError ? 'Recent' : 'Results'}</p>
                )}
                {!searchLoading && !searchError && searchResults && searchResults.length === 0 && (
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>No results found</p>
                )}
                {displayedFoods.map(food => renderFoodRow(food, !!searchError))}
              </>
            ) : addFoodTab === 'recent' ? (
              <>
                <p className="section-title" style={{ marginBottom: '4px', fontWeight: 800, color: 'var(--text-secondary)' }}>Recent</p>
                {displayedFoods.length === 0
                  ? emptyState('No recent foods yet. Search above or add a custom food.')
                  : displayedFoods.map(food => renderFoodRow(food, true))}
              </>
            ) : addFoodTab === 'favorites' ? (
              (favorites.length === 0 && (addFoodMealMode || meals.length === 0))
                ? emptyState('No favorites yet. Open a food and choose “Add to Favorites”.')
                : <>
                    {!addFoodMealMode && meals.map(renderMealLogRow)}
                    {favorites.map(renderFavoriteRow)}
                  </>
            ) : addFoodTab === 'custom' ? (
              customFoods.length === 0
                ? emptyState('No custom foods yet. Tap “+ Add Custom Food” above.')
                : customFoods.map(renderCustomRow)
            ) : (
              /* Meals pill */
              addFoodMealMode
                ? emptyState('A meal can’t be added inside another meal.')
                : meals.length === 0
                  ? emptyState('No meals yet. Open the Meals tab to build one.')
                  : meals.map(renderMealLogRow)
            )}
          </div>

          {checkedCount > 0 && !addFoodMealMode && (
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
        </div>
      )}

      {/* Meal builder — full-screen page below the Add Food sheet (so meal-mode picking layers on top) */}
      {mealDraft && (
        <MealBuilder
          draft={mealDraft}
          onChange={setMealDraft}
          onAddFood={openMealFoodPicker}
          onEditComponent={openMealComponent}
          onSave={saveMeal}
          onClose={closeMealBuilder}
          onDelete={mealDraft.id ? () => deleteMeal(mealDraft) : null}
        />
      )}

      {/* Barcode camera scanner — full-screen, above the Add Food sheet */}
      {showScanner && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'black', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={stopScanner} aria-label="Close scanner" style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'white', fontSize: 28, cursor: 'pointer', zIndex: 2 }}>×</button>
          {torchSupported && (
            <button onClick={toggleTorch} aria-label={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
              style={{ position: 'absolute', top: 20, left: 20, zIndex: 2, width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: torchOn ? '#FACC15' : 'rgba(255,255,255,0.18)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={torchOn ? '#1F2937' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </button>
          )}
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

      {/* ─── SELECT / COPY BAR ──────────────────────────────────
          Replaces the main bottom tab bar while in edit mode (App.js hides
          the tab bar via onSelectModeChange). Positioned to match the tab
          bar exactly (bottom: 6px, same width/radius) and animates in by
          fading + expanding from the middle outward. Stays visible the
          whole time edit mode is on, even with nothing selected. */}
      {selectMode && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 6, width: '100%', maxWidth: 'calc(100% - 32px)', zIndex: 350, animation: 'selectBarIn 0.22s ease-out' }}>
          <div style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.18)', padding: '12px 14px' }}>
            {(copyMode || moveMode) && (
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>
                Tap an hour to {copyMode ? 'copy' : 'move'} {selectedEntries.length} food{selectedEntries.length !== 1 ? 's' : ''} there — switch the date first to {copyMode ? 'copy' : 'move'} to another day.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {(copyMode || moveMode) ? (
                <button onClick={() => { setCopyMode(false); setMoveMode(false); }} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              ) : (
                <>
                  <button onClick={bulkDeleteSelected} disabled={selectedEntries.length === 0}
                    style={{ flex: 1, background: '#ff4444', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 14, cursor: selectedEntries.length === 0 ? 'default' : 'pointer', opacity: selectedEntries.length === 0 ? 0.4 : 1 }}>
                    Delete ({selectedEntries.length})
                  </button>
                  <button onClick={() => setCopyMode(true)} disabled={selectedEntries.length === 0}
                    className="btn-secondary" style={{ flex: 1, opacity: selectedEntries.length === 0 ? 0.4 : 1, cursor: selectedEntries.length === 0 ? 'default' : 'pointer' }}>Copy</button>
                  <button onClick={() => setMoveMode(true)} disabled={selectedEntries.length === 0}
                    className="btn-secondary" style={{ flex: 1, opacity: selectedEntries.length === 0 ? 0.4 : 1, cursor: selectedEntries.length === 0 ? 'default' : 'pointer' }}>Move</button>
                  <button onClick={exitSelectMode}
                    style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: 'var(--text-primary)' }}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
          <style>{`
            @keyframes selectBarIn {
              0%   { opacity: 0; transform: translateX(-50%) scaleX(0.4); }
              100% { opacity: 1; transform: translateX(-50%) scaleX(1); }
            }
          `}</style>
        </div>
      )}

      {/* Floating add button — speed-dial of the food add actions. Hidden while the
          multi-select bar is up. */}
      {!selectMode && (
        <Fab
          raised={workoutBarVisible}
          label="Add"
          actions={[
            { label: 'Add Food', onClick: () => openAddFood(new Date().getHours()) },
            { label: 'Add Custom Food', onClick: () => openCustomFoodDetail(null) },
            { label: 'Add Meal', onClick: () => openMealBuilder(null) },
          ]}
        />
      )}
    </div>
  );
}

export default FoodLog;
