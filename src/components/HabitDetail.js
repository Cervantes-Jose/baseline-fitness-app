import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import {
  ymd, parseYmd, isScheduled, weekDates, DOW_SHORT,
  weekProgress, monthProgress, currentStreak, longestStreak, daysTrackedThisMonth,
  habitSubtitle,
} from './habitMath';
import useSwipeToDismiss from './useSwipeToDismiss';
import ScrollMonthStack from './ScrollMonthStack';

// Detail for a single habit, presented as a bottom-up full-screen sheet (swipe down
// to dismiss). Overview stats, This Week strip, Month calendar, and history. Scheduled
// days are checkable circles; non-scheduled days are greyed and inert.
export default function HabitDetail({ habit, onBack, onEdit = () => {}, onDelete = () => {}, showToast = () => {} }) {
  const [doneSet, setDoneSet] = useState(() => new Set());   // Set of ymd strings
  const [logTargets, setLogTargets] = useState({});          // ymd -> target snapshot at log time
  const [confirmDelete, setConfirmDelete] = useState(false);
  const todayStr = ymd(new Date());

  // Sheet slide-in/out + swipe-down
  const [shown, setShown] = useState(false);

  // "View All" history sheet — mirrors the measurements detail history sheet exactly.
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const sectionLabel = { fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 };

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(id); document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (showAllHistory) {
      const id = requestAnimationFrame(() => setHistoryOpen(true));
      return () => cancelAnimationFrame(id);
    }
  }, [showAllHistory]);

  const closeAllHistory = () => { setHistoryOpen(false); setTimeout(() => setShowAllHistory(false), 350); };
  const hist = useSwipeToDismiss({ onDismiss: closeAllHistory });

  const requestClose = () => setShown(false);
  const onSheetTransitionEnd = (e) => { if (e.propertyName === 'transform' && !shown) onBack(); };

  // Swipe down anywhere on the body (once scrolled to the top) to dismiss.
  const { dragY, dragging, scrollRef, sheetRef, onPointerDown } = useSwipeToDismiss({ onDismiss: requestClose });

  const loadLogs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('habit_logs').select('date, target').eq('habit_id', habit.id).eq('user_id', user.id);
    if (data) {
      setDoneSet(new Set(data.map(r => r.date)));
      setLogTargets(Object.fromEntries(data.map(r => [r.date, r.target])));
    }
  }, [habit.id]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Toggle a day's completion. Optimistic; reverts on error.
  const toggleDay = async (date) => {
    if (!isScheduled(habit, date)) return;
    const key = ymd(date);
    if (key > todayStr) return; // no checking the future
    const next = new Set(doneSet);
    const wasDone = next.has(key);
    wasDone ? next.delete(key) : next.add(key);
    // Snapshot the habit's current target so this day's history keeps showing the
    // value as it was, even if the habit's target is edited later.
    const snapshot = habit.target || null;
    // Optimistic UI first so the check feels instant — don't wait on getUser().
    setDoneSet(next);
    if (wasDone) {
      setLogTargets(prev => { const n = { ...prev }; delete n[key]; return n; });
    } else {
      setLogTargets(prev => ({ ...prev, [key]: snapshot }));
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { loadLogs(); return; }   // couldn't persist — re-sync to server truth
    if (wasDone) {
      const { error } = await supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('user_id', user.id).eq('date', key);
      if (error) { showToast('Could not update'); loadLogs(); }
    } else {
      const { error } = await supabase.from('habit_logs').insert({ habit_id: habit.id, user_id: user.id, date: key, target: snapshot });
      if (error) { showToast('Could not update'); loadLogs(); }
    }
  };

  const week = weekDates();
  const wk = weekProgress(habit, doneSet);
  const historyDates = [...doneSet].sort((a, b) => (a < b ? 1 : -1)).map(parseYmd); // newest first

  // Months from the first completed day up to the current month (ascending) for the
  // scrolling Month Overview. No completions yet → just the current month.
  const habitMonths = useMemo(() => {
    const n = new Date();
    const end = new Date(n.getFullYear(), n.getMonth(), 1);
    let start = new Date(end);
    if (doneSet.size) {
      let min = null;
      doneSet.forEach(k => { if (min === null || k < min) min = k; });
      if (min) { const d = parseYmd(min); start = new Date(d.getFullYear(), d.getMonth(), 1); }
    }
    const list = [];
    const cur = new Date(start);
    while (cur <= end) { list.push({ y: cur.getFullYear(), m: cur.getMonth() }); cur.setMonth(cur.getMonth() + 1); }
    return list;
  }, [doneSet]);
  const last5 = historyDates.slice(0, 5);

  // One history row — matches the measurements detail row exactly (size, accent bar, divider).
  // The right side shows the target snapshot for that day (e.g. "5g") when one was recorded.
  const renderHistoryRow = (d, i, arr) => {
    const t = logTargets[ymd(d)];
    return (
      <div key={ymd(d)} style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '12px',
        borderLeft: `3px solid ${i === 0 ? 'var(--accent)' : 'transparent'}`,
        borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        {t ? (
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t}</span>
        ) : null}
      </div>
    );
  };

  const stats = [
    { label: 'Current Streak', value: currentStreak(habit, doneSet), sub: 'Days' },
    { label: 'Longest Streak', value: longestStreak(habit, doneSet), sub: 'Days' },
    { label: 'Days Tracked', value: daysTrackedThisMonth(doneSet), sub: 'This Month' },
  ];

  // A check/empty circle. `scheduled=false` → greyed dot, inert.
  const dayCircle = (date, size = 24) => {
    const scheduled = isScheduled(habit, date);
    const key = ymd(date);
    const done = doneSet.has(key);
    const future = key > todayStr;
    if (!scheduled) {
      return <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--bg)', border: '1px dashed var(--border)', opacity: 0.5 }} />;
    }
    return (
      <button onClick={() => toggleDay(date)} disabled={future} aria-label={`Toggle ${key}`}
        style={{
          width: size, height: size, borderRadius: '50%', cursor: future ? 'default' : 'pointer', padding: 0,
          border: done ? 'none' : `2px solid ${future ? 'var(--border)' : 'var(--accent)'}`,
          background: done ? 'var(--accent)' : 'transparent',
          opacity: future ? 0.4 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
        {done && <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3L11.5 4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </button>
    );
  };

  return createPortal(
    <div onClick={requestClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)',
        opacity: shown ? 1 : 0, transition: 'opacity 0.28s ease',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
      <div ref={sheetRef} onClick={e => e.stopPropagation()} onPointerDown={onPointerDown} onTransitionEnd={onSheetTransitionEnd}
        style={{
          width: '100%', maxWidth: 480, height: '100vh', background: 'var(--bg)', borderRadius: '18px 18px 0 0',
          display: 'flex', flexDirection: 'column',
          transform: shown ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: dragging ? 'none' : 'transform 0.34s cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', overflow: 'hidden',
        }}>
        {/* Grabber + header */}
        <div
          style={{ padding: '10px 16px 0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 10px' }} />
          {/* No back button — swipe down (or tap the backdrop) dismisses the sheet. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button onClick={onEdit} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '4px 8px' }}>Edit</button>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.4px' }}>{habit.name}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 12px' }}>{habitSubtitle(habit)}</p>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Overview */}
          <div className="card-flat" style={{ padding: '16px 20px' }}>
            <p style={{ ...sectionLabel, marginBottom: 12 }}>Overview</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {stats.map((s, i) => (
                <div key={s.label} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  {i > 0 && <div style={{ position: 'absolute', left: -4, top: 0, bottom: 0, width: 1, background: 'var(--border)', opacity: 0.6 }} />}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 4 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* This Week */}
          <div className="card-flat" style={{ padding: '14px 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' }}>
              <p style={sectionLabel}>This Week</p>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{wk.done} of {wk.scheduled} days</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              {week.map((d, i) => (
                <Fragment key={i}>
                  {i > 0 && <div style={{ width: 1, background: 'var(--border)', opacity: 0.6, margin: '2px 0' }} />}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '0 1px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{DOW_SHORT[d.getDay()]}</span>
                    <span style={{ fontSize: 10, color: ymd(d) === todayStr ? 'var(--accent)' : 'var(--text-muted)', fontWeight: ymd(d) === todayStr ? 700 : 400 }}>{d.getMonth() + 1}/{d.getDate()}</span>
                    {dayCircle(d, 24)}
                  </div>
                </Fragment>
              ))}
            </div>
          </div>

          {/* Month Overview — one continuously-scrolling stack of months (current month
              rests slightly-low; scroll up for older) in place of prev/next paging. Bounded
              so this mid-sheet section stays compact and doesn't fight the sheet's
              swipe-to-dismiss. Each month shows its own completed/scheduled count. */}
          <div className="card-flat" style={{ padding: '16px' }}>
            <p style={{ ...sectionLabel, marginBottom: 14 }}>Month Overview</p>
            <ScrollMonthStack
              bounded
              months={habitMonths}
              renderDay={(d) => dayCircle(d, 24)}
              monthMeta={(y, m) => {
                const p = monthProgress(habit, doneSet, y, m);
                return <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{p.done} of {p.scheduled} days</span>;
              }}
            />
          </div>

          {/* History — flat list, newest first; the most recent gets an accent bar. Up to 5
              show here; the rest live behind "View All". Mirrors the measurements detail. */}
          {historyDates.length === 0 ? (
            <div className="card-flat">
              <p style={sectionLabel}>History</p>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0 8px' }}>No completed days yet.</p>
            </div>
          ) : (
            <div className="card-flat">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <p style={sectionLabel}>History</p>
                <button onClick={() => setShowAllHistory(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '13px', fontWeight: '600', padding: '2px 4px' }}>
                  View All
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {last5.map((d, i, arr) => renderHistoryRow(d, i, arr))}
              </div>
            </div>
          )}

          {/* Delete — outlined red button below History */}
          <button onClick={() => setConfirmDelete(true)}
            style={{ width: '100%', background: 'transparent', border: '1px solid #EF4444', borderRadius: 12, color: '#EF4444', cursor: 'pointer', fontSize: 15, fontWeight: 700, padding: '14px' }}>
            Delete Habit
          </button>
        </div>
      </div>

      {/* View All — full-screen bottom sheet (mirrors the measurements detail history sheet) */}
      {showAllHistory && (
        <div ref={hist.sheetRef} onClick={e => e.stopPropagation()} onPointerDown={hist.onPointerDown} style={{
          position: 'fixed', inset: 0, zIndex: 760, background: 'var(--bg)',
          transform: historyOpen ? `translateY(${hist.dragY}px)` : 'translateY(100%)',
          transition: hist.dragging ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, userSelect: 'none' }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
          </div>
          <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px' }}>{habit.name}</h2>
            <p style={{ ...sectionLabel, marginTop: '6px' }}>History</p>
          </div>
          <div ref={hist.scrollRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 32px' }}>
            {historyDates.map((d, i, arr) => renderHistoryRow(d, i, arr))}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 800, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: 16, padding: 24, width: 320, maxWidth: '100%' }}>
            <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', margin: '0 0 6px' }}>Delete habit?</p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 20px' }}>“{habit.name}” and all its tracked days will be removed. This can’t be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={() => { setConfirmDelete(false); onDelete(); }} style={{ flex: 1, background: '#EF4444', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
