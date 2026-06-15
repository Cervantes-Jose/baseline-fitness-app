// Shared routine-metadata helpers + loader, used by the "View All" routine
// picker so its tiles match the My Routines page (categories, last performed,
// average workout time).
//
// NOTE (tech debt): Workouts.js still carries its own copies of NAME_TO_CATEGORY
// / routineCategories / avgTimeText / daysAgoText and the stats-loading logic.
// These were duplicated here rather than refactoring the large Workouts.js save
// path. They should be consolidated to this module in a later pass.

import { supabase } from '../supabaseClient';
import { EXERCISE_DATABASE, CATEGORIES } from './ExerciseDatabase';

// Exercise name -> its canonical category (first match in CATEGORIES order).
// Categories aren't stored on the exercises table, so we resolve them by name.
//
// Computed lazily (not at module load): ExerciseDatabase imports the components
// that import this module, so reading CATEGORIES/EXERCISE_DATABASE at the top
// level would hit a circular-import dead zone (they'd be undefined) and crash on
// a fresh load. By first call, those bindings are resolved.
let _nameToCategory = null;
function nameToCategory() {
  if (!_nameToCategory) {
    const map = {};
    for (const cat of CATEGORIES) {
      for (const name of EXERCISE_DATABASE[cat]) {
        if (!(name in map)) map[name] = cat;
      }
    }
    _nameToCategory = map;
  }
  return _nameToCategory;
}

// The unique categories represented by a routine's exercises, in canonical order.
export const routineCategories = (routine) => {
  const byName = nameToCategory();
  const present = new Set();
  for (const ex of routine.exercises || []) {
    const cat = ex.category || byName[ex.name];
    if (cat) present.add(cat);
  }
  return CATEGORIES.filter(c => present.has(c));
};

// Compact average workout length, e.g. "~28 min avg" / "~1 hr 5 min avg".
export function avgTimeText(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '~<1 min avg';
  if (mins < 60) return `~${mins} min avg`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `~${h} hr avg` : `~${h} hr ${m} min avg`;
}

// "Today" / "Yesterday" / "N days ago", compared by local calendar day.
export function daysAgoText(dateStr) {
  const then = new Date(dateStr);
  const now = new Date();
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((startNow - startThen) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

// Loads the user's routines with the same per-routine stats the My Routines page
// shows: exercises, lastPerformed timestamp, avgDuration (seconds). Respects the
// saved routineOrder so the picker matches the order on the Routines tab.
export async function loadRoutinesWithStats(uid) {
  const empty = { routines: [], lastPerformed: {}, avgDuration: {} };
  if (!uid) return empty;

  const { data: routineData, error } = await supabase
    .from('routines').select('*').eq('user_id', uid).order('created_at', { ascending: true });
  if (error || !routineData) return empty;

  const { data: exerciseData } = await supabase
    .from('exercises').select('*').eq('user_id', uid).order('position', { ascending: true });

  const { data: sessionExData } = await supabase
    .from('session_exercises')
    .select('exercise_name, workout_sessions(routine_id, created_at)')
    .eq('user_id', uid);

  const lastPerformed = {};
  (sessionExData || []).forEach(e => {
    const rid = e.workout_sessions?.routine_id;
    const ts = e.workout_sessions?.created_at;
    if (rid && ts && (!lastPerformed[rid] || ts > lastPerformed[rid])) lastPerformed[rid] = ts;
  });

  const { data: sessionData } = await supabase
    .from('workout_sessions').select('routine_id, duration').eq('user_id', uid);
  const durAgg = {};
  (sessionData || []).forEach(s => {
    if (s.routine_id == null || s.duration == null) return;
    const a = durAgg[s.routine_id] || { total: 0, count: 0 };
    a.total += Number(s.duration) || 0;
    a.count += 1;
    durAgg[s.routine_id] = a;
  });
  const avgDuration = {};
  Object.entries(durAgg).forEach(([rid, { total, count }]) => { if (count > 0) avgDuration[rid] = total / count; });

  const routines = routineData.map(r => ({
    ...r,
    exercises: (exerciseData || []).filter(e => e.routine_id === r.id),
  }));

  try {
    const savedOrder = JSON.parse(localStorage.getItem('routineOrder') || 'null');
    if (savedOrder) {
      routines.sort((a, b) =>
        (savedOrder.indexOf(a.id) + 1 || Infinity) - (savedOrder.indexOf(b.id) + 1 || Infinity));
    }
  } catch {}

  return { routines, lastPerformed, avgDuration };
}
