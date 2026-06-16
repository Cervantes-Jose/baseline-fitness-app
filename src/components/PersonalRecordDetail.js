import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import useSwipeToDismiss from './useSwipeToDismiss';
import {
  fmtNum, fmtVolume, fmtLongDate, dayKey,
  periodRange, PERIOD_OPTIONS,
} from './prMath';

const GREEN = '#22C55E';
const RED = '#EF4444';
const LINE = '#3B82F6';

const sectionLabel = { fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 };

// A small pill that opens a floating option menu styled like the app's FAB
// speed-dial (white rounded cards that animate up; the selected one is accent).
function DropdownPill({ value, options, onChange, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.id === value) || options[0];
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        {current.label}
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div style={{ position: 'absolute', top: '100%', [align]: 0, marginTop: '8px', zIndex: 201, display: 'flex', flexDirection: 'column', alignItems: align === 'right' ? 'flex-end' : 'flex-start', gap: '8px' }}>
            {options.map((o, i) => {
              const sel = o.id === value;
              return (
                <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }}
                  style={{ whiteSpace: 'nowrap', minWidth: '110px', textAlign: align === 'right' ? 'right' : 'left', background: sel ? 'var(--accent)' : 'var(--card)', color: sel ? '#fff' : 'var(--text-primary)', border: sel ? 'none' : '1px solid var(--border)', borderRadius: '20px', padding: '10px 16px', fontSize: '13px', fontWeight: sel ? 700 : 500, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.14)', animation: `fabItemIn 0.2s cubic-bezier(0.2,0.8,0.2,1) ${i * 0.04}s both` }}>
                  {o.label}
                </button>
              );
            })}
          </div>
          <style>{`@keyframes fabItemIn { from { opacity: 0; transform: translateY(14px) scale(0.85); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
        </>
      )}
    </div>
  );
}

// ── chart draw-in animation (same pattern used across the app's charts) ──
function useChartDraw(ref, dep) {
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

// Full-width trend chart: gradient fill + line + dots. Tapping a dot shows a
// popup with the exact value + date for that point. Matches the measurements
// DetailChart style.
function TrendChart({ points, color, formatValue }) {
  const wrapRef = useRef(null);
  const lineRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset any open popup whenever the underlying series changes (e.g. metric toggle).
  useEffect(() => { setActive(null); }, [points]);

  const H = 140, padX = 8, padTop = 14, padBottom = 12;
  const cW = Math.max(0, width - padX * 2);
  const cH = H - padTop - padBottom;
  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = (max - min) || 1;
  const pts = points.map((p, i) => {
    const x = padX + (points.length === 1 ? cW / 2 : (i / (points.length - 1)) * cW);
    const y = padTop + (1 - (p.value - min) / range) * cH;
    return [x, y];
  });
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const fillPath = pts.length ? `${linePath} L${pts[pts.length - 1][0]},${padTop + cH} L${pts[0][0]},${padTop + cH} Z` : '';
  const gradId = `prgrad-${color.replace('#', '')}`;
  const drawn = useChartDraw(lineRef, `${width}:${linePath}`);

  const labelPts = points.length <= 1
    ? points
    : [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]];

  return (
    <div ref={wrapRef} style={{ width: '100%', marginTop: '14px', position: 'relative' }}>
      {width > 0 && (
        <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {points.length > 1 && <path d={fillPath} fill={`url(#${gradId})`} style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.7s ease' }} />}
          {points.length > 1 && <path ref={lineRef} d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y}
              r={active === i ? 5.5 : 3.5}
              fill={active === i ? color : color}
              stroke={active === i ? 'var(--card)' : 'none'} strokeWidth="2"
              onClick={() => setActive(active === i ? null : i)}
              style={{ cursor: 'pointer', opacity: drawn ? 1 : 0, transition: 'opacity 0.4s ease, r 0.15s ease', transitionDelay: drawn ? '0s' : `${0.3 + i * 0.05}s` }} />
          ))}
        </svg>
      )}
      {/* Tap popup */}
      {active != null && pts[active] && (
        <div style={{
          position: 'absolute', left: pts[active][0], top: pts[active][1] - 12,
          transform: 'translate(-50%, -100%)', background: 'var(--text-primary)', color: 'var(--card)',
          padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap',
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)', pointerEvents: 'none', zIndex: 2,
        }}>
          {formatValue(points[active].value)}
          <div style={{ fontSize: '10px', fontWeight: '500', opacity: 0.8, marginTop: '1px' }}>{fmtLongDate(points[active].date)}</div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        {labelPts.map((p, i) => (
          <span key={i} style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {p.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        ))}
      </div>
    </div>
  );
}

// One expandable workout row, reused by the Recent Workouts card and the View All sheet.
function WorkoutRow({ entry, accent, hasPr }) {
  const [open, setOpen] = useState(false);
  const { weights, totalReps, totalSets, volume, avgWeight } = entry.sets;
  const avgReps = totalSets ? totalReps / totalSets : 0;

  const pill = (label, value) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '12px', whiteSpace: 'nowrap' }}>
      <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>{value}</span>
    </span>
  );

  return (
    <div style={{ padding: '12px', borderLeft: `3px solid ${accent ? LINE : 'transparent'}`, borderBottom: '1px solid var(--border)' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{fmtLongDate(entry.date)}</div>
          {hasPr && (
            <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 7px', borderRadius: '8px' }}>1RM</span>
          )}
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            {fmtVolume(volume)}<span style={{ fontSize: '0.7em', fontWeight: '600', marginLeft: '2px' }}>lbs</span>
          </span>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)' }}>
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
        {pill('Avg Weight', `${fmtNum(avgWeight)} lb`)}
        {pill('Avg Reps', fmtNum(avgReps))}
        {pill('Sets', totalSets)}
      </div>
      {open && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {weights.map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', padding: '6px 10px', background: 'var(--bg)', borderRadius: '8px' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Set {i + 1}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>
                {fmtNum(w)} lb × {entry.sets.repsArr ? entry.sets.repsArr[i] : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonalRecordDetail({ exercise, prs = [], metricSystem = 'imperial', onAddPr = () => {}, onClose = () => {} }) {
  const [shown, setShown] = useState(false);
  const [period, setPeriod] = useState(() => localStorage.getItem(`prPeriod_${exercise.name}`) || 'month');
  const [metric, setMetric] = useState('volume');         // 'volume' | 'avg' | '1rm'
  const [logOpen, setLogOpen] = useState(false);
  const [logWeight, setLogWeight] = useState('');
  const [logUnit, setLogUnit] = useState(metricSystem === 'metric' ? 'kg' : 'lbs');
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [allOpen, setAllOpen] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(id); document.body.style.overflow = prev; };
  }, []);

  useEffect(() => { localStorage.setItem(`prPeriod_${exercise.name}`, period); }, [period, exercise.name]);

  useEffect(() => {
    if (showAll) { const id = requestAnimationFrame(() => setAllOpen(true)); return () => cancelAnimationFrame(id); }
  }, [showAll]);

  const requestClose = () => setShown(false);
  const onSheetTransitionEnd = (e) => { if (e.propertyName === 'transform' && !shown) onClose(); };
  const { dragY, dragging, scrollRef, sheetRef, onPointerDown } = useSwipeToDismiss({ onDismiss: requestClose });

  const closeAll = () => { setAllOpen(false); setTimeout(() => setShowAll(false), 350); };
  const all = useSwipeToDismiss({ onDismiss: closeAll });

  // ── derived data ──
  const sessionsAsc = exercise.sessions;                          // chronological
  const sessionsDesc = [...sessionsAsc].reverse();               // newest first
  const prsByDay = new Set(prs.map(p => dayKey(new Date(p.recorded_at))));

  // 1RM = heaviest single logged PR (all time, regardless of period).
  const oneRm = prs.length
    ? prs.reduce((best, p) => (Number(p.weight) > Number(best.weight) ? p : best))
    : null;

  // Period stats for volume + workout count, with prev-period deltas.
  const now = new Date();
  const { start, prevStart, prevEnd, hasPrev } = periodRange(period, now);
  const inCur = (s) => s.date >= start && s.date <= now;
  const inPrev = (s) => s.date >= prevStart && s.date < prevEnd;
  const curSessions = sessionsAsc.filter(inCur);
  const prevSessions = hasPrev ? sessionsAsc.filter(inPrev) : [];
  const curVol = curSessions.reduce((sum, s) => sum + s.sets.volume, 0);
  const prevVol = prevSessions.reduce((sum, s) => sum + s.sets.volume, 0);
  const curCount = curSessions.length;
  const prevCount = prevSessions.length;

  const delta = (cur, prev, fmt) => {
    if (!hasPrev) return null;
    const diff = cur - prev;
    if (diff === 0) return { text: 'No change', color: 'var(--text-muted)' };
    return { text: `${diff > 0 ? '↑' : '↓'} ${fmt(Math.abs(diff))}`, color: diff > 0 ? GREEN : RED };
  };
  const volDelta = delta(curVol, prevVol, fmtVolume);
  const countDelta = delta(curCount, prevCount, n => String(n));

  // Performance Progress trend points — Volume / Avg Weight per session, or 1RM over time.
  let chartPoints, formatChartValue, chartEmptyMsg;
  if (metric === '1rm') {
    chartPoints = [...prs]
      .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
      .map(p => ({ date: new Date(p.recorded_at), value: Number(p.weight) }));
    formatChartValue = (v) => `${fmtNum(v)} lbs`;
    chartEmptyMsg = 'Log at least two 1RMs to see your progress.';
  } else if (metric === 'avg') {
    chartPoints = sessionsAsc.map(s => ({ date: s.date, value: Math.round(s.sets.avgWeight * 10) / 10 }));
    formatChartValue = (v) => `${fmtNum(v)} lbs avg`;
    chartEmptyMsg = 'Log at least two sessions to see your progress.';
  } else {
    chartPoints = sessionsAsc.map(s => ({ date: s.date, value: s.sets.volume }));
    formatChartValue = (v) => `${fmtVolume(v)} lbs`;
    chartEmptyMsg = 'Log at least two sessions to see your progress.';
  }

  const recent = sessionsDesc.slice(0, 4);

  // ── save a 1RM ──
  const saveOneRm = async () => {
    const w = parseFloat(logWeight);
    if (!w || saving) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) { setSaving(false); return; }
    const { data, error } = await supabase.from('exercise_prs').insert({
      user_id: uid, exercise_name: exercise.name, weight: w, unit: logUnit, recorded_at: new Date().toISOString(),
    }).select().single();
    setSaving(false);
    if (error) return;
    onAddPr(data);
    setLogWeight('');
    setLogOpen(false);
  };

  // Overview column (big value + label + sub line), with a left divider for cols 2/3.
  const overviewCol = (big, label, sub, subColor, withDivider) => (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 4px' }}>
      {withDivider && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, background: 'var(--border)', opacity: 0.6 }} />}
      <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.5px' }}>{big}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '5px' }}>{label}</div>
      <div style={{ fontSize: '11px', fontWeight: '600', marginTop: '3px', color: subColor || 'var(--text-muted)', lineHeight: 1.2, minHeight: '13px' }}>{sub}</div>
    </div>
  );

  return createPortal(
    <div onClick={requestClose}
      style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', opacity: shown ? 1 : 0, transition: 'opacity 0.28s ease', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div ref={sheetRef} onClick={e => e.stopPropagation()} onPointerDown={onPointerDown} onTransitionEnd={onSheetTransitionEnd}
        style={{
          width: '100%', maxWidth: 480, height: '100vh', background: 'var(--bg)', borderRadius: '18px 18px 0 0',
          display: 'flex', flexDirection: 'column',
          transform: shown ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: dragging ? 'none' : 'transform 0.34s cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', overflow: 'hidden',
        }}>
        {/* Grabber + header */}
        <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: 14, position: 'relative' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.4px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exercise.name}</h1>
            <button onClick={() => setLogOpen(o => !o)}
              style={{ flexShrink: 0, padding: '8px 14px', borderRadius: '20px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
              Log 1RM
            </button>
            {/* Log 1RM inline menu */}
            {logOpen && (
              <>
                <div onClick={() => setLogOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 21, background: 'var(--card)', border: '1.5px solid var(--accent)', borderRadius: '8px', padding: '14px', boxShadow: '0 8px 28px rgba(0,0,0,0.18)', width: '230px' }}>
                  <p style={{ ...sectionLabel, marginBottom: '10px' }}>Log 1 Rep Max</p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input autoFocus value={logWeight} onChange={e => setLogWeight(e.target.value)} inputMode="decimal" placeholder="Weight"
                      onKeyDown={e => { if (e.key === 'Enter') saveOneRm(); }}
                      className="input" style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '10px' }} />
                    <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                      {['lbs', 'kg'].map(u => (
                        <button key={u} onClick={() => setLogUnit(u)}
                          style={{ padding: '8px 9px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700', background: logUnit === u ? 'var(--accent)' : 'transparent', color: logUnit === u ? '#fff' : 'var(--text-secondary)' }}>
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={saveOneRm} disabled={saving}
                    style={{ width: '100%', marginTop: '10px', padding: '10px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                    Save
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Overview */}
          <div className="card-flat" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <p style={sectionLabel}>Overview</p>
              <DropdownPill value={period} options={PERIOD_OPTIONS} onChange={setPeriod} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
              {overviewCol(
                oneRm ? <>{fmtNum(oneRm.weight)}<span style={{ fontSize: '0.6em', fontWeight: '600', marginLeft: '2px' }}>{oneRm.unit}</span></> : <>0<span style={{ fontSize: '0.6em', fontWeight: '600', marginLeft: '2px' }}>lb</span></>,
                '1 Rep Max',
                oneRm ? fmtLongDate(new Date(oneRm.recorded_at)) : 'No 1RM logged',
                'var(--text-muted)',
                false,
              )}
              {overviewCol(
                <>{fmtVolume(curVol)}</>,
                'Total Volume',
                volDelta ? volDelta.text : '',
                volDelta ? volDelta.color : undefined,
                true,
              )}
              {overviewCol(
                <>{curCount}</>,
                'Total Workouts',
                countDelta ? countDelta.text : '',
                countDelta ? countDelta.color : undefined,
                true,
              )}
            </div>
          </div>

          {/* Performance Progress */}
          <div className="card-flat" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <p style={sectionLabel}>Performance Progress</p>
              <DropdownPill
                value={metric}
                options={[{ id: 'volume', label: 'Volume' }, { id: 'avg', label: 'Avg Weight' }, { id: '1rm', label: '1RM' }]}
                onChange={setMetric}
              />
            </div>
            {chartPoints.length >= 2 ? (
              <TrendChart points={chartPoints} color={LINE} formatValue={formatChartValue} />
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '28px 0 12px' }}>
                {chartEmptyMsg}
              </p>
            )}
          </div>

          {/* Recent Workouts */}
          <div className="card-flat" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <p style={sectionLabel}>Recent Workouts</p>
              {sessionsDesc.length > recent.length && (
                <button onClick={() => setShowAll(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '13px', fontWeight: '600', padding: '2px 4px' }}>
                  View All
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recent.map((entry, i) => (
                <WorkoutRow key={`${entry.id}-${i}`} entry={entry} accent={i === 0} hasPr={prsByDay.has(dayKey(entry.date))} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* View All — full-screen bottom sheet */}
      {showAll && (
        <div ref={all.sheetRef} onClick={e => e.stopPropagation()} onPointerDown={all.onPointerDown} style={{
          position: 'fixed', inset: 0, zIndex: 760, background: 'var(--bg)',
          transform: allOpen ? `translateY(${all.dragY}px)` : 'translateY(100%)',
          transition: all.dragging ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, userSelect: 'none' }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
          </div>
          <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px' }}>{exercise.name}</h2>
            <p style={{ ...sectionLabel, marginTop: '6px' }}>All Workouts</p>
          </div>
          <div ref={all.scrollRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 32px' }}>
            {sessionsDesc.map((entry, i) => (
              <WorkoutRow key={`${entry.id}-${i}`} entry={entry} accent={i === 0} hasPr={prsByDay.has(dayKey(entry.date))} />
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

export default PersonalRecordDetail;
