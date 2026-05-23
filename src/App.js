import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import FoodLog from './components/FoodLog';
import Workouts from './components/Workouts';
import Measurements from './components/Measurements';
import WorkoutDashboard from './components/WorkoutDashboard';

// ─── TAB CONFIGS ────────────────────────────────────────────
const MAIN_TABS = [
  { id: 'dashboard', label: 'Home', icon: '⌂' },
  { id: 'food-log', label: 'Add Food', icon: '+' },
  { id: 'workout-start', label: 'Workout', icon: '▸' },
  { id: 'measurement-add', label: 'Measure', icon: '◎' },
  { id: 'profile', label: 'Profile', icon: '○' },
];

const FOOD_TABS = [
  { id: 'food-dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'food-recipes', label: 'Recipes', icon: '≡' },
  { id: 'food-log', label: 'Add Food', icon: '+' },
  { id: 'food-nutrients', label: 'Nutrients', icon: '◑' },
  { id: 'profile', label: 'Profile', icon: '○' },
];

const WORKOUT_TABS = [
  { id: 'workout-dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'workout-exercises', label: 'Exercises', icon: '≡' },
  { id: 'workout-start', label: 'Start', icon: '▸' },
  { id: 'workout-history', label: 'History', icon: '◷' },
  { id: 'profile', label: 'Profile', icon: '○' },
];

const MEASUREMENT_TABS = [
  { id: 'measurement-dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'measurement-tbd1', label: 'TBD', icon: '•' },
  { id: 'measurement-add', label: 'Add', icon: '+' },
  { id: 'measurement-tbd2', label: 'TBD', icon: '•' },
  { id: 'profile', label: 'Profile', icon: '○' },
];

const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'food', label: 'Calories', icon: '◑' },
  { id: 'workouts', label: 'Workouts', icon: '▸' },
  { id: 'measurements', label: 'Measurements', icon: '◎' },
];

// ─── HELPERS ────────────────────────────────────────────────

function getTabsForSection(section) {
  if (section === 'food') return FOOD_TABS;
  if (section === 'workouts') return WORKOUT_TABS;
  if (section === 'measurements') return MEASUREMENT_TABS;
  return MAIN_TABS;
}

function getHeaderTitle(activeTab) {
  const titles = {
    'dashboard': 'Fitness Tracker',
    'food': 'Calories',
    'food-dashboard': 'Calories',
    'food-recipes': 'Recipes',
    'food-log': 'Calories',
    'food-nutrients': 'Nutrients',
    'workouts': 'Workouts',
    'workout-dashboard': 'Workouts',
    'workout-exercises': 'Exercises',
    'workout-start': 'Start Workout',
    'workout-history': 'History',
    'measurements': 'Measurements',
    'measurement-dashboard': 'Measurements',
    'measurement-add': 'Add Measurement',
    'measurement-tbd1': 'Coming Soon',
    'measurement-tbd2': 'Coming Soon',
    'profile': 'Profile',
  };
  return titles[activeTab] || 'Fitness Tracker';
}

// ─── SCREENS ────────────────────────────────────────────────

function ComingSoon({ label }) {
  return (
    <div className="content">
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚧</div>
        <p style={{ fontWeight: '600', marginBottom: '8px' }}>{label}</p>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Coming soon.</p>
      </div>
    </div>
  );
}

function Profile({ theme, setTheme }) {
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
                textTransform: 'capitalize'
              }}>
              {t === 'system' ? '⚙️ System Default' : t === 'light' ? '☀️ Light' : '🌙 Dark'}
            </button>
          ))}
        </div>
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
const [activeTab, setActiveTab] = useState('dashboard');
const [activeSection, setActiveSection] = useState('main');
const [sidePanel, setSidePanel] = useState(false);
const [date, setDate] = useState(new Date())
const [theme, setTheme] = useState('light');
const [profileName] = useState('Jose');
const [calorieGoal] = useState(2000);
const [stepsGoal] = useState(10000);
const [activeWorkout, setActiveWorkout] = useState(null); // { routineName, startTime }
const [workoutSeconds, setWorkoutSeconds] = useState(0);
const [workoutExpanded, setWorkoutExpanded] = useState(false);
const greeting = useMemo(() => getGreeting(profileName), [profileName]);
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


  const openSection = (id) => {
    if (id === 'dashboard') {
      setActiveSection('main');
      setActiveTab('dashboard');
    } else {
      setActiveSection(id);
      setActiveTab(`${id === 'workouts' ? 'workout' : id === 'measurements' ? 'measurement' : 'food'}-dashboard`);
    }
    setSidePanel(false);
  };

  const currentTabs = getTabsForSection(activeSection);

  const handleTabClick = (tabId) => {
    if (tabId === 'profile') {
      setActiveTab('profile');
      return;
    }
    if (tabId === 'food') { setActiveSection('food'); setActiveTab('food-dashboard'); return; }
    if (tabId === 'workouts') { setActiveSection('workouts'); setActiveTab('workout-dashboard'); return; }
    if (tabId === 'measurements') { setActiveSection('measurements'); setActiveTab('measurement-dashboard'); return; }
    if (tabId === 'dashboard') { setActiveSection('main'); setActiveTab('dashboard'); return; }
    setActiveTab(tabId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard date={date} profileName={profileName} calorieGoal={calorieGoal} stepsGoal={stepsGoal} onDateChange={changeDate} />;
      case 'food-dashboard': return <ComingSoon label="Food Dashboard" />;
      case 'food-log': return <div className="content"><FoodLog /></div>;
      case 'food-recipes': return <ComingSoon label="Recipes" />;
      case 'food-nutrients': return <ComingSoon label="Nutrients" />;
      case 'workout-dashboard': return <WorkoutDashboard profileName={profileName} />;
      case 'workout-exercises': return <ComingSoon label="Exercises" />;
      case 'workout-start': return <div className="content"><Workouts key="workout-start" activeWorkout={activeWorkout} setActiveWorkout={setActiveWorkout} workoutSeconds={workoutSeconds} workoutExpanded={workoutExpanded} onCollapse={() => setWorkoutExpanded(false)} onWorkoutStart={() => setWorkoutExpanded(true)} onExpand={() => setWorkoutExpanded(true)} /></div>;
      case 'workout-history': return <div className="content"><Workouts key="workout-history" activeWorkout={activeWorkout} setActiveWorkout={setActiveWorkout} workoutSeconds={workoutSeconds} initialView="history" /></div>;
      case 'measurement-dashboard': return <ComingSoon label="Measurements Dashboard" />;
      case 'measurement-add': return <div className="content"><Measurements /></div>;
      case 'measurement-tbd1': return <ComingSoon label="Coming Soon" />;
      case 'measurement-tbd2': return <ComingSoon label="Coming Soon" />;
      case 'profile': return <Profile theme={theme} setTheme={setTheme} />;
      default: return <Dashboard date={date} profileName={profileName} calorieGoal={calorieGoal} stepsGoal={stepsGoal} onDateChange={changeDate} />;
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <button className="header-btn" onClick={() => setSidePanel(true)}>
          <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
            <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <span className="header-title">
  {activeTab === 'dashboard' ? greeting : getHeaderTitle(activeTab)}
</span>
        <div style={{ width: 32 }} />
      </div>


      {/* Main content */}
      {renderContent()}

      {/* Collapsed Workout Bar */}
      {activeWorkout && !workoutExpanded && (
        <div onClick={() => { setActiveSection('workouts'); setActiveTab('workout-start'); setWorkoutExpanded(true); }}
          style={{
            position: 'fixed', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '480px', zIndex: 150,
            background: 'var(--card)', borderTop: '1px solid var(--border)',
            padding: '12px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer', boxShadow: '0 -2px 12px rgba(0,0,0,0.1)',
          }}>
          <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '15px' }}>{activeWorkout.routineName}</span>
          <span style={{ fontWeight: '700', color: 'var(--accent)', fontSize: '15px', fontVariantNumeric: 'tabular-nums' }}>{formatTime(workoutSeconds)}</span>
        </div>
      )}

      {/* Bottom Tab Bar */}
      <div className="tab-bar">
        {currentTabs.map(tab => (
          <button key={tab.id}
            className={`tab-item ${activeTab === tab.id || (tab.id === 'profile' && activeTab === 'profile') ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}>
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Side Panel */}
      {sidePanel && (
        <>
          <div className="overlay" onClick={() => setSidePanel(false)} />
          <div className="side-panel">
            <p style={{ padding: '0 24px 16px', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Sections</p>
            {SECTIONS.map(s => (
              <button key={s.id} className={`side-panel-item ${activeSection === s.id || (s.id === 'dashboard' && activeSection === 'main') ? 'active' : ''}`}
                onClick={() => openSection(s.id)}>
                <span className="side-panel-icon">{s.icon}</span>
                <span className="side-panel-label">{s.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;