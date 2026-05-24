// Requires custom_exercises table in Supabase:
// create table custom_exercises (id uuid default uuid_generate_v4() primary key, name text, category text, created_at timestamp default now());

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

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

function ExerciseRow({ name, isCustom, categoryLabel, onAdd, onDelete }) {
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
      {onDelete && (
        <button
          onClick={onDelete}
          style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: '8px', color: '#EF4444' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
      <button
        onClick={onAdd}
        style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-light)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: '8px' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </button>
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
          position: 'sticky', top: '60px', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px', cursor: 'pointer',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }}>{cat}</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: '20px' }}>
            {exercises.length}
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
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
      }}>
        <div ref={contentRef} style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          padding: '8px 16px 16px',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function ExerciseDatabase() {
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [customExercises, setCustomExercises] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [addTarget, setAddTarget] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    supabase.from('custom_exercises').select('*').order('created_at').then(({ data }) => {
      if (data) setCustomExercises(data);
    });
    supabase.from('routines').select('*').order('created_at', { ascending: true }).then(({ data }) => {
      if (data) setRoutines(data);
    });
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

  const addToRoutine = async (routineId, routineName) => {
    if (!addTarget) return;
    const { error } = await supabase.from('exercises').insert([{ routine_id: routineId, name: addTarget.name }]);
    if (!error) {
      setAddTarget(null);
      showSuccess(`Added to ${routineName}`);
    }
  };

  const deleteCustom = async (id) => {
    const { error } = await supabase.from('custom_exercises').delete().eq('id', id);
    if (!error) {
      setCustomExercises(prev => prev.filter(e => e.id !== id));
    }
  };

  const createCustom = async () => {
    console.log('createCustom called', { newName, newCategory });
    if (!newName.trim()) return;
    const { data, error } = await supabase
      .from('custom_exercises')
      .insert([{ name: newName.trim(), category: newCategory }])
      .select().single();
    if (error) {
      console.error('createCustom error:', error);
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

      {/* Top bar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '16px 16px 12px' }}>
        {/* Animated button/search container */}
        <div style={{ flex: 1, position: 'relative', height: '80px' }}>
          {/* Add Custom Exercise button */}
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', gap: '16px',
              background: 'var(--accent-light)', border: '1px solid var(--border)',
              borderRadius: '16px', padding: '16px', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)', textAlign: 'left', overflow: 'hidden',
              opacity: searchOpen ? 0 : 1,
              transform: searchOpen ? 'translateX(-20px)' : 'translateX(0)',
              transition: 'opacity 0.25s ease, transform 0.25s ease',
              pointerEvents: searchOpen ? 'none' : 'auto',
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Add Custom Exercise</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>e.g. Bicep Curl, Cable Row</div>
            </div>
          </button>

          {/* Search input */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center',
            opacity: searchOpen ? 1 : 0,
            transform: searchOpen ? 'translateX(0)' : 'translateX(20px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            pointerEvents: searchOpen ? 'auto' : 'none',
          }}>
            <input
              id="exercise-search"
              name="exercise-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="input"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Magnifying glass */}
        <button
          onClick={() => {
            if (searchOpen) { setSearch(''); }
            setSearchOpen(prev => !prev);
          }}
          style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--accent-light)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2"/>
            <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </button>
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
                    onAdd={() => setAddTarget({ name, category })}
                    onDelete={customEx ? () => deleteCustom(customEx.id) : undefined}
                  />
                );
              })
          }
        </div>
      ) : (
        /* Category sections */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
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
                      onAdd={() => setAddTarget({ name, category: cat })}
                      onDelete={customEx ? () => deleteCustom(customEx.id) : undefined}
                    />
                  );
                })}
              </CategorySection>
            );
          })}
        </div>
      )}

      {/* Add to Routine modal */}
      {addTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 500 }}
          onClick={() => setAddTarget(null)}
        >
          <div
            style={{ background: 'var(--card)', borderRadius: '20px 20px 0 0', padding: '24px 24px 40px', width: '100%', maxWidth: '480px', maxHeight: '65vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border)', margin: '0 auto 20px' }} />
            <p style={{ fontWeight: '700', fontSize: '17px', color: 'var(--text-primary)', marginBottom: '4px' }}>{addTarget.name}</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Choose a routine</p>
            {routines.length === 0
              ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No routines yet — create one first.</p>
              : routines.map(r => (
                <button
                  key={r.id}
                  onClick={() => addToRoutine(r.id, r.name)}
                  style={{ display: 'block', width: '100%', padding: '14px 16px', marginBottom: '8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}
                >
                  {r.name}
                </button>
              ))
            }
          </div>
        </div>
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

    </div>
  );
}

export default ExerciseDatabase;
