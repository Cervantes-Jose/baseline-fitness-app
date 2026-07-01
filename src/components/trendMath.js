// Shared trend-delta math for the measurement / nutrition trend cards and the
// dashboard trend widgets. Keeping this in one place means the in-app detail
// screens and the dashboard modules always show the *identical* delta — they
// must never drift onto different formulas.
//
// The rule:
//   • 14+ days of data (oldest→newest spans at least 14 calendar days) → compare
//     rolling weekly averages: the last 7 days including the anchor day vs the 7
//     days before that. Averaging smooths daily noise into a clean per-week rate.
//   • Fewer than 14 days → simple anchor-vs-yesterday (latest entry vs the entry
//     exactly one day earlier). If there's no such entry, no delta is shown.

const DAY_MS = 24 * 60 * 60 * 1000;

// Normalize an entry's date to a midnight timestamp. Accepts a 'YYYY-MM-DD' date
// string (treated as local midnight) or any Date-parseable timestamp.
export const parseEntryDate = (s) =>
  s && /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(s + 'T00:00:00').getTime()
    : new Date(s).getTime();

// entries: ascending-sorted array of { value, date }.
// anchorMs:  the "as of" day (midnight ms) the windows are anchored on. Defaults
//            to today. Nutrition passes the Food Log's selected date.
// Returns { diff, showDelta, compareLabel }.
export function weeklyTrendDelta(entries, anchorMs) {
  if (anchorMs == null) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    anchorMs = d.getTime();
  }
  const out = { diff: 0, showDelta: false, compareLabel: '' };
  if (!entries || entries.length === 0) return out;

  const latest = entries[entries.length - 1];
  const thisWeekStart = anchorMs - 6 * DAY_MS;   // last 7 days incl. anchor: [anchor-6, anchor]
  const lastWeekStart = anchorMs - 13 * DAY_MS;  // previous 7 days: [anchor-13, anchor-7]
  const thisWeek = entries.filter(e => { const t = parseEntryDate(e.date); return t >= thisWeekStart && t <= anchorMs; });
  const lastWeek = entries.filter(e => { const t = parseEntryDate(e.date); return t >= lastWeekStart && t < thisWeekStart; });
  const avg = arr => arr.reduce((s, e) => s + Number(e.value), 0) / arr.length;

  const latestMs = parseEntryDate(latest.date);
  const oldestMs = parseEntryDate(entries[0].date);
  // Spans at least 14 calendar days (oldest→newest), not just "some entry landed
  // in the prior week".
  const hasTwoWeeksData = (latestMs - oldestMs) >= 13 * DAY_MS;
  const yesterdayEntry = entries.find(e => parseEntryDate(e.date) === latestMs - DAY_MS);

  if (hasTwoWeeksData && thisWeek.length > 0 && lastWeek.length > 0) {
    out.diff = avg(thisWeek) - avg(lastWeek);
    out.showDelta = true;
    out.compareLabel = 'vs last week avg';
  } else if (yesterdayEntry) {
    out.diff = Number(latest.value) - Number(yesterdayEntry.value);
    out.showDelta = true;
    out.compareLabel = 'vs yesterday';
  }
  return out;
}

// Simple entry-over-entry delta for measurements tracked on a "weekly" cadence:
// the latest entry vs the one logged immediately before it, regardless of the
// calendar gap. No rolling window — each log is a datapoint and we just compare
// consecutive logs (e.g. this week's waist reading vs last week's).
// entries: ascending-sorted array of { value, date }.
// Returns { diff, showDelta, compareLabel }.
export function entryTrendDelta(entries) {
  const out = { diff: 0, showDelta: false, compareLabel: '' };
  if (!entries || entries.length < 2) return out;
  const latest = entries[entries.length - 1];
  const prev = entries[entries.length - 2];
  out.diff = Number(latest.value) - Number(prev.value);
  out.showDelta = true;
  out.compareLabel = 'vs previous';
  return out;
}
