import { useState } from 'react';
import { ymd, parseYmd, monthGrid, DOW_LETTER } from './habitMath';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Read-only month calendar in the Daily Habits "Month Overview" style: a single
// month with prev/next arrows, a Mon-first weekday header, and a grid of cells
// (date number above a circle). Days present in `markedDays` show a filled accent
// circle with a check; the rest are empty circles. Tapping a day calls
// onSelectDay(ymdStr). Unlike the habit calendar, the circles never toggle — they
// only reveal what was already recorded.
//
//   markedDays         — Set of 'YYYY-MM-DD' strings that have data
//   onSelectDay        — (ymdStr) => void, fired when a tappable day is tapped
//   selectedDay        — 'YYYY-MM-DD' to highlight with a ring (used as a date picker)
//   selectableUnmarked — when true, days with no data are tappable too (date-picker mode)
//   allowFuture        — when true, future months/days can be paged to and tapped
//                        (e.g. the food log, where you can plan meals ahead)
//   initialMonth       — Date to open on (defaults to the selected day's month, else today)
//   title              — optional section label; when set, a "N days" count shows beside it
//   accent             — circle / highlight color (defaults to the app's blue)
export default function MonthOverviewCalendar({
  markedDays,
  onSelectDay = () => {},
  selectedDay = null,
  selectableUnmarked = false,
  allowFuture = false,
  initialMonth = null,
  title = null,
  accent = 'var(--accent)',
}) {
  const [monthRef, setMonthRef] = useState(() => {
    const base = initialMonth || (selectedDay ? parseYmd(selectedDay) : new Date());
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const year = monthRef.getFullYear();
  const month = monthRef.getMonth();
  const cells = monthGrid(year, month);
  const todayStr = ymd(new Date());
  const now = new Date();

  // Don't page past the current month (there's no future data to show) — unless
  // allowFuture is set, e.g. the food log where you can plan meals ahead.
  const canGoNext = allowFuture || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth());

  const markedThisMonth = cells.reduce((n, c) => (c.inMonth && markedDays.has(ymd(c.date)) ? n + 1 : n), 0);

  const sectionLabel = { fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 };

  const dayCircle = (date) => {
    const key = ymd(date);
    const marked = markedDays.has(key);
    const isSelected = selectedDay === key;
    const future = key > todayStr;
    const tappable = marked || (selectableUnmarked && (allowFuture || !future));

    const base = {
      width: 24, height: 24, borderRadius: '50%', padding: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: tappable ? 'pointer' : 'default',
    };

    let style;
    if (marked) {
      style = { ...base, border: 'none', background: accent };
    } else if (isSelected) {
      style = { ...base, border: `2px solid ${accent}`, background: 'transparent' };
    } else {
      // Dim only non-tappable future days; when planning ahead is allowed they read normally.
      style = { ...base, border: '1px solid var(--border)', background: 'transparent', opacity: future && !allowFuture ? 0.4 : 1 };
    }

    return (
      <button
        type="button"
        disabled={!tappable}
        onClick={tappable ? () => onSelectDay(key) : undefined}
        aria-label={key}
        style={{ ...style, boxShadow: isSelected && marked ? `0 0 0 2px var(--accent-light)` : undefined }}
      >
        {marked && <svg width={12} height={12} viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3L11.5 4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </button>
    );
  };

  return (
    <div>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={sectionLabel}>{title}</p>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{markedThisMonth} {markedThisMonth === 1 ? 'day' : 'days'}</span>
        </div>
      )}
      {/* Month label (left) + arrows (right) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{MONTH_NAMES[month]} {year}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={() => setMonthRef(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 22, padding: '2px 6px', lineHeight: 1 }}>‹</button>
          <button type="button" onClick={() => canGoNext && setMonthRef(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} disabled={!canGoNext}
            style={{ background: 'none', border: 'none', cursor: canGoNext ? 'pointer' : 'default', color: 'var(--text-secondary)', fontSize: 22, padding: '2px 6px', lineHeight: 1, opacity: canGoNext ? 1 : 0.3 }}>›</button>
        </div>
      </div>
      {/* Weekday header (Mon-first) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
        {[1,2,3,4,5,6,0].map(dow => (
          <div key={dow} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>{DOW_LETTER[dow]}</div>
        ))}
      </div>
      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, justifyItems: 'center' }}>
        {cells.map((cell, i) => {
          if (!cell.inMonth) return <div key={i} style={{ width: 28, height: 28 }} />;
          const key = ymd(cell.date);
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 10, color: key === todayStr ? 'var(--accent)' : 'var(--text-muted)', fontWeight: key === todayStr ? 700 : 400 }}>{cell.date.getDate()}</span>
              {dayCircle(cell.date)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
