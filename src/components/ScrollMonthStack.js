import { useRef, useLayoutEffect } from 'react';
import { ymd, monthGrid, DOW_LETTER } from './habitMath';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Nearest scrollable ancestor of `node`; falls back to the window (the workout
// history page scrolls the document, not a container).
function getScrollParent(node) {
  let el = node.parentElement;
  while (el) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el;
    el = el.parentElement;
  }
  return window;
}

// Rest `el`'s vertical center a touch below the middle of the viewport (56% down),
// per the "current month sits slightly low" spec. Clamped at the scroll bounds, so
// with little history it just settles near the bottom — still reads as low.
function restSlightlyLow(scroller, el) {
  const frac = 0.56;
  const rect = el.getBoundingClientRect();
  if (scroller === window) {
    const target = rect.top + window.scrollY + rect.height / 2 - frac * window.innerHeight;
    window.scrollTo(0, Math.max(0, target));
  } else {
    const cRect = scroller.getBoundingClientRect();
    const contentCenter = scroller.scrollTop + (rect.top - cRect.top) + rect.height / 2;
    scroller.scrollTop = Math.max(0, contentCenter - frac * scroller.clientHeight);
  }
}

// A vertically-scrolling stack of month grids (oldest → newest) that replaces the
// arrow-paged single-month calendars. On mount it rests the current (last) month
// slightly below the middle; scroll up to reach older months. Each month repeats
// its own weekday header so the columns stay legible while scrolling.
//
//   months    — [{ y, m }] ascending; the LAST entry is treated as the current month
//   renderDay — (date) => JSX for an in-month day's circle
//   monthMeta — optional (y, m) => JSX rendered at the right of each month's label
//   bounded   — true: own a fixed-height internal scroller (see `height`); false:
//               grow with content and center within the nearest scrolling ancestor.
//               Sheets that are mid-content (Habit detail) use bounded so the section
//               stays compact; views where the calendar IS the scroll area (workout
//               history, measurements) use unbounded and drive the outer scroller.
//   height    — bounded-mode scroller height (default '52vh')
export default function ScrollMonthStack({ months, renderDay, monthMeta = null, bounded = false, height = '52vh' }) {
  const boxRef = useRef(null);
  const currentRef = useRef(null);
  const todayStr = ymd(new Date());

  useLayoutEffect(() => {
    const el = currentRef.current;
    if (!el) return;
    const scroller = bounded ? boxRef.current : getScrollParent(el);
    if (scroller) restSlightlyLow(scroller, el);
    // Position once after the stack lays out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weekdayRow = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
      {[1,2,3,4,5,6,0].map(dow => (
        <div key={dow} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>{DOW_LETTER[dow]}</div>
      ))}
    </div>
  );

  const monthBlock = ({ y, m }, isCurrent) => {
    const cells = monthGrid(y, m);
    return (
      <div key={`${y}-${m}`} ref={isCurrent ? currentRef : null} style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{MONTH_NAMES[m]} {y}</span>
          {monthMeta && monthMeta(y, m)}
        </div>
        {weekdayRow}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, justifyItems: 'center' }}>
          {cells.map((cell, i) => {
            if (!cell.inMonth) return <div key={i} style={{ width: 28, height: 28 }} />;
            const key = ymd(cell.date);
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 10, color: key === todayStr ? 'var(--accent)' : 'var(--text-muted)', fontWeight: key === todayStr ? 700 : 400 }}>{cell.date.getDate()}</span>
                {renderDay(cell.date)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const body = (
    <>
      {months.map((mo, idx) => monthBlock(mo, idx === months.length - 1))}
      {/* Room below the current month so it can rest slightly-low rather than flush. */}
      <div style={{ height: '12vh' }} />
    </>
  );

  if (bounded) {
    return (
      <div ref={boxRef} style={{
        height, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain', touchAction: 'pan-y',
      }}>
        {body}
      </div>
    );
  }
  return <div>{body}</div>;
}
