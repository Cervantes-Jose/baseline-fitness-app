import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function getGreeting(name) {
  const hour = new Date().getHours();
  const greetings = {
    morning: ['Good morning', 'Morning'],
    afternoon: ['Good afternoon', 'Hey', `Hi ${name}`],
    evening: ['Good evening', 'Evening', 'Hey there'],
    night: ['Good night', 'Hey'],
  };
  let timeOfDay;
  if (hour >= 5 && hour < 12) timeOfDay = 'morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
  else timeOfDay = 'night';
  const options = greetings[timeOfDay];
  const greeting = options[Math.floor(Math.random() * options.length)];
  return greeting.includes(name) ? greeting : `${greeting}, ${name}`;
}

function WorkoutDashboard({ profileName }) {
  const [totalVolume, setTotalVolume] = useState(0);
  const [workoutMinutes, setWorkoutMinutes] = useState(0);
  const [greeting] = useState(() => getGreeting(profileName));

  useEffect(() => {
    const today = new Date().toLocaleDateString();
    const load = async () => {
      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('duration, session_exercises(sets)')
        .eq('date', today);

      if (!sessions || sessions.length === 0) return;

      let volume = 0;
      let seconds = 0;
      sessions.forEach(session => {
        seconds += Number(session.duration) || 0;
        (session.session_exercises || []).forEach(ex => {
          const sets = Array.isArray(ex.sets) ? ex.sets : (typeof ex.sets === 'string' ? JSON.parse(ex.sets) : []);
          sets.forEach(set => {
            volume += (Number(set.weight) || 0) * (Number(set.reps) || 0);
          });
        });
      });

      setTotalVolume(volume);
      setWorkoutMinutes(Math.round(seconds / 60));
    };
    load();
  }, []);

  return (
    <div>
      <div style={{ padding: '20px 20px 4px' }}>
        <p style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>{greeting}</p>
      </div>
      <div className="tile-grid">

        {/* Total Volume */}
        <div className="tile">
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="11" width="3" height="3" rx="1" fill="#5BA4CF"/>
              <rect x="19" y="11" width="3" height="3" rx="1" fill="#5BA4CF"/>
              <rect x="5" y="9" width="3" height="7" rx="1.5" fill="#5BA4CF"/>
              <rect x="16" y="9" width="3" height="7" rx="1.5" fill="#5BA4CF"/>
              <rect x="8" y="11" width="8" height="3" rx="1" fill="#5BA4CF"/>
            </svg>
          </div>
          <div className="tile-label" style={{ marginTop: '8px' }}>Volume Today</div>
          <div>
            <span style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {totalVolume.toLocaleString()}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '3px' }}>LB</span>
          </div>
        </div>

        {/* Workout Minutes */}
        <div className="tile">
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="13" r="8" stroke="#5BA4CF" strokeWidth="2"/>
              <path d="M12 9v4l3 2" stroke="#5BA4CF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 2h6" stroke="#5BA4CF" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="tile-label" style={{ marginTop: '8px' }}>Active Today</div>
          <div>
            <span style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {workoutMinutes}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '3px' }}>min</span>
          </div>
        </div>

        {/* Steps placeholder */}
        <div className="tile">
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M8 4a2 2 0 100-4 2 2 0 000 4zm8 4a2 2 0 100-4 2 2 0 000 4zM6 20l2-8 3 3 3-6 2 11" stroke="#5BA4CF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="tile-label" style={{ marginTop: '8px' }}>Steps</div>
          <div>
            <span style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>—</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Connect health app</div>
        </div>

      </div>
    </div>
  );
}

export default WorkoutDashboard;
