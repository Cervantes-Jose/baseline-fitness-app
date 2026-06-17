import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { parseEntryDate } from './trendMath';

// Full-width detail trend chart with two extras over the old single-line chart:
//   1. An optional second ("compare") series overlaid on the same chart. The two
//      series are NORMALIZED INDEPENDENTLY to their own min/max, so what lines up
//      is shape & timing (a spike, a dip), not absolute values — exactly what you
//      want when checking "did my calories spike around this PR". The base line
//      keeps the gradient-fill look; the compare line is drawn dashed in its color.
//   2. A press-and-drag scrubber: hold anywhere on the chart and a vertical
//      crosshair follows your finger, snapping to the nearest base data point and
//      reading off both series' values for that day. Release to dismiss.
//
// Props:
//   base    — { entries:[{value,date}], color, unit, label }  (required)
//   compare — same shape | null
function fmtVal(v) { const n = Number(v); return n % 1 === 0 ? String(n) : n.toFixed(1); }
function fmtDate(ms) {
  const d = new Date(ms);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TrendCompareChart({ base, compare = null }) {
  const wrapRef = useRef(null);
  const baseLineRef = useRef(null);
  const activeRef = useRef(false);
  const [width, setWidth] = useState(0);
  const [scrubX, setScrubX] = useState(null); // pixel x of the crosshair, null when idle

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 120, padX = 6, padTop = 14, padBottom = 10;
  const cW = Math.max(0, width - padX * 2);
  const cH = H - padTop - padBottom;

  const toData = (entries) => (entries || [])
    .map(e => ({ t: parseEntryDate(e.date), v: Number(e.value) }))
    .filter(d => !isNaN(d.t) && !isNaN(d.v))
    .sort((a, b) => a.t - b.t);

  const baseData = toData(base?.entries);
  const cmpData = compare ? toData(compare.entries) : [];

  // Shared time axis across both series so points align by date, not by index.
  const allT = [...baseData, ...cmpData].map(d => d.t);
  const tMin = allT.length ? Math.min(...allT) : 0;
  const tMax = allT.length ? Math.max(...allT) : 1;
  const toX = (t) => (tMin === tMax ? padX + cW / 2 : padX + ((t - tMin) / (tMax - tMin)) * cW);

  // Each series normalized to its OWN value range (independent vertical scaling).
  const buildSeries = (data, color, unit, label, dashed) => {
    if (!data.length) return null;
    const vs = data.map(d => d.v);
    const vMin = Math.min(...vs), vMax = Math.max(...vs);
    const pts = data.map(d => ({
      ...d,
      x: toX(d.t),
      y: vMax === vMin ? padTop + cH / 2 : padTop + (1 - (d.v - vMin) / (vMax - vMin)) * cH,
    }));
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    return { color, unit, label, dashed, pts, path };
  };

  const baseSeries = buildSeries(baseData, base.color, base.unit, base.label, false);
  const cmpSeries = compare ? buildSeries(cmpData, compare.color, compare.unit, compare.label, true) : null;

  const baseFill = baseSeries && baseSeries.pts.length > 1
    ? `${baseSeries.path} L${baseSeries.pts[baseSeries.pts.length - 1].x},${padTop + cH} L${baseSeries.pts[0].x},${padTop + cH} Z`
    : '';
  const gradId = `tc-grad-${(base.color || '#3B82F6').replace('#', '')}`;

  // Animate the base line drawing itself in whenever its path/width changes.
  const [drawn, setDrawn] = useState(false);
  useLayoutEffect(() => {
    setDrawn(false);
    const el = baseLineRef.current;
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
  }, [baseSeries?.path, width]);

  // Linear-interpolate a series' y/value at a pixel x (for the compare crosshair dot).
  const valueAtX = (series, px) => {
    if (!series || !series.pts.length) return null;
    const pts = series.pts;
    if (px <= pts[0].x) return pts[0];
    if (px >= pts[pts.length - 1].x) return pts[pts.length - 1];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (px >= a.x && px <= b.x) {
        const f = b.x === a.x ? 0 : (px - a.x) / (b.x - a.x);
        return { x: px, y: a.y + (b.y - a.y) * f, v: a.v + (b.v - a.v) * f, t: a.t + (b.t - a.t) * f };
      }
    }
    return pts[pts.length - 1];
  };

  // Snap the crosshair to the nearest base data point so the base reading is an
  // exact logged value (not an interpolation).
  const baseHit = (scrubX != null && baseSeries)
    ? baseSeries.pts.reduce((best, p) => (Math.abs(p.x - scrubX) < Math.abs(best.x - scrubX) ? p : best), baseSeries.pts[0])
    : null;
  const lineX = baseHit ? baseHit.x : scrubX;
  const cmpHit = (lineX != null && cmpSeries) ? valueAtX(cmpSeries, lineX) : null;

  const updateScrub = (clientX) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let px = clientX - rect.left;
    px = Math.max(padX, Math.min(padX + cW, px));
    setScrubX(px);
  };
  const onDown = (e) => {
    activeRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    updateScrub(e.clientX);
  };
  const onMove = (e) => { if (activeRef.current) updateScrub(e.clientX); };
  const onUp = () => { activeRef.current = false; setScrubX(null); };

  const labelPts = baseSeries && baseSeries.pts.length > 1
    ? [baseSeries.pts[0], baseSeries.pts[Math.floor((baseSeries.pts.length - 1) / 2)], baseSeries.pts[baseSeries.pts.length - 1]]
    : (baseSeries ? baseSeries.pts : []);

  // Tooltip horizontal placement, clamped inside the chart.
  const tipW = 132;
  const tipLeft = lineX == null ? 0 : Math.max(padX, Math.min(width - tipW - padX, lineX - tipW / 2));

  return (
    <div style={{ width: '100%', marginTop: '14px' }}>
      {compare && cmpSeries && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '8px' }}>
          {[{ c: base.color, n: base.label }, { c: compare.color, n: compare.label }].map((s, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              <span style={{ width: 14, height: 0, borderTop: `2px ${i === 1 ? 'dashed' : 'solid'} ${s.c}` }} />
              {s.n}
            </span>
          ))}
        </div>
      )}

      <div ref={wrapRef} style={{ width: '100%', position: 'relative', touchAction: 'none' }}>
        {width > 0 && baseSeries && (
          <svg
            width={width} height={H}
            style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
            onPointerLeave={onUp} onPointerCancel={onUp}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={base.color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={base.color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {baseFill && <path d={baseFill} fill={`url(#${gradId})`} style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.7s ease' }} />}
            {baseSeries.pts.length > 1 && (
              <path ref={baseLineRef} d={baseSeries.path} fill="none" stroke={base.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {cmpSeries && cmpSeries.pts.length > 1 && (
              <path d={cmpSeries.path} fill="none" stroke={compare.color} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: drawn ? 0.95 : 0, transition: 'opacity 0.5s ease 0.2s' }} />
            )}

            {/* Base dots (hidden while scrubbing to reduce clutter) */}
            {scrubX == null && baseSeries.pts.map((p, i) => (
              <circle key={`b${i}`} cx={p.x} cy={p.y} r="3.5" fill={base.color} style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.4s ease', transitionDelay: `${0.3 + i * 0.05}s` }} />
            ))}
            {scrubX == null && cmpSeries && cmpSeries.pts.map((p, i) => (
              <circle key={`c${i}`} cx={p.x} cy={p.y} r="3" fill={compare.color} style={{ opacity: drawn ? 0.9 : 0, transition: 'opacity 0.4s ease', transitionDelay: `${0.4 + i * 0.05}s` }} />
            ))}

            {/* Crosshair */}
            {lineX != null && (
              <>
                <line x1={lineX} y1={padTop - 4} x2={lineX} y2={padTop + cH} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" />
                {baseHit && <circle cx={baseHit.x} cy={baseHit.y} r="5" fill={base.color} stroke="var(--card)" strokeWidth="2" />}
                {cmpHit && <circle cx={cmpHit.x} cy={cmpHit.y} r="5" fill={compare.color} stroke="var(--card)" strokeWidth="2" />}
              </>
            )}
          </svg>
        )}

        {/* Scrubber readout */}
        {lineX != null && baseHit && (
          <div style={{
            position: 'absolute', top: -6, left: tipLeft, width: tipW,
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 6px 18px rgba(0,0,0,0.14)', padding: '7px 9px', pointerEvents: 'none', zIndex: 5,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>{fmtDate(baseHit.t)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: base.color, flexShrink: 0 }} />
              {fmtVal(baseHit.v)}{base.unit ? <span style={{ fontSize: '0.8em', fontWeight: 600 }}> {base.unit}</span> : ''}
            </div>
            {cmpHit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginTop: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: compare.color, flexShrink: 0 }} />
                {fmtVal(cmpHit.v)}{compare.unit ? <span style={{ fontSize: '0.8em', fontWeight: 600 }}> {compare.unit}</span> : ''}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        {labelPts.map((p, i) => (
          <span key={i} style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fmtDate(p.t)}</span>
        ))}
      </div>
    </div>
  );
}
