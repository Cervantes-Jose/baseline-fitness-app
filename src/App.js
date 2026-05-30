import React, { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import FoodLog from './components/FoodLog';
import WorkoutHome from './components/WorkoutHome';
import UndoToast from './components/UndoToast';
import Goals from './components/Goals';

// ─── TAB CONFIGS ────────────────────────────────────────────
const MAIN_TABS = [
  { id: 'dashboard', label: 'Home', icon: '⌂' },
  { id: 'food-log', label: 'Add Food', icon: '+' },
  { id: 'workout-start', label: 'Workout', icon: '▸' },
  { id: 'profile', label: 'Profile', icon: '○' },
];

// ─── HELPERS ────────────────────────────────────────────────

function getHeaderTitle(activeTab) {
  const titles = {
    'dashboard': 'Fitness Tracker',
    'food-log': 'Food Log',
    'workout-start': 'Workouts',
    'profile': 'Profile',
    'profile-goals': 'Goals',
    'settings': 'Settings',
  };
  return titles[activeTab] || 'Fitness Tracker';
}

// ─── SCREENS ────────────────────────────────────────────────

function Profile({ onOpenSettings, onOpenGoals }) {
  return (
    <div className="content">
      <div className="card">
        <p className="section-title">General</p>
        <button onClick={onOpenGoals} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '14px 0', background: 'none', border: 'none',
          borderTop: '1px solid var(--border)', cursor: 'pointer', marginTop: '8px',
        }}>
          <span style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: '500' }}>Goals</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button onClick={onOpenSettings} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '14px 0', background: 'none', border: 'none',
          borderTop: '1px solid var(--border)', cursor: 'pointer',
        }}>
          <span style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: '500' }}>Settings</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <div className="card">
        <p className="section-title">Account</p>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
          Login and account features coming soon.
        </p>
      </div>
    </div>
  );
}

function Settings({ theme, setTheme, metricSystem, setMetricSystem }) {
  return (
    <div className="content">
      <div className="card">
        <p className="section-title">Appearance</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          {['system', 'light', 'dark'].map(t => (
            <button key={t} onClick={() => setTheme(t)}
              style={{
                padding: '12px 16px', borderRadius: '12px', border: '1.5px solid',
                borderColor: theme === t ? 'var(--accent)' : 'var(--border)',
                background: theme === t ? 'var(--accent-light)' : 'var(--card)',
                color: theme === t ? 'var(--accent)' : 'var(--text-primary)',
                cursor: 'pointer', textAlign: 'left', fontSize: '15px', fontWeight: '500',
              }}>
              {t === 'system' ? 'System Default' : t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <p className="section-title">Units</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          {[
            { id: 'imperial', label: 'Imperial', sub: 'lbs, inches' },
            { id: 'metric', label: 'Metric', sub: 'kg, cm' },
          ].map(opt => (
            <button key={opt.id} onClick={() => setMetricSystem(opt.id)}
              style={{
                padding: '12px 16px', borderRadius: '12px', border: '1.5px solid',
                borderColor: metricSystem === opt.id ? 'var(--accent)' : 'var(--border)',
                background: metricSystem === opt.id ? 'var(--accent-light)' : 'var(--card)',
                cursor: 'pointer', textAlign: 'left', fontSize: '15px',
              }}>
              <span style={{ fontWeight: '600', color: metricSystem === opt.id ? 'var(--accent)' : 'var(--text-primary)' }}>{opt.label}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '8px' }}>{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}


// ─── APP ────────────────────────────────────────────────────
function App() {
const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard');
const [date, setDate] = useState(new Date())
const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
const [metricSystem, setMetricSystem] = useState(() => localStorage.getItem('metricSystem') || 'imperial');
const [profileName] = useState('Jose');
const [calorieGoal, setCalorieGoal] = useState(2000);
// eslint-disable-next-line no-unused-vars
const [stepsGoal] = useState(10000); // TODO: move to Goals tab settings when built
const [proteinGoal, setProteinGoal] = useState(180);
const [carbsGoal, setCarbsGoal] = useState(200);
const [fatsGoal, setFatsGoal] = useState(60);
const [activeWorkout, setActiveWorkout] = useState(() => {
  try { return JSON.parse(localStorage.getItem('activeWorkout')); } catch { return null; }
});
const [workoutSeconds, setWorkoutSeconds] = useState(() => Number(localStorage.getItem('workoutSeconds')) || 0);
const [workoutExpanded, setWorkoutExpanded] = useState(false);
const [workoutsResetKey, setWorkoutsResetKey] = useState(0);
const [toast, setToast] = useState(null);
const [updateAvailable, setUpdateAvailable] = useState(false);
const toastTimerRef = useRef(null);
const pendingDeleteRef = useRef(null);
const toastIdRef = useRef(0);
// eslint-disable-next-line no-unused-vars
const greeting = useMemo(() => getGreeting(profileName), [profileName]);
const showToast = (message, onUndo, onConfirmDelete) => {
  if (pendingDeleteRef.current) pendingDeleteRef.current();
  clearTimeout(toastTimerRef.current);
  pendingDeleteRef.current = onConfirmDelete;
  toastIdRef.current += 1;
  setToast({ id: toastIdRef.current, message, onUndo });
  toastTimerRef.current = setTimeout(() => {
    if (pendingDeleteRef.current) { pendingDeleteRef.current(); pendingDeleteRef.current = null; }
    setToast(null);
  }, 3000);
};
// eslint-disable-next-line no-unused-vars
const changeDate = (dir) => {
  const d = new Date(date);
  d.setDate(d.getDate() + dir);
  setDate(d);
};

 useEffect(() => {
    if (!activeWorkout) return;
    const interval = setInterval(() => {
      setWorkoutSeconds(Math.floor((Date.now() - activeWorkout.startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout]);

  useEffect(() => {
    const handler = () => setUpdateAvailable(true);
    window.addEventListener('swUpdate', handler);
    return () => window.removeEventListener('swUpdate', handler);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      root.removeAttribute('data-theme');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      prefersDark ? root.setAttribute('data-theme', 'dark') : root.removeAttribute('data-theme');
    }
  }, [theme]);

  useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('metricSystem', metricSystem); }, [metricSystem]);
  useEffect(() => { localStorage.setItem('activeTab', activeTab); }, [activeTab]);
  useEffect(() => {
    if (activeWorkout) localStorage.setItem('activeWorkout', JSON.stringify(activeWorkout));
    else localStorage.removeItem('activeWorkout');
  }, [activeWorkout]);
  useEffect(() => { localStorage.setItem('workoutSeconds', workoutSeconds); }, [workoutSeconds]);


  const currentTabs = MAIN_TABS;

  const handleTabClick = (tabId) => {
    if (tabId === 'workout-start') {
      if (activeTab === 'workout-start') { setWorkoutsResetKey(k => k + 1); }
      else { setActiveTab('workout-start'); }
      return;
    }
    setActiveTab(tabId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard profileName={profileName} calorieGoal={calorieGoal} proteinGoal={proteinGoal} carbsGoal={carbsGoal} fatsGoal={fatsGoal} />;
      case 'food-log': return <div className="content"><FoodLog showToast={showToast} calorieGoal={calorieGoal} proteinGoal={proteinGoal} carbsGoal={carbsGoal} fatsGoal={fatsGoal} /></div>;
      case 'profile-goals': return <Goals onGoalsUpdate={(goals) => { setCalorieGoal(goals.calorie_goal); setProteinGoal(goals.protein_goal); setCarbsGoal(goals.carbs_goal); setFatsGoal(goals.fats_goal); }} />;
      case 'workout-start':
      case 'workout-exercises':
      case 'workout-measurements':
      case 'workout-history':
        return <WorkoutHome
          appActiveTab={activeTab}
          activeWorkout={activeWorkout}
          setActiveWorkout={setActiveWorkout}
          workoutSeconds={workoutSeconds}
          workoutExpanded={workoutExpanded}
          onCollapse={() => setWorkoutExpanded(false)}
          onWorkoutStart={() => setWorkoutExpanded(true)}
          onExpand={() => setWorkoutExpanded(true)}
          showToast={showToast}
          resetKey={workoutsResetKey}
          metricSystem={metricSystem}
        />;
      case 'profile': return <Profile onOpenSettings={() => setActiveTab('settings')} onOpenGoals={() => setActiveTab('profile-goals')} />;
      case 'settings': return <Settings theme={theme} setTheme={setTheme} metricSystem={metricSystem} setMetricSystem={setMetricSystem} />;
      default: return <Dashboard profileName={profileName} calorieGoal={calorieGoal} proteinGoal={proteinGoal} carbsGoal={carbsGoal} fatsGoal={fatsGoal} />;
    }
  };

  return (
    <div className="app">
      {/* Header — hidden on dashboard (Dashboard renders its own) */}
      {activeTab !== 'dashboard' && (
        <div className="header">
          <span className="header-title">{getHeaderTitle(activeTab)}</span>
        </div>
      )}


      {/* Update banner */}
      {updateAvailable && (
        <div style={{ background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px', fontSize: '13px', fontWeight: '600' }}>
          <span>Update available</span>
          <button onClick={() => window.location.reload()}
            style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: 'white', fontWeight: '600', fontSize: '13px', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
            Refresh
          </button>
        </div>
      )}

      {/* Main content */}
      {renderContent()}

      {/* Collapsed Workout Bar */}
      {activeWorkout && !workoutExpanded && (
        <div onClick={() => { setActiveTab('workout-start'); setWorkoutExpanded(true); }}
          style={{
            position: 'fixed', bottom: '82px', left: '50%', transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)', maxWidth: '448px', zIndex: 150,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '12px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}>
          <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '15px' }}>{activeWorkout.routineName}</span>
          <span style={{ fontWeight: '700', color: 'var(--accent)', fontSize: '15px', fontVariantNumeric: 'tabular-nums' }}>{formatTime(workoutSeconds)}</span>
        </div>
      )}

      {/* Undo Toast */}
      {toast && (
        <UndoToast key={toast.id} message={toast.message} onUndo={() => {
          clearTimeout(toastTimerRef.current);
          pendingDeleteRef.current = null;
          toast.onUndo();
          setToast(null);
        }} />
      )}

      {/* Bottom Tab Bar */}
      <div className="tab-bar">
        {currentTabs.map(tab => (
          <button key={tab.id}
            className={`tab-item ${activeTab === tab.id || (tab.id === 'profile' && (activeTab === 'profile' || activeTab === 'profile-goals' || activeTab === 'settings')) ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}>
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;