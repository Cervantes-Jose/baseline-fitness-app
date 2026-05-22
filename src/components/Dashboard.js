import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';


function CircleProgress({ value, goal, size = 100, strokeWidth = 8, color = '#5BA4CF' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / goal, 1);
  const offset = circumference - progress * circumference;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#DBEAFE" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
    </svg>
  );
}

function Dashboard({ date, profileName, calorieGoal, stepsGoal, onDateChange }) {
  const [calories, setCalories] = useState(0);
  const [weight, setWeight] = useState(null);
  const [bodyFat, setBodyFat] = useState(null);
  

  const steps = null; // placeholder until Samsung/Apple Health connected

 useEffect(() => {
  loadDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [date]);

  const loadDashboardData = async () => {
    const dateStr = date.toLocaleDateString();

    // Load calories for the day
    const { data: foodData } = await supabase
      .from('food_entries')
      .select('calories')
      .eq('date', dateStr);

    if (foodData) {
      const total = foodData.reduce((sum, f) => sum + Number(f.calories), 0);
      setCalories(total);
    }

    // Load latest weight
    const { data: weightData } = await supabase
      .from('measurement_entries')
      .select('value, unit, measurements(name)')
      .ilike('measurements.name', 'weight')
      .order('created_at', { ascending: false })
      .limit(1);

    if (weightData && weightData.length > 0) {
      setWeight(weightData[0]);
    }

    // Load latest body fat
    const { data: bfData } = await supabase
      .from('measurement_entries')
      .select('value, unit, measurements(name)')
      .ilike('measurements.name', 'body fat')
      .order('created_at', { ascending: false })
      .limit(1);

    if (bfData && bfData.length > 0) {
      setBodyFat(bfData[0]);
    }
  };

  return (
    <div>
      {/* Date Bar */}
      <div style={{
        background: 'var(--card)', borderBottom: '1px solid var(--border)',
        padding: '10px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <button className="date-nav-btn" onClick={() => onDateChange(-1)}>‹</button>
<span className="date-text">{
  date.toDateString() === new Date().toDateString() ? 'Today' :
  date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
}</span>
<button className="date-nav-btn" onClick={() => onDateChange(1)}>›</button>
      </div>


      {/* Tiles */}
      <div className="tile-grid">

        {/* Calories */}
        <div className="tile" style={{ alignItems: 'center', padding: '20px 12px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircleProgress value={calories} goal={calorieGoal} />
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: '#5BA4CF' }}>
                <path d="M12 2C8.5 6 6 9 6 13a6 6 0 0012 0c0-4-2.5-7-6-11z" fill="#5BA4CF"/>
              </svg>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {calories.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>of {calorieGoal.toLocaleString()}</div>
          </div>
          <div className="tile-label">Calories</div>
        </div>

        {/* Steps */}
        <div className="tile" style={{ alignItems: 'center', padding: '20px 12px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircleProgress value={steps || 0} goal={stepsGoal} />
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M8 4a2 2 0 100-4 2 2 0 000 4zm8 4a2 2 0 100-4 2 2 0 000 4zM6 20l2-8 3 3 3-6 2 11" stroke="#5BA4CF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {steps ? steps.toLocaleString() : '—'}
            </div>
            {steps && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>of {stepsGoal.toLocaleString()}</div>}
          </div>
          <div className="tile-label">Steps</div>
        </div>

        {/* Weight */}
        <div className="tile">
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M6 3h12l1 7H5L6 3z" stroke="#5BA4CF" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M5 10l-1 11h16l-1-11" stroke="#5BA4CF" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M12 6v4" stroke="#5BA4CF" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="tile-label" style={{ marginTop: '8px' }}>Weight</div>
          <div>
            <span style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {weight ? weight.value : '—'}
            </span>
            {weight && <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '3px' }}>{weight.unit}</span>}
          </div>
        </div>

        {/* Body Fat */}
        <div className="tile">
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#5BA4CF" strokeWidth="2"/>
              <path d="M12 7v5l3 3" stroke="#5BA4CF" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="tile-label" style={{ marginTop: '8px' }}>Body Fat</div>
          <div>
            <span style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {bodyFat ? bodyFat.value : '—'}
            </span>
            {bodyFat && <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '3px' }}>%</span>}
          </div>
        </div>

      </div>
    </div>
  );
}

export default Dashboard;