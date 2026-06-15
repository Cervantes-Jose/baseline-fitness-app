// Requires custom_exercises table in Supabase:
// create table custom_exercises (id uuid default uuid_generate_v4() primary key, name text, category text, created_at timestamp default now());

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import RoutineAddMenu from './RoutineAddMenu';
import RoutinePickerSheet from './RoutinePickerSheet';

export const EXERCISE_DATABASE = {
  "Chest": ["Assisted Dip","Band-Assisted Bench Press","Bar Dip","Bench Press","Bench Press Against Band","Board Press","Cable Chest Press","Clap Push-Up","Close-Grip Bench Press","Close-Grip Feet-Up Bench Press","Cobra Push-Up","Decline Bench Press","Decline Push-Up","Dumbbell Chest Fly","Dumbbell Chest Press","Dumbbell Decline Chest Press","Dumbbell Floor Press","Dumbbell Pullover","Feet-Up Bench Press","Floor Press","Incline Bench Press","Incline Dumbbell Press","Incline Push-Up","Kettlebell Floor Press","Kneeling Incline Push-Up","Kneeling Push-Up","Machine Chest Fly","Machine Chest Press","Medicine Ball Chest Pass","Pec Deck","Pin Bench Press","Plank to Push-Up","Push-Up","Push-Up Against Wall","Push-Ups With Feet in Rings","Resistance Band Chest Fly","Ring Dip","Seated Cable Chest Fly","Smith Machine Bench Press","Smith Machine Incline Bench Press","Smith Machine Reverse Grip Bench Press","Standing Cable Chest Fly","Standing Resistance Band Chest Fly"],
  "Shoulders": ["Arnold Press","Band External Shoulder Rotation","Band Internal Shoulder Rotation","Band Pull-Apart","Banded Face Pull","Barbell Front Raise","Barbell Rear Delt Row","Barbell Upright Row","Behind the Neck Press","Cable Internal Shoulder Rotation","Cable External Shoulder Rotation","Cable Front Raise","Cable Lateral Raise","Cable Rear Delt Row","Cuban Press","Devils Press","Dumbbell Front Raise","Dumbbell Lateral Raise","Dumbbell Rear Delt Row","Dumbbell Shoulder Press","Face Pull","Front Hold","Handstand Push-Up","Kettlebell Halo","Kettlebell Press","Kettlebell Push Press","Landmine Press","Machine Lateral Raise","Machine Shoulder Press","Overhead Press","Plate Front Raise","Push Press","Resistance Band Lateral Raise","Reverse Cable Flyes","Reverse Dumbbell Flyes","Reverse Machine Fly","Seated Dumbbell Shoulder Press","Seated Barbell Overhead Press","Seated Smith Machine Shoulder Press","Turkish Get-Up","Z Press"],
  "Biceps": ["Barbell Curl","Barbell Preacher Curl","Bayesian Curl","Bodyweight Curl","Cable Crossover Bicep Curl","Cable Curl With Bar","Cable Curl With Rope","Concentration Curl","Drag Curl","Dumbbell Curl","Dumbbell Preacher Curl","EZ Curl","Hammer Curl","Incline Dumbbell Curl","Kettlebell Curl","Machine Bicep Curl","Overhead Cable Curl","Reverse Barbell Curl","Reverse Dumbbell Curl","Resistance Band Curl","Spider Curl","Zottman Curl"],
  "Triceps": ["Barbell Standing Triceps Extension","Barbell Incline Triceps Extension","Barbell Lying Triceps Extension","Bench Dip","Crossbody Cable Triceps Extension","Close-Grip Push-Up","Dumbbell Lying Triceps Extension","Dumbbell Standing Triceps Extension","EZ Bar Lying Triceps Extension","Machine Overhead Triceps Extension","Overhead Cable Triceps Extension","Smith Machine Skull Crushers","Tate Press","Tricep Bodyweight Extension","Tricep Pushdown With Bar","Tricep Pushdown With Rope"],
  "Legs": ["Air Squat","Barbell Hack Squat","Barbell Lunge","Barbell Walking Lunge","Belt Squat","Body Weight Lunge","Bodyweight Leg Curl","Box Jump","Box Squat","Bulgarian Split Squat","Dumbbell Lunge","Dumbbell Walking Lunge","Dumbbell Squat","Front Squat","Glute Ham Raise","Goblet Squat","Hack Squat Machine","Leg Extension","Leg Press","Lying Leg Curl","Nordic Hamstring Eccentric","Pause Squat","Pistol Squat","Reverse Barbell Lunge","Reverse Dumbbell Lunge","Romanian Deadlift","Safety Bar Squat","Seated Leg Curl","Smith Machine Bulgarian Split Squat","Smith Machine Front Squat","Smith Machine Squat","Squat","Step Up","Sumo Squat","Zercher Squat"],
  "Back": ["Assisted Chin-Up","Assisted Pull-Up","Back Extension","Barbell Row","Barbell Shrug","Cable Close Grip Seated Row","Cable Wide Grip Seated Row","Chest-Supported Dumbbell Row","Chin-Up","Clean","Clean and Jerk","Close-Grip Lat Pulldown","Deadlift","Deficit Deadlift","Dumbbell Deadlift","Dumbbell Row","Dumbbell Shrug","Good Morning","Gorilla Row","Inverted Row","Jefferson Curl","Kettlebell Row","Kettlebell Swing","Kroc Row","Lat Pulldown With Neutral Grip","Lat Pulldown With Pronated Grip","Lat Pulldown With Supinated Grip","Machine Lat Pulldown","Pause Deadlift","Pendlay Row","Power Clean","Pull-Up","Rack Pull","Renegade Row","Ring Row","Seal Row","Seated Machine Row","Snatch","Stiff-Legged Deadlift","Straight Arm Lat Pulldown","Sumo Deadlift","T-Bar Row","Trap Bar Deadlift With High Handles","Trap Bar Deadlift With Low Handles"],
  "Glutes": ["Banded Side Kicks","Cable Glute Kickback","Cable Pull Through","Clamshells","Cossack Squat","Donkey Kicks","Dumbbell Romanian Deadlift","Fire Hydrants","Frog Pumps","Glute Bridge","Hip Thrust","Hip Thrust Machine","Hip Thrust With Band Around Knees","Lateral Walk With Band","Machine Glute Kickbacks","One-Legged Glute Bridge","One-Legged Hip Thrust","Reverse Hyperextension","Romanian Deadlift","Smith Machine Hip Thrust","Single Leg Romanian Deadlift","Step Up"],
  "Abs": ["Ball Slams","Bicycle Crunch","Cable Crunch","Captain's Chair Knee Raise","Captain's Chair Leg Raise","Copenhagen Plank","Crunch","Dead Bug","Dragon Flag","Dumbbell Side Bend","Hanging Knee Raise","Hanging Leg Raise","Hanging Sit-Up","Hollow Body Crunch","Hollow Hold","Jackknife Sit-Up","Kneeling Ab Wheel Roll-Out","L-Sit","Lying Leg Raise","Machine Crunch","Mountain Climbers","Oblique Crunch","Pallof Press","Plank","Plank with Leg Lifts","Plank with Shoulder Taps","Side Plank","Sit-Up","Weighted Plank"],
  "Calves": ["Barbell Standing Calf Raise","Barbell Seated Calf Raise","Calf Raise in Leg Press","Donkey Calf Raise","Eccentric Heel Drop","Seated Calf Raise","Standing Calf Raise"],
  "Forearms & Grip": ["Barbell Wrist Curl","Barbell Wrist Extension","Bar Hang","Dumbbell Wrist Curl","Dumbbell Wrist Extension","Farmers Walk","Gripper","One-Handed Bar Hang","Plate Pinch","Towel Pull-Up","Wrist Roller"],
};

export const CATEGORIES = Object.keys(EXERCISE_DATABASE);

function ExerciseRow({ name, isCustom, categoryLabel, routines, onAddToRoutine, onViewAll, onRename, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);

  // Anchor the popover to the three-dots button using its viewport rect. A portal
  // to document.body avoids the category section's overflow:hidden / transform clipping.
  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setMenuOpen(true);
  };

  const menuItemStyle = {
    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
    padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
    textAlign: 'left', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderRadius: '12px', background: 'var(--bg)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{name}</span>
          {isCustom && (
            <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: '8px' }}>Custom</span>
          )}
        </div>
        {categoryLabel && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>{categoryLabel}</div>
        )}
      </div>
      {(onRename || onDelete) && (
        <button
          ref={btnRef}
          onClick={openMenu}
          aria-label="Exercise options"
          style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: '8px', color: 'var(--text-muted)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
          </svg>
        </button>
      )}
      <RoutineAddMenu routines={routines} onAdd={onAddToRoutine} onViewAll={onViewAll} />
      {menuOpen && createPortal(
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 600 }} />
          <div style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 601, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 6px 24px rgba(0,0,0,0.18)', overflow: 'hidden', minWidth: '150px' }}>
            {onRename && (
              <button onClick={() => { setMenuOpen(false); onRename(); }} style={menuItemStyle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent)' }}>
                  <path d="M4 20h4L18.5 9.5a2.121 2.121 0 00-3-3L5 17v3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Rename
              </button>
            )}
            {onRename && onDelete && <div style={{ height: '1px', background: 'var(--border)' }} />}
            {onDelete && (
              <button onClick={() => { setMenuOpen(false); onDelete(); }} style={{ ...menuItemStyle, color: '#EF4444' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Delete
              </button>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function CategorySection({ cat, exercises, isExpanded, onToggle, children }) {
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) setContentHeight(contentRef.current.scrollHeight);
  }, [isExpanded, exercises.length]);

  return (
    <div>
      <div
        onClick={onToggle}
        style={{
          position: 'sticky', top: '60px', zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px', cursor: 'pointer',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }}>{cat}</span>
          <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)', marginTop: '3px' }}>
            {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
          </span>
        </div>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', color: 'var(--text-muted)', flexShrink: 0 }}>
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{
        height: isExpanded ? `${contentHeight}px` : '0px',
        overflow: 'hidden',
        opacity: isExpanded ? 1 : 0,
        transition: 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
        willChange: 'height',
        // No translateZ here: a transform creates a stacking context that lets
        // rows paint over the sticky category header. willChange:height alone
        // does not create one, so the header (z-index 20) stays on top.
      }}>
        <div ref={contentRef} style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          padding: '8px 16px 16px',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function ExerciseDatabase({ autoCreateSignal = 0, onAutoCreate = () => {} }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [customExercises, setCustomExercises] = useState([]);
  const [routines, setRoutines] = useState([]);
  // The exercise whose full "View All" routine picker is open ({ name, category }).
  const [viewAllTarget, setViewAllTarget] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [successMsg, setSuccessMsg] = useState('');
  // Custom-exercise actions: the rename modal target (+ its draft) and the
  // delete-confirmation target (with the routines it's in). The three-dots menu
  // itself is local to each ExerciseRow.
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const searchInputRef = useRef(null);

  // Open the create-exercise modal when the parent FAB requests it (signal = a bumped nonce);
  // the ref guards against re-firing for the same nonce (e.g. StrictMode double-invoke).
  const autoCreateHandled = useRef(0);
  useEffect(() => {
    if (autoCreateSignal && autoCreateSignal !== autoCreateHandled.current) {
      autoCreateHandled.current = autoCreateSignal;
      setShowCreateModal(true);
      onAutoCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreateSignal]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      supabase.from('custom_exercises').select('*').eq('user_id', uid).order('created_at').then(({ data }) => {
        if (data) setCustomExercises(data);
      });
      supabase.from('routines').select('*').eq('user_id', uid).order('created_at', { ascending: true }).then(({ data }) => {
        if (!data) return;
        // Match the My Routines order so the menu's first 4 are the same first 4.
        let ordered = data;
        try {
          const savedOrder = JSON.parse(localStorage.getItem('routineOrder') || 'null');
          if (savedOrder) ordered = [...data].sort((a, b) =>
            (savedOrder.indexOf(a.id) + 1 || Infinity) - (savedOrder.indexOf(b.id) + 1 || Infinity));
        } catch {}
        setRoutines(ordered);
      });
    })();
  }, []);

  const getExercises = (category) => {
    const base = EXERCISE_DATABASE[category] || [];
    const customs = customExercises
      .filter(e => e.category === category && !base.includes(e.name))
      .map(e => e.name);
    return [...base, ...customs];
  };

  const isCustom = (category, name) =>
    customExercises.some(e => e.category === category && e.name === name);

  const toggleCategory = (cat) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const searchResults = search.trim()
    ? CATEGORIES.flatMap(cat =>
        getExercises(cat)
          .filter(name => name.toLowerCase().includes(search.toLowerCase()))
          .map(name => ({ name, category: cat, custom: isCustom(cat, name) }))
      )
    : null;

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  // Add a specific exercise to a specific routine. Used by both the inline
  // "Add to {name}" quick actions and the "View All" picker sheet.
  const addExerciseToRoutine = async (exercise, routine) => {
    if (!exercise || !routine) return;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { error } = await supabase.from('exercises').insert([{ routine_id: routine.id, name: exercise.name, user_id: uid }]);
    if (!error) showSuccess(`Added to ${routine.name}`);
  };

  const deleteCustom = async (id) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { error } = await supabase.from('custom_exercises').delete().eq('id', id).eq('user_id', uid);
    if (!error) {
      setCustomExercises(prev => prev.filter(e => e.id !== id));
    }
  };

  // Rename a custom exercise everywhere it appears: the library entry, every
  // routine that uses it (exercises.name), and past sessions (session_exercises.exercise_name).
  const renameCustom = async () => {
    const newName = renameValue.trim();
    if (!renameTarget) return;
    if (!newName || newName === renameTarget.name) { setRenameTarget(null); setRenameValue(''); return; }
    const oldName = renameTarget.name;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { error } = await supabase.from('custom_exercises').update({ name: newName }).eq('id', renameTarget.id).eq('user_id', uid);
    if (error) { return; }
    await supabase.from('exercises').update({ name: newName }).eq('name', oldName).eq('user_id', uid);
    await supabase.from('session_exercises').update({ exercise_name: newName }).eq('exercise_name', oldName).eq('user_id', uid);
    setCustomExercises(prev => prev.map(e => e.id === renameTarget.id ? { ...e, name: newName } : e));
    setRenameTarget(null);
    setRenameValue('');
    showSuccess('Exercise renamed');
  };

  // Delete a custom exercise: if it's used in any routine, warn first (naming the
  // routines); otherwise delete straight away. On confirm, also remove it from those routines.
  const requestDelete = async (customEx) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data } = await supabase.from('exercises').select('routine_id').eq('name', customEx.name).eq('user_id', uid);
    const routineIds = [...new Set((data || []).map(r => r.routine_id))];
    const routineNames = routineIds.map(id => routines.find(r => r.id === id)?.name).filter(Boolean);
    if (routineNames.length > 0) {
      setDeleteTarget({ customEx, routineNames });
    } else {
      await deleteCustom(customEx.id);
      showSuccess('Exercise deleted');
    }
  };

  const confirmDeleteCascade = async () => {
    if (!deleteTarget) return;
    const { customEx } = deleteTarget;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    await supabase.from('exercises').delete().eq('name', customEx.name).eq('user_id', uid);
    await deleteCustom(customEx.id);
    setDeleteTarget(null);
    showSuccess('Exercise deleted');
  };

  const createCustom = async () => {
    if (!newName.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const { data, error } = await supabase
      .from('custom_exercises')
      .insert([{ name: newName.trim(), category: newCategory, user_id: uid }])
      .select().single();
    if (error) {
      return;
    }
    if (data) {
      setCustomExercises(prev => [...prev, data]);
      setExpanded(prev => new Set([...prev, data.category]));
      setNewName('');
      setNewCategory(CATEGORIES[0]);
      setShowCreateModal(false);
    }
  };

  return (
    <div style={{ paddingBottom: '20px' }}>

      {/* Top bar — always-visible search (add moved to the floating button) */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '16px 16px 12px' }}>
        <input
          ref={searchInputRef}
          id="exercise-search"
          name="exercise-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search exercises..."
          className="input"
          style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}
        />
      </div>

      {/* Success message */}
      {successMsg && (
        <div style={{ margin: '0 16px 12px', padding: '10px 14px', background: '#DCFCE7', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#16A34A' }}>
          {successMsg}
        </div>
      )}

      {/* Search results */}
      {searchResults ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0 16px 8px' }}>
          {searchResults.length === 0
            ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px' }}>No exercises found</p>
            : searchResults.map(({ name, category, custom }) => {
                const customEx = custom ? customExercises.find(e => e.category === category && e.name === name) : null;
                return (
                  <ExerciseRow
                    key={`${category}::${name}`}
                    name={name}
                    isCustom={custom}
                    categoryLabel={category}
                    routines={routines}
                    onAddToRoutine={(routine) => addExerciseToRoutine({ name, category }, routine)}
                    onViewAll={() => setViewAllTarget({ name, category })}
                    onRename={customEx ? () => { setRenameValue(customEx.name); setRenameTarget(customEx); } : undefined}
                    onDelete={customEx ? () => requestDelete(customEx) : undefined}
                  />
                );
              })
          }
        </div>
      ) : (
        /* Category sections */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px 16px' }}>
          {CATEGORIES.map(cat => {
            const exercises = getExercises(cat);
            const isExpanded = expanded.has(cat);
            return (
              <CategorySection
                key={cat}
                cat={cat}
                exercises={exercises}
                isExpanded={isExpanded}
                onToggle={() => toggleCategory(cat)}
              >
                {exercises.map(name => {
                  const customEx = isCustom(cat, name) ? customExercises.find(e => e.category === cat && e.name === name) : null;
                  return (
                    <ExerciseRow
                      key={name}
                      name={name}
                      isCustom={!!customEx}
                      routines={routines}
                      onAddToRoutine={(routine) => addExerciseToRoutine({ name, category: cat }, routine)}
                      onViewAll={() => setViewAllTarget({ name, category: cat })}
                      onRename={customEx ? () => { setRenameValue(customEx.name); setRenameTarget(customEx); } : undefined}
                      onDelete={customEx ? () => requestDelete(customEx) : undefined}
                    />
                  );
                })}
              </CategorySection>
            );
          })}
        </div>
      )}

      {/* "View All" routine picker — full-screen, swipe-down dismissable */}
      {viewAllTarget && (
        <RoutinePickerSheet
          exerciseName={viewAllTarget.name}
          onPick={(routine) => { addExerciseToRoutine(viewAllTarget, routine); setViewAllTarget(null); }}
          onClose={() => setViewAllTarget(null)}
        />
      )}

      {/* Create Custom Exercise modal */}
      {showCreateModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{ background: 'var(--card)', borderRadius: '16px', padding: '24px', width: '300px' }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontWeight: '700', fontSize: '17px', color: 'var(--text-primary)', marginBottom: '16px' }}>Custom Exercise</p>
            <input
              id="custom-exercise-name"
              name="custom-exercise-name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Exercise name"
              className="input"
              style={{ marginBottom: '12px' }}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && createCustom()}
            />
            <select
              id="custom-exercise-category"
              name="custom-exercise-category"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="input"
              style={{ marginBottom: '20px' }}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={createCustom} className="btn-primary" style={{ flex: 1 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename custom exercise modal */}
      {renameTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
          onClick={() => { setRenameTarget(null); setRenameValue(''); }}
        >
          <div
            style={{ background: 'var(--card)', borderRadius: '16px', padding: '24px', width: '300px' }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontWeight: '700', fontSize: '17px', color: 'var(--text-primary)', marginBottom: '16px' }}>Rename Exercise</p>
            <input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              placeholder="Exercise name"
              className="input"
              style={{ marginBottom: '20px' }}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && renameCustom()}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setRenameTarget(null); setRenameValue(''); }} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={renameCustom} className="btn-primary" style={{ flex: 1 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete warning — custom exercise is used in one or more routines */}
      {deleteTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{ background: 'var(--card)', borderRadius: '16px', padding: '24px', width: '320px' }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontWeight: '700', fontSize: '17px', color: 'var(--text-primary)', marginBottom: '12px' }}>Delete "{deleteTarget.customEx.name}"?</p>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '8px' }}>
              This exercise is used in {deleteTarget.routineNames.length === 1 ? 'the routine' : 'these routines'}:
            </p>
            <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '12px' }}>
              {deleteTarget.routineNames.join(', ')}
            </p>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
              Deleting it will also remove it from {deleteTarget.routineNames.length === 1 ? 'that routine' : 'those routines'}.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={confirmDeleteCascade} style={{ flex: 1, padding: '12px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ExerciseDatabase;
