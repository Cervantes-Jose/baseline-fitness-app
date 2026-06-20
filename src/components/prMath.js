// Shared math + formatting helpers for the Personal Records feature.
// Volume = Σ(weight × reps) across a set array, mirroring the volume math used
// in WorkoutHome's weekly stats and routineMeta.

// session_exercises.sets is jsonb — usually a parsed array, but defensively
// handle a stringified array too (same pattern as WorkoutHome).
export const parseSets = (sets) => {
  if (Array.isArray(sets)) return sets;
  if (typeof sets === 'string') { try { return JSON.parse(sets); } catch { return []; } }
  return [];
};

// Per-session-exercise stats from a raw sets array.
export function setStats(setsRaw) {
  const sets = parseSets(setsRaw);
  const weights = sets.map(s => Number(s.weight) || 0);
  const repsArr = sets.map(s => Number(s.reps) || 0);
  const totalReps = repsArr.reduce((a, b) => a + b, 0);
  const volume = sets.reduce((sum, s) => sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);
  const totalSets = sets.length;
  const avgWeight = totalSets ? weights.reduce((a, b) => a + b, 0) / totalSets : 0;
  return { weights, repsArr, totalReps, totalSets, volume, avgWeight };
}

// Heaviest *performed* weight (a set with both weight and reps) logged for an
// exercise name across past sessions. `history` is the Workouts history array:
// [{ exercises: [{ name, sets: [{weight, reps}] }] }]. Returns 0 if never done.
export function maxWeightInHistory(history, name) {
  let max = 0;
  for (const s of history || []) {
    for (const ex of s.exercises || []) {
      if (ex.name !== name) continue;
      for (const set of parseSets(ex.sets)) {
        const w = Number(set.weight) || 0;
        const r = Number(set.reps) || 0;
        if (r > 0 && w > max) max = w;
      }
    }
  }
  return max;
}

// New weight PRs from a just-finished session: exercises whose top performed set
// beat their previous all-time best weight. `sessionLog` is keyed by exercise id
// ({ [exId]: [{weight, reps}] }); `history` must be the PRE-save history so the
// current session isn't counted as its own previous best. First-time exercises
// (no prior best) are skipped, so every result reads as "prev → next".
// Returns [{ name, prev, next }].
export function computeWorkoutPRs(exercises, sessionLog, history) {
  const prs = [];
  for (const ex of exercises || []) {
    let thisMax = 0;
    for (const set of parseSets(sessionLog[ex.id])) {
      const w = Number(set.weight) || 0;
      const r = Number(set.reps) || 0;
      if (r > 0 && w > thisMax) thisMax = w;
    }
    if (thisMax <= 0) continue;
    const prevMax = maxWeightInHistory(history, ex.name);
    if (prevMax > 0 && thisMax > prevMax) prs.push({ name: ex.name, prev: prevMax, next: thisMax });
  }
  return prs;
}

// Number with at most one decimal, trailing ".0" stripped.
export const fmtNum = (v) => {
  const n = Number(v) || 0;
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

// Whole-number volume with thousands separators.
export const fmtVolume = (lbs) => Math.round(Number(lbs) || 0).toLocaleString();

// Parse a workout_sessions row's timestamp into a Date. Prefers created_at;
// falls back to the text `date` column.
export const sessionDate = (s) => {
  if (s.created_at) return new Date(s.created_at);
  if (s.date && /^\d{4}-\d{2}-\d{2}$/.test(s.date)) return new Date(s.date + 'T00:00:00');
  return new Date(s.date || 0);
};

// "May 6, 2026" long date for a Date object.
export const fmtLongDate = (d) =>
  d instanceof Date && !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

// "May 6" short date.
export const fmtShortDate = (d) =>
  d instanceof Date && !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

// Local calendar-day key (YYYY-MM-DD) for matching a 1RM's recorded_at to a session day.
export const dayKey = (d) =>
  d instanceof Date && !isNaN(d)
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : '';

// The current + previous window for a period toggle, anchored on `now`.
//   'week'  → this calendar week (Mon-start) vs the week before
//   'month' → this calendar month vs the month before
//   'all'   → everything, no previous window (no delta)
export function periodRange(period, now = new Date()) {
  if (period === 'week') {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    const prevMonday = new Date(monday);
    prevMonday.setDate(monday.getDate() - 7);
    return { start: monday, prevStart: prevMonday, prevEnd: monday, hasPrev: true };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { start, prevStart, prevEnd: start, hasPrev: true };
  }
  return { start: new Date(0), prevStart: null, prevEnd: null, hasPrev: false };
}

export const PERIOD_OPTIONS = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
];

export const periodLabel = (id) => (PERIOD_OPTIONS.find(p => p.id === id) || PERIOD_OPTIONS[1]).label;
