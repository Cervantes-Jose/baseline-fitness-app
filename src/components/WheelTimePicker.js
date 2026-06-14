import { useRef, useEffect } from 'react';

// Scroll-wheel time picker (iOS-style): three snapping columns — hour, minute, AM/PM —
// where the centered value is enlarged/accented. `value` is a 24h "HH:MM" string;
// `onChange` receives the same format. Built with native scroll-snap so it feels
// physical on touch without a dependency.

const ITEM_H = 36;     // px height of each row (kept constant so snap math is stable)
const VISIBLE = 5;     // rows shown at once (odd → one centered)
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;
const HEIGHT = VISIBLE * ITEM_H;

function Column({ items, index, onIndex, fmt = (x) => x }) {
  const ref = useRef(null);
  const raf = useRef(null);

  // Position the wheel at the incoming index once on mount.
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = index * ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
      if (i !== index) onIndex(i);
    });
  };

  return (
    <div ref={ref} onScroll={onScroll} className="wheel-col"
      style={{
        height: HEIGHT, overflowY: 'scroll', scrollSnapType: 'y mandatory',
        flex: 1, textAlign: 'center', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      }}>
      <div style={{ height: PAD }} />
      {items.map((it, i) => {
        const dist = Math.abs(i - index);
        const selected = i === index;
        return (
          <div key={i}
            onClick={() => ref.current && ref.current.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })}
            style={{
              height: ITEM_H, lineHeight: `${ITEM_H}px`, scrollSnapAlign: 'center',
              fontSize: selected ? 22 : 16,
              fontWeight: selected ? 800 : 500,
              color: selected ? 'var(--accent)' : 'var(--text-muted)',
              opacity: dist === 0 ? 1 : dist === 1 ? 0.55 : 0.3,
              transition: 'font-size 0.12s ease, color 0.12s ease, opacity 0.12s ease',
              cursor: 'pointer',
            }}>
            {fmt(it)}
          </div>
        );
      })}
      <div style={{ height: PAD }} />
    </div>
  );
}

export default function WheelTimePicker({ value = '09:00', onChange = () => {} }) {
  const [h24, m] = value.split(':').map(Number);
  const apIdx = h24 >= 12 ? 1 : 0;                 // 0 = AM, 1 = PM
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);   // 1..12
  const minutes = Array.from({ length: 60 }, (_, i) => i);     // 0..59
  const meridiem = ['AM', 'PM'];

  const hourIdx = h12 - 1;
  const minIdx = m;

  // Re-assemble a "HH:MM" 24h string from the three column indices.
  const emit = (hi, mi, ai) => {
    const hour12 = hours[hi];
    let hh = hour12 % 12;          // 12 → 0
    if (ai === 1) hh += 12;        // PM
    onChange(`${String(hh).padStart(2, '0')}:${String(minutes[mi]).padStart(2, '0')}`);
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch', gap: 8, userSelect: 'none' }}>
      {/* Center selection band */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: PAD, height: ITEM_H, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', pointerEvents: 'none' }} />
      <Column items={hours} index={hourIdx} onIndex={(i) => emit(i, minIdx, apIdx)} />
      <Column items={minutes} index={minIdx} onIndex={(i) => emit(hourIdx, i, apIdx)} fmt={(x) => String(x).padStart(2, '0')} />
      <Column items={meridiem} index={apIdx} onIndex={(i) => emit(hourIdx, minIdx, i)} />
    </div>
  );
}
