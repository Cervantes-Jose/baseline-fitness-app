import { supabase } from '../supabaseClient';
import { MACRO_COLOR } from './macroColors';

// Builds the cross-domain "compare against everything" catalog used by the trend
// Compare overlay (see TrendCompareChart / CompareSheet). Every series is shaped
// identically — { id, label, color, unit, entries:[{value,date}] } — so the chart
// can normalize and overlay any of them regardless of domain.
//
// Groups returned (in order, empty groups omitted):
//   • Measurements      — one series per tracked measurement
//   • Nutrition         — daily Calories / Protein / Carbs / Fats totals
//   • Personal Records  — one 1RM-history series per exercise
//
// Each surface loads the same catalog so "compare with X" means the same thing
// everywhere. Pass { excludeId } to drop the series you're already viewing.

// Canonical measurement palette — must match CHART_COLORS in Measurements.js so a
// measurement keeps the same color in the picker as on its own detail screen.
const MEAS_COLORS = ['#3B82F6', '#22C55E', '#EAB308', '#A855F7', '#F97316', '#EF4444', '#06B6D4', '#EC4899'];
// PR trend lines pull from a curated palette indexed by position — same convention
// as MEAS_COLORS above, so each exercise gets a distinct color that stays stable
// across reloads (rather than re-rolling on every refresh).
const PR_COLORS = ['#8B5CF6', '#0EA5E9', '#F43F5E', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#14B8A6'];
const CALORIE_COLOR = '#F97316';

const num = (v) => Number(v) || 0;
const round1 = (v) => Math.round(v * 10) / 10;

export async function loadCompareCatalog({ excludeId = null } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return [];

  const [measRes, entryRes, foodRes, prRes] = await Promise.all([
    supabase.from('measurements').select('id, name').eq('user_id', uid).order('created_at', { ascending: true }),
    supabase.from('measurement_entries').select('measurement_id, value, date, unit').eq('user_id', uid).order('created_at', { ascending: true }),
    supabase.from('food_entries').select('date, calories, protein, carbs, fats').eq('user_id', uid),
    supabase.from('exercise_prs').select('exercise_name, weight, unit, recorded_at').eq('user_id', uid).order('recorded_at', { ascending: true }),
  ]);

  const groups = [];

  // ── Measurements ──────────────────────────────────────────────
  const measurements = measRes.data || [];
  const entries = entryRes.data || [];
  const measItems = measurements
    .map((m, i) => ({ m, color: MEAS_COLORS[i % MEAS_COLORS.length] }))
    .filter(({ m }) => `meas:${m.id}` !== excludeId)
    .map(({ m, color }) => {
      const es = entries.filter(e => e.measurement_id === m.id);
      const unit = es.length ? (es[es.length - 1].unit || '') : '';
      return {
        id: `meas:${m.id}`, label: m.name || 'Untitled', color, unit,
        entries: es.map(e => ({ value: num(e.value), date: e.date })),
      };
    })
    .filter(it => it.entries.length > 0);
  if (measItems.length) groups.push({ group: 'Measurements', items: measItems });

  // ── Nutrition (daily totals) ──────────────────────────────────
  const food = foodRes.data || [];
  const sumByDay = (key) => {
    const totals = {};
    for (const r of food) {
      if (!r.date) continue;
      totals[r.date] = (totals[r.date] || 0) + num(r[key]);
    }
    return Object.entries(totals)
      .map(([date, value]) => ({ date, value: round1(value) }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };
  const nutItems = [
    { id: 'nut:calories', label: 'Calories', color: CALORIE_COLOR, unit: 'kcal', entries: sumByDay('calories') },
    { id: 'nut:protein', label: 'Protein', color: MACRO_COLOR.protein, unit: 'g', entries: sumByDay('protein') },
    { id: 'nut:carbs', label: 'Carbs', color: MACRO_COLOR.carbs, unit: 'g', entries: sumByDay('carbs') },
    { id: 'nut:fats', label: 'Fats', color: MACRO_COLOR.fats, unit: 'g', entries: sumByDay('fats') },
  ].filter(it => it.id !== excludeId && it.entries.length > 0);
  if (nutItems.length) groups.push({ group: 'Nutrition', items: nutItems });

  // ── Personal Records (1RM history per exercise) ───────────────
  const prs = prRes.data || [];
  const byExercise = {};
  for (const p of prs) {
    (byExercise[p.exercise_name] = byExercise[p.exercise_name] || []).push(p);
  }
  const prItems = Object.entries(byExercise)
    .map(([name, rows], i) => ({
      id: `pr:${name}`, label: name, color: PR_COLORS[i % PR_COLORS.length],
      unit: rows[rows.length - 1]?.unit || 'lb',
      entries: rows
        .map(p => ({ value: num(p.weight), date: p.recorded_at }))
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    }))
    .filter(it => it.id !== excludeId && it.entries.length > 0);
  if (prItems.length) groups.push({ group: 'Personal Records', items: prItems });

  return groups;
}

// Look up a series across all groups by its stable id.
export function findCatalogItem(catalog, id) {
  for (const g of catalog || []) {
    const it = (g.items || []).find(i => i.id === id);
    if (it) return it;
  }
  return null;
}
