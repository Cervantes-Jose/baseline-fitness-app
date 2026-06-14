import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import {
  ymd, parseYmd, isScheduled, weekDates, monthGrid, DOW_LETTER, DOW_SHORT,
  weekProgress, monthProgress, currentStreak, longestStreak, daysTrackedThisMonth,
  habitSubtitle,
} from './habitMath';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Detail for a single habit, presented as a bottom-up full-screen sheet (swipe down
// to dismiss). Overview stats, This Week strip, Month calendar, and history. Scheduled
// days are checkable circles; non-scheduled days are greyed and inert.
export default function HabitDetail({ habit, onBack, onEdit = () => {}, onDelete = () => {}, showToast = () => {} }) {
  const [doneSet, setDoneSet] = useState(() => new Set());   // Set of ymd strings
  const [monthRef, setMonthRef] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const todayStr = ymd(new Date());

  // Sheet slide-in/out + swipe-down
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(id); document.body.style.overflow = prev; };
  }, []);

  const requestClose = () => setShown(false);
  const onSheetTransitionEnd = (e) => { if (e.propertyName === 'transform' && !shown) onBack(); };

  const onPointerDown = (e) => { dragStart.current = e.clientY; };
  const onPointerMove = (e) => { if (dragStart.current === null) return; const dy = e.clientY - dragStart.current; if (dy > 0) setDragY(dy); };
  const onPointerUp = () => { if (dragStart.current === null) return; if (dragY > 120) requestClose(); else setDragY(0); dragStart.current = null; };

  const loadLogs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('habit_logs').select('date').eq('habit_id', habit.id).eq('user_id', user.id);
    if (data) setDoneSet(new Set(data.map(r => r.date)));
  }, [habit.id]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Toggle a day's completion. Optimistic; reverts on error.
  const toggleDay = async (date) => {
    if (!isScheduled(habit, date)) return;
    const key = ymd(date);
    if (key > todayStr) return; // no checking the future
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const next = new Set(doneSet);
    const wasDone = next.has(key);
    wasDone ? next.delete(key) : next.add(key);
    setDoneSet(next);
    if (wasDone) {
      const { error } = await supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('user_id', user.id).eq('date', key);
      if (error) { showToast('Could not update'); loadLogs(); }
    } else {
      const { error } = await supabase.from('habit_logs').insert({ habit_id: habit.id, user_id: user.id, date: key });
      if (error) { showToast('Could not update'); loadLogs(); }
    }
  };

  const week = weekDates();
  const wk = weekProgress(habit, doneSet);
  const mp = monthProgress(habit, doneSet, monthRef.getFullYear(), monthRef.getMonth());
  const cells = monthGrid(monthRef.getFullYear(), monthRef.getMonth());
  const historyDates = [...doneSet].sort((a, b) => (a < b ? 1 : -1)).map(parseYmd); // newest first

  const stats = [
    { label: 'Current Streak', value: currentStreak(habit, doneSet), sub: 'Days' },
    { label: 'Longest Streak', value: longestStreak(habit, doneSet), sub: 'Days' },
    { label: 'Days Tracked', value: daysTrackedThisMonth(doneSet), sub: 'This Month' },
  ];

  const canGoNextMonth = monthRef.getFullYear() < new Date().getFullYear()
    || (monthRef.getFullYear() === new Date().getFullYear() && monthRef.getMonth() < new Date().getMonth());

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
      <div onClick={e => e.stopPropagation()} onTransitionEnd={onSheetTransitionEnd}
        style={{
          width: '100%', maxWidth: 480, height: '100vh', background: 'var(--bg)', borderRadius: '18px 18px 0 0',
          display: 'flex', flexDirection: 'column',
          transform: shown ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: dragStart.current === null ? 'transform 0.34s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', overflow: 'hidden',
        }}>
        {/* Grabber + header (drag target) */}
        <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          style={{ padding: '10px 16px 0', flexShrink: 0, touchAction: 'none' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 10px' }} />
          {/* No back button — swipe down (or tap the backdrop) dismisses the sheet. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={onEdit} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '4px 8px' }}>Edit</button>
              <button onClick={() => setConfirmDelete(true)} aria-label="Delete habit"
                style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px 8px', display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.4px' }}>{habit.name}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 12px' }}>{habitSubtitle(habit)}</p>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Overview */}
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 4px 8px' }}>Overview</p>
            <div className="card-flat" style={{ padding: '16px 20px' }}>
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
          </div>

          {/* This Week */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 4px 8px' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>This Week</p>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{wk.done} of {wk.scheduled} days</span>
            </div>
            <div className="card-flat" style={{ padding: '14px 6px' }}>
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
          </div>

          {/* Month Overview */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 4px 8px' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Month Overview</p>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{mp.done} of {mp.scheduled} days</span>
            </div>
            <div className="card-flat" style={{ padding: '16px' }}>
              {/* Month label (top-left) + arrows (to its right) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{MONTH_NAMES[monthRef.getMonth()]} {monthRef.getFullYear()}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => setMonthRef(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 22, padding: '2px 6px', lineHeight: 1 }}>‹</button>
                  <button onClick={() => canGoNextMonth && setMonthRef(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} disabled={!canGoNextMonth}
                    style={{ background: 'none', border: 'none', cursor: canGoNextMonth ? 'pointer' : 'default', color: 'var(--text-secondary)', fontSize: 22, padding: '2px 6px', lineHeight: 1, opacity: canGoNextMonth ? 1 : 0.3 }}>›</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
                {[1,2,3,4,5,6,0].map(dow => (
                  <div key={dow} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>{DOW_LETTER[dow]}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, justifyItems: 'center' }}>
                {cells.map((cell, i) => {
                  if (!cell.inMonth) return <div key={i} style={{ width: 28, height: 28 }} />;
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 10, color: ymd(cell.date) === todayStr ? 'var(--accent)' : 'var(--text-muted)', fontWeight: ymd(cell.date) === todayStr ? 700 : 400 }}>{cell.date.getDate()}</span>
                      {dayCircle(cell.date, 24)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* History — flat list, newest first; the most recent gets a blue accent bar */}
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 4px 8px' }}>History</p>
            {historyDates.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No completed days yet.</p>
            ) : (
              <div className="card-flat" style={{ padding: 0, overflow: 'hidden' }}>
                {historyDates.map((d, i) => (
                  <div key={ymd(d)} style={{
                    display: 'flex', alignItems: 'center', padding: '14px 12px',
                    borderLeft: `3px solid ${i === 0 ? 'var(--accent)' : 'transparent'}`,
                    borderBottom: i < historyDates.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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
