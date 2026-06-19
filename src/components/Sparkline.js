import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { parseEntryDate } from './trendMath';

// Shared chart primitives. Before this file each surface (Measurements, Nutrition,
// PersonalRecords, PersonalRecordDetail) carried its own copy of the draw-in hook
// and an inline sparkline; they're consolidated here so the look + animation stay
// identical everywhere. The full-width detail charts live in TrendCompareChart.js.

// Animates an SVG line drawing itself in (stroke-dashoffset), then fades the dots
// in. `ref` points at the line/polyline element; re-runs whenever `dep` (typically
// the path string + width) changes.
export function useChartDraw(ref, dep) {
  const [drawn, setDrawn] = useState(false);
  useLayoutEffect(() => {
    setDrawn(false);
    const el = ref.current;
    let len = 0;
    if (el) {
      try { len = el.getTotalLength(); } catch { len = 0; }
      if (len) {
        el.style.transition = 'none';
        el.style.strokeDasharray = String(len);
        el.style.strokeDashoffset = String(len);
        el.getBoundingClientRect();
      }
    }
    const raf = requestAnimationFrame(() => {
      if (el && len) {
        el.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1)';
        el.style.strokeDashoffset = '0';
      }
      setDrawn(true);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
  return drawn;
}

// Compact inline sparkline (line + dots) shown inside list cards. Takes entries
// [{ value, date }] and sorts them by date here, so callers can pass any order.
export function Sparkline({ entries, color = '#3B82F6', height = 36 }) {
  const wrapRef = useRef(null);
  const lineRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sorted = [...entries].sort((a, b) => parseEntryDate(a.date) - parseEntryDate(b.date));
  const values = sorted.map(e => Number(e.value));
  const min = Math.min(...values);
  const max = Math.max(...values);

  const H = height, pad = 4;
  const cW = Math.max(0, width - pad * 2);
  const cH = H - pad * 2;
  const toX = i => pad + (sorted.length === 1 ? cW / 2 : (i / (sorted.length - 1)) * cW);
  const toY = v => max === min ? pad + cH / 2 : pad + cH - ((v - min) / (max - min)) * cH;
  const points = sorted.map((e, i) => `${toX(i)},${toY(Number(e.value))}`).join(' ');

  const drawn = useChartDraw(lineRef, `${width}:${points}`);

  return (
    <div ref={wrapRef} style={{ width: '100%', marginTop: '8px' }}>
      {width > 0 && (
        <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }}>
          <polyline ref={lineRef} points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {sorted.map((e, i) => (
            <circle key={i} cx={toX(i)} cy={toY(Number(e.value))} r="3" fill={color}
              style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.4s ease', transitionDelay: `${0.25 + i * 0.05}s` }} />
          ))}
        </svg>
      )}
    </div>
  );
}
