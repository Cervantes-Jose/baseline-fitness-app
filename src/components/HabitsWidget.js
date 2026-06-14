import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { ymd, isScheduled, habitSubtitle } from './habitMath';

// Dashboard card: up to 4 habits in a 2×2 grid, each check-offable for *today*.
// "View All" opens a sheet listing every habit, also checkable. Checking tints the
// card slightly blue. Hidden entirely when the user has no habits.
//
// Today's check respects scheduling: a habit not scheduled today shows a muted
// "rest day" circle and isn't checkable, keeping logs consistent with streak stats.
export default function HabitsWidget() {
  const [habits, setHabits] = useState([]);
  const [doneToday, setDoneToday] = useState(() => new Set()); // habit_ids done today
  const [viewAll, setViewAll] = useState(false);
  const today = new Date();
  const todayStr = ymd(today);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: hs }, { data: logs }] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).order('position', { ascending: true }),
      supabase.from('habit_logs').select('habit_id').eq('user_id', user.id).eq('date', todayStr),
    ]);
    if (hs) setHabits(hs);
    if (logs) setDoneToday(new Set(logs.map(l => l.habit_id)));
  }, [todayStr]);

  useEffect(() => { load(); }, [load]);

  const toggleToday = async (habit) => {
    if (!isScheduled(habit, today)) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const next = new Set(doneToday);
    const wasDone = next.has(habit.id);
    wasDone ? next.delete(habit.id) : next.add(habit.id);
    setDoneToday(next);
    if (wasDone) {
      await supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('user_id', user.id).eq('date', todayStr);
    } else {
      const { error } = await supabase.from('habit_logs').insert({ habit_id: habit.id, user_id: user.id, date: todayStr });
      if (error) load(); // e.g. unique-violation race — re-sync
    }
  };

  if (habits.length === 0) return null;

  const checkCircle = (habit, size = 26) => {
    const scheduled = isScheduled(habit, today);
    const done = doneToday.has(habit.id);
    return (
      <span style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: done ? 'none' : `2px solid ${scheduled ? 'var(--accent)' : 'var(--border)'}`,
        background: done ? 'var(--accent)' : 'transparent',
        opacity: scheduled ? 1 : 0.5,
      }}>
        {done && <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3L11.5 4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
    );
  };

  // A habit mini-card (dashboard grid). Tinted blue when done.
  const miniCard = (habit) => {
    const done = doneToday.has(habit.id);
    const scheduled = isScheduled(habit, today);
    return (
      <button key={habit.id} onClick={() => toggleToday(habit)} disabled={!scheduled}
        style={{
          flex: 1, minWidth: 0, textAlign: 'left', cursor: scheduled ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14,
          background: done ? 'var(--accent-light)' : 'var(--bg)',
          border: `1px solid ${done ? 'var(--accent)' : 'var(--border)'}`,
          transition: 'background 0.15s, border-color 0.15s',
        }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habitSubtitle(habit)}</div>
        </div>
        {checkCircle(habit, 24)}
      </button>
    );
  };

  // Pair the first 4 habits into rows of two.
  const shown = habits.slice(0, 4);
  const rows = [shown.slice(0, 2), shown.slice(2, 4)].filter(r => r.length);

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Daily Habits</span>
          <button onClick={() => setViewAll(true)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0 }}>
            View All
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: 10 }}>
              {row.map(miniCard)}
              {row.length === 1 && <div style={{ flex: 1 }} />}
            </div>
          ))}
        </div>
      </div>

      {viewAll && <ViewAllSheet habits={habits} doneToday={doneToday} checkCircle={checkCircle}
        onToggle={toggleToday} onClose={() => setViewAll(false)} today={today} />}
    </div>
  );
}

// Bottom sheet listing every habit with a tappable check for today.
function ViewAllSheet({ habits, doneToday, checkCircle, onToggle, onClose, today }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(id); document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', opacity: shown ? 1 : 0, transition: 'opacity 0.28s ease', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, maxHeight: '80vh', background: 'var(--bg)', borderRadius: '20px 20px 0 0',
          display: 'flex', flexDirection: 'column',
          transform: shown ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
        }}>
        <div style={{ padding: '10px 20px 12px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Daily Habits</p>
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 16px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {habits.map(habit => {
            const done = doneToday.has(habit.id);
            return (
              <button key={habit.id} onClick={() => onToggle(habit)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                  background: done ? 'var(--accent-light)' : 'var(--card)',
                  border: `1px solid ${done ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{habit.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{habitSubtitle(habit)}</div>
                </div>
                {checkCircle(habit, 26)}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
