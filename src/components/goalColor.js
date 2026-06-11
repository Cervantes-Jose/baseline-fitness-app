// Single source of truth for goal-direction coloring (used app-wide).
//
// The old behavior hardcoded "down = good" for body metrics. That's wrong: whether
// a change is good depends on the goal. The rule (agreed in the Goals redesign):
//   goal above current  ⇒ you want to go UP   ⇒ up is green, down is red
//   goal below current  ⇒ you want to go DOWN ⇒ down is green, up is red
//   no goal / at goal / no change ⇒ neutral
//
// `diff` is the change (new − old). `current` is the latest value. `goal` is the target.

export const GOOD = '#22C55E';   // toward goal (matches macro green / dashboard up-good)
export const BAD = '#EF4444';    // away from goal

const NEUTRAL = { color: 'var(--text-secondary)', soft: 'var(--border)' };

// Returns { color, soft } — `color` for text/arrows, `soft` for a translucent pill bg.
export function goalTrend(diff, current, goal) {
  const g = goal == null || goal === '' ? null : Number(goal);
  if (g == null || current == null || !diff) return NEUTRAL;
  const want = Math.sign(g - current);          // +1 want up, −1 want down, 0 at goal
  if (want === 0) return NEUTRAL;
  return Math.sign(diff) === want
    ? { color: GOOD, soft: 'rgba(34,197,94,0.12)' }
    : { color: BAD, soft: 'rgba(239,68,68,0.12)' };
}
