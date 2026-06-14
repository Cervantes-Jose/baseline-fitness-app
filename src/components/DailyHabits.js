import { useState, useEffect, useCallback } from 'react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../supabaseClient';
import AddHabitPage from './AddHabitPage';
import HabitDetail from './HabitDetail';
import { habitSubtitle } from './habitMath';

// One habit row: tap the body to open its detail sheet; the right-side handle drags
// to reorder (600ms long-press, like Routines).
function SortableHabitRow({ habit, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 1, position: 'relative' }}
      {...attributes}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
        background: 'var(--bg)',
        transform: isDragging ? 'scale(1.02)' : 'scale(1)', transition: 'transform 0.2s ease',
      }}>
        <div onClick={() => onOpen(habit)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{habit.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{habitSubtitle(habit)}</div>
        </div>
        <div {...listeners} style={{ touchAction: 'none', cursor: 'grab', padding: 8, color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="6" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="5" r="1.5" fill="currentColor"/>
            <circle cx="6" cy="9" r="1.5" fill="currentColor"/><circle cx="12" cy="9" r="1.5" fill="currentColor"/>
            <circle cx="6" cy="13" r="1.5" fill="currentColor"/><circle cx="12" cy="13" r="1.5" fill="currentColor"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

// Profile > Daily Habits. Owns its own header. Add Habit opens a full page; tapping a
// habit opens a bottom-up full-screen detail sheet.
export default function DailyHabits({ onBack, showToast = () => {} }) {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');        // 'list' | 'form'
  const [editing, setEditing] = useState(null);     // habit being edited (null = create)
  const [detailHabit, setDetailHabit] = useState(null); // open detail sheet

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 600, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 600, tolerance: 8 } })
  );

  const loadHabits = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from('habits').select('*').eq('user_id', user.id).order('position', { ascending: true });
    if (data) setHabits(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadHabits(); }, [loadHabits]);

  const saveHabit = async (fields) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (editing) {
      const { data, error } = await supabase.from('habits').update(fields).eq('id', editing.id).eq('user_id', user.id).select().single();
      if (error) { showToast('Could not save habit'); return; }
      setHabits(prev => prev.map(h => (h.id === data.id ? data : h)));
    } else {
      const { data, error } = await supabase.from('habits')
        .insert({ ...fields, user_id: user.id, position: habits.length }).select().single();
      if (error) { showToast('Could not add habit'); return; }
      setHabits(prev => [...prev, data]);
    }
    setView('list');
    setEditing(null);
  };

  const deleteHabit = async (id) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setHabits(prev => prev.filter(h => h.id !== id));
    setDetailHabit(null);
    const { error } = await supabase.from('habits').delete().eq('id', id).eq('user_id', user.id);
    if (error) { showToast('Could not delete'); loadHabits(); }
  };

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = habits.findIndex(h => h.id === active.id);
    const newIndex = habits.findIndex(h => h.id === over.id);
    const reordered = arrayMove(habits, oldIndex, newIndex);
    setHabits(reordered);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await Promise.all(reordered.map((h, i) =>
      h.position === i ? null : supabase.from('habits').update({ position: i }).eq('id', h.id).eq('user_id', user.id)
    ));
  };

  // ── Add / Edit full page ──
  if (view === 'form') {
    return <AddHabitPage initial={editing} onBack={() => { setView('list'); setEditing(null); }} onSave={saveHabit} />;
  }

  // ── List view (with detail sheet overlay) ──
  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Header — title dropped a little below the back button; two-line subtitle */}
      <div style={{ padding: '16px 20px 0' }}>
        <button onClick={onBack} aria-label="Back"
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, display: 'flex', marginBottom: 16 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>Daily Habits</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>
          Track the habits that support<br />your goals, every day.
        </p>
      </div>

      {/* My Habits — flush with the background (no card) */}
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: habits.length ? 4 : 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>My Habits</p>
          <button onClick={() => { setEditing(null); setView('form'); }}
            style={{ background: 'transparent', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '7px 12px' }}>
            + Add Habit
          </button>
        </div>

        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>Loading…</p>
        ) : habits.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', padding: '20px 0 8px', textAlign: 'center' }}>
            No habits yet. Tap “Add Habit” to create your first one.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={habits.map(h => h.id)} strategy={verticalListSortingStrategy}>
              {habits.map((h, i) => (
                <div key={h.id} style={{ borderTop: i === 0 ? '1px solid var(--border)' : 'none', borderBottom: '1px solid var(--border)' }}>
                  <SortableHabitRow habit={h} onOpen={setDetailHabit} />
                </div>
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {detailHabit && (
        <HabitDetail
          habit={detailHabit}
          showToast={showToast}
          onBack={() => setDetailHabit(null)}
          onEdit={() => { setEditing(detailHabit); setDetailHabit(null); setView('form'); }}
          onDelete={() => deleteHabit(detailHabit.id)}
        />
      )}
    </div>
  );
}
