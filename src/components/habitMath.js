// Pure helpers for the Daily Habits feature. No React, no Supabase — just date math
// and stat derivation so the UI components stay thin and testable.
//
// Weekday convention everywhere: JS getDay() → 0=Sun, 1=Mon … 6=Sat.
// `custom_days` on a habit is stored as an array of those indices.

// Local YYYY-MM-DD (NOT toISOString, which is UTC and can shift the day). This is
// the exact string stored in habit_logs.date (a SQL `date` column).
export function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Parse a YYYY-MM-DD string back into a local Date (midnight local time).
export function parseYmd(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Is this habit meant to be done on `date`?  Drives which day-circles are active
// (vs. greyed out) and what counts toward "X of N" / streaks.
export function isScheduled(habit, date) {
  const dow = date.getDay();
  switch (habit?.frequency) {
    case 'weekdays': return dow >= 1 && dow <= 5;
    case 'custom': return Array.isArray(habit.custom_days) && habit.custom_days.includes(dow);
    case 'daily':
    default: return true;
  }
}

// Mon-first order of weekday indices: [1,2,3,4,5,6,0].
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DOW_SHORT = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
export const DOW_LETTER = { 0: 'S', 1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S' };

// The seven dates of the week containing `ref`, Monday → Sunday.
export function weekDates(ref = new Date()) {
  const dow = ref.getDay();
  // How far back to Monday (treat Sunday as the last day of the week).
  const offsetToMon = dow === 0 ? 6 : dow - 1;
  const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - offsetToMon);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}

// Calendar grid cells for a month, Mon-first, padded to full weeks.
// Each cell: { date, inMonth }.  Out-of-month cells render greyed/blank.
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const firstDow = first.getDay();
  const lead = firstDow === 0 ? 6 : firstDow - 1; // Mon-first leading blanks
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push({ date: null, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), inMonth: true });
  while (cells.length % 7 !== 0) cells.push({ date: null, inMonth: false });
  return cells;
}

// "X of N" for the current week: N = scheduled days this week, X = scheduled days
// this week that are logged (done). Future days are still part of N.
export function weekProgress(habit, doneSet, ref = new Date()) {
  const days = weekDates(ref);
  let scheduled = 0, done = 0;
  for (const d of days) {
    if (!isScheduled(habit, d)) continue;
    scheduled++;
    if (doneSet.has(ymd(d))) done++;
  }
  return { done, scheduled };
}

// "X of N" for a month: N = scheduled days in that month, X = logged scheduled days.
export function monthProgress(habit, doneSet, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let scheduled = 0, done = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (!isScheduled(habit, date)) continue;
    scheduled++;
    if (doneSet.has(ymd(date))) done++;
  }
  return { done, scheduled };
}

// Current streak: consecutive *scheduled* days that are done, walking back from
// today. Today not-yet-done does NOT break the streak (you can still do it today);
// it just isn't counted until checked.
export function currentStreak(habit, doneSet, ref = new Date()) {
  let streak = 0;
  const cur = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const isToday = (d) => ymd(d) === ymd(ref);
  while (true) {
    if (isScheduled(habit, cur)) {
      if (doneSet.has(ymd(cur))) {
        streak++;
      } else if (!isToday(cur)) {
        break; // a missed scheduled day in the past ends the streak
      }
    }
    cur.setDate(cur.getDate() - 1);
    // Safety bound: never scan more than ~3 years back.
    if (ref.getTime() - cur.getTime() > 3 * 366 * 86400000) break;
  }
  return streak;
}

// Longest streak ever: max run of consecutive scheduled days all logged, scanning
// from the earliest known date (habit creation or first log) to today.
export function longestStreak(habit, doneSet, ref = new Date()) {
  if (doneSet.size === 0) return 0;
  // Earliest date to consider: min of created_at and earliest log.
  let earliest = ref;
  for (const s of doneSet) {
    const d = parseYmd(s);
    if (d < earliest) earliest = d;
  }
  if (habit?.created_at) {
    const c = new Date(habit.created_at);
    const cMid = new Date(c.getFullYear(), c.getMonth(), c.getDate());
    if (cMid < earliest) earliest = cMid;
  }
  let best = 0, run = 0;
  const cur = new Date(earliest.getFullYear(), earliest.getMonth(), earliest.getDate());
  const end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  while (cur <= end) {
    if (isScheduled(habit, cur)) {
      if (doneSet.has(ymd(cur))) {
        run++;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return best;
}

// Total logged days within the current month (used for "Days Tracked / This Month").
export function daysTrackedThisMonth(doneSet, ref = new Date()) {
  const y = ref.getFullYear(), m = ref.getMonth();
  let n = 0;
  for (const s of doneSet) {
    const d = parseYmd(s);
    if (d.getFullYear() === y && d.getMonth() === m) n++;
  }
  return n;
}

// Human subtitle for a habit: frequency + optional target. e.g. "Daily · 5g".
export function habitSubtitle(habit) {
  const freq = habit?.frequency === 'weekdays' ? 'Weekdays'
    : habit?.frequency === 'custom' ? customFreqLabel(habit.custom_days)
    : 'Daily';
  return habit?.target ? `${freq} · ${habit.target}` : freq;
}

// Compact label for a custom-day set, e.g. "Mon, Wed, Fri" or "Custom" if empty.
export function customFreqLabel(days) {
  if (!Array.isArray(days) || days.length === 0) return 'Custom';
  if (days.length === 7) return 'Daily';
  return WEEK_ORDER.filter(d => days.includes(d)).map(d => DOW_SHORT[d]).join(', ');
}
