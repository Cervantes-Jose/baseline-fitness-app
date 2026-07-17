import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import FoodLog from './components/FoodLog';
import WorkoutHome from './components/WorkoutHome';
import UndoToast from './components/UndoToast';
import Goals from './components/Goals';
import DailyHabits from './components/DailyHabits';
import Measurements from './components/Measurements';
import Profile from './components/Profile';
import AccountInformation from './components/AccountInformation';
import DataExport from './components/DataExport';
import Subscription from './components/Subscription';
import Units from './components/Units';
import FoodLogPreferences from './components/FoodLogPreferences';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import AuthScreen from './components/AuthScreen';
import TabIcon from './components/TabIcons';
import { supabase } from './supabaseClient';
import { flushWorkoutQueue } from './components/offlineQueue';
import { useNutritionGoals } from './components/useNutritionGoals';

// ─── TAB CONFIGS ────────────────────────────────────────────
const MAIN_TABS = [
  { id: 'dashboard', label: 'Home', icon: 'home' },
  { id: 'food-log', label: 'Add Food', icon: 'plus' },
  { id: 'workout-start', label: 'Workout', icon: 'dumbbell' },
  { id: 'profile', label: 'Profile', icon: 'person' },
];

// ─── HELPERS ────────────────────────────────────────────────

function getHeaderTitle(activeTab) {
  const titles = {
    'dashboard': 'Fitness Tracker',
    'food-log': 'Food Log',
    'workout-start': 'Workouts',
    'profile': 'Profile',
    'profile-goals': 'Goals',
    'profile-account': 'Account Information',
    'profile-subscription': 'Subscription',
    'profile-data': 'Data & Export',
    'profile-units': 'Units',
    'profile-food-prefs': 'Food Log Preferences',
    'profile-privacy': 'Privacy Policy',
    'profile-terms': 'Terms of Service',
  };
  return titles[activeTab] || 'Fitness Tracker';
}

// ─── SCREENS ────────────────────────────────────────────────

// Per-user data cached in localStorage. Cleared on sign-out so a different account
// signing in on the same browser never sees the previous user's data. (Device-level
// preferences like theme/metricSystem are intentionally not in this list.)
const PER_USER_KEYS = [
  'accountInfo', 'profileName', 'dashboardLayout', 'routineOrder',
  'activeWorkout', 'activeWorkoutLog', 'workoutSeconds', 'activeTab',
  'dashboardHabitsHidden',
];
// Dynamically-named per-user keys (suffix varies per exercise/uid), matched by
// prefix on sign-out. offlineWorkoutQueue_* is deliberately NOT here — it must
// survive sign-out so unsynced workouts replay on the next sign-in (see
// offlineQueue.js design notes).
const PER_USER_KEY_PREFIXES = ['prPeriod_', 'defaultMeasurementIds_'];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}


// ─── APP ────────────────────────────────────────────────────
function App() {
const [user, setUser] = useState(null);
const [authLoading, setAuthLoading] = useState(true);
const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard');
const [date, setDate] = useState(new Date())
const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
const [metricSystem, setMetricSystem] = useState(() => localStorage.getItem('metricSystem') || 'imperial');
// Food log display prefs (client-side only, kept across sign-out like theme).
const [foodAutoCollapse, setFoodAutoCollapse] = useState(() => localStorage.getItem('foodAutoCollapse') === 'true');
const [foodTimeFormat, setFoodTimeFormat] = useState(() => localStorage.getItem('foodTimeFormat') || '12h');
// Saved nutrition goals (loaded from user_goals, reloaded on sign-in/out). The Goals
// screen's Save pushes its values straight back via onGoalsUpdate → setGoals, so the
// Dashboard/Food Log update without a round-trip.
const { goals, setGoals } = useNutritionGoals(user?.id);
const { calorie_goal: calorieGoal, protein_goal: proteinGoal, carbs_goal: carbsGoal, fats_goal: fatsGoal } = goals;
const [activeWorkout, setActiveWorkout] = useState(() => {
  try { return JSON.parse(localStorage.getItem('activeWorkout')); } catch { return null; }
});
const [workoutSeconds, setWorkoutSeconds] = useState(() => Number(localStorage.getItem('workoutSeconds')) || 0);
const [workoutExpanded, setWorkoutExpanded] = useState(false);
// True only if a workout was already persisted at page load (a crash/reload mid-
// workout), which triggers the "pick up where you left off?" recovery prompt.
// A workout started later in this session never flips this back on.
const [showWorkoutRecovery, setShowWorkoutRecovery] = useState(() => {
  try { return !!JSON.parse(localStorage.getItem('activeWorkout')); } catch { return false; }
});
// The single rest timer that is currently counting down, lifted here so the
// collapsed mini-bar keeps showing it even after the Workouts component unmounts
// (switching tabs). { exId, slotIdx, endsAt, duration } | null. Timestamp-based
// so the remaining time stays accurate regardless of who is rendering it.
const [activeRest, setActiveRest] = useState(null);
const [restRemaining, setRestRemaining] = useState(0);
// One-shot signal pushed to Workouts when a rest finishes naturally, so it can
// flip the slot to "Rest Completed". token changes each time to re-trigger.
const [completedRest, setCompletedRest] = useState(null);
const [workoutsResetKey, setWorkoutsResetKey] = useState(0);
// True while the food timeline is in multi-select/edit mode — the select bar
// replaces the main bottom tab bar during this time.
const [foodSelectMode, setFoodSelectMode] = useState(false);
const [toast, setToast] = useState(null);
const toastTimerRef = useRef(null);
const pendingDeleteRef = useRef(null);
const toastIdRef = useRef(0);
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

 // Check the current session on mount and subscribe to auth changes. The
 // onAuthStateChange listener keeps `user` in sync across sign-in/out (including
 // the sign-out triggered from Profile, which redirects back to AuthScreen).
 useEffect(() => {
   supabase.auth.getSession().then(({ data: { session } }) => {
     setUser(session?.user ?? null);
     setAuthLoading(false);
     // Replay any workouts finished offline on a previous visit.
     if (session?.user?.id) flushWorkoutQueue(session.user.id);
   });
   // A workout queued while offline syncs the moment the connection returns.
   const onOnline = () => flushWorkoutQueue();
   window.addEventListener('online', onOnline);
   const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
     // Recovery link signs the user into a temporary session; keep them on
     // AuthScreen (user stays null) so its "Set New Password" form can show.
     if (event === 'PASSWORD_RECOVERY') { setUser(null); return; }
     setUser(session?.user ?? null);
     // On sign-in, drain that user's offline queue (e.g. they signed out before
     // a queued workout could sync, then signed back in).
     if (event !== 'SIGNED_OUT' && session?.user?.id) flushWorkoutQueue(session.user.id);
     // Session ended (sign-out or expired/failed token refresh) → back to AuthScreen.
     // Wipe per-user localStorage and in-memory workout state so the next account to
     // sign in on this browser never inherits the previous user's data.
     if (event === 'SIGNED_OUT') {
       setUser(null);
       PER_USER_KEYS.forEach(k => localStorage.removeItem(k));
       Object.keys(localStorage)
         .filter(k => PER_USER_KEY_PREFIXES.some(p => k.startsWith(p)))
         .forEach(k => localStorage.removeItem(k));
       setActiveWorkout(null);
       setWorkoutSeconds(0);
       setShowWorkoutRecovery(false);
       setActiveTab('dashboard');
     }
   });
   return () => {
     subscription.unsubscribe();
     window.removeEventListener('online', onOnline);
   };
 }, []);

 useEffect(() => {
    if (!activeWorkout) return;
    if (activeWorkout.paused) {
      setWorkoutSeconds(activeWorkout.pausedAccum || 0);
      return;
    }
    const resumedAt = activeWorkout.resumedAt || activeWorkout.startTime;
    const accum = activeWorkout.pausedAccum || 0;
    const tick = () => setWorkoutSeconds(accum + Math.floor((Date.now() - resumedAt) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout]);

  // Drive the active rest countdown. When it reaches zero, buzz the phone and
  // push a completion signal so the logging card collapses to "Rest Completed".
  useEffect(() => {
    if (!activeRest) { setRestRemaining(0); return; }
    const tick = () => {
      const msLeft = activeRest.endsAt - Date.now();
      if (msLeft <= 0) {
        setRestRemaining(0);
        if (navigator.vibrate) navigator.vibrate(400);
        setCompletedRest({ exId: activeRest.exId, slotIdx: activeRest.slotIdx, groupId: activeRest.groupId, kind: activeRest.kind, token: Date.now() });
        setActiveRest(null);
        return;
      }
      setRestRemaining(Math.ceil(msLeft / 1000));
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [activeRest]);

  // Start a fresh rest (replaces any running one). duration is in seconds.
  // kind 'superset' rests carry a groupId so completion can advance the round.
  const startRest = ({ exId, slotIdx, duration, groupId = null, kind = 'set' }) => {
    setCompletedRest(null);
    setActiveRest({ exId, slotIdx, duration, groupId, kind, endsAt: Date.now() + duration * 1000 });
  };
  // Stop the running rest without firing completion (used for Skip and uncheck).
  const skipRest = () => setActiveRest(null);

  // Pause/resume the active workout. On pause we bank the elapsed seconds into
  // pausedAccum; on resume the clock restarts from resumedAt. This freezes the
  // displayed time while paused and survives a reload (activeWorkout is persisted).
  const togglePause = () => {
    setActiveWorkout(prev => {
      if (!prev) return prev;
      if (prev.paused) return { ...prev, paused: false, resumedAt: Date.now() };
      const resumedAt = prev.resumedAt || prev.startTime;
      const accum = (prev.pausedAccum || 0) + Math.floor((Date.now() - resumedAt) / 1000);
      return { ...prev, paused: true, pausedAccum: accum };
    });
  };

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
  useEffect(() => { localStorage.setItem('foodAutoCollapse', foodAutoCollapse); }, [foodAutoCollapse]);
  useEffect(() => { localStorage.setItem('foodTimeFormat', foodTimeFormat); }, [foodTimeFormat]);
  useEffect(() => { localStorage.setItem('activeTab', activeTab); }, [activeTab]);
  useEffect(() => {
    if (activeWorkout) localStorage.setItem('activeWorkout', JSON.stringify(activeWorkout));
    else { localStorage.removeItem('activeWorkout'); localStorage.removeItem('activeWorkoutLog'); }
  }, [activeWorkout]);
  useEffect(() => { localStorage.setItem('workoutSeconds', workoutSeconds); }, [workoutSeconds]);
  // A finished/discarded workout should never leave a rest ticking in the mini-bar.
  useEffect(() => { if (!activeWorkout) { setActiveRest(null); setCompletedRest(null); } }, [activeWorkout]);

  // App-wide: select all existing text the moment any text/number input gains
  // focus, so typing immediately replaces the current value. One delegated
  // focusin listener covers every input (current and future) without touching
  // each field. Skips inputs whose type doesn't support selection (date,
  // checkbox, radio, etc.) — calling select() on those would throw/no-op.
  useEffect(() => {
    const SELECTABLE = new Set(['text', 'search', 'email', 'tel', 'url', 'password', 'number']);
    const onFocusIn = (e) => {
      const el = e.target;
      if (!el) return;
      const isTextarea = el.tagName === 'TEXTAREA';
      const isSelectableInput = el.tagName === 'INPUT' && SELECTABLE.has((el.type || 'text').toLowerCase());
      if (!isTextarea && !isSelectableInput) return;
      // Defer so the browser's own caret placement on focus doesn't override
      // the selection (notably on mobile taps).
      setTimeout(() => { try { el.select(); } catch {} }, 0);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);


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
      case 'dashboard': return <Dashboard user={user} calorieGoal={calorieGoal} proteinGoal={proteinGoal} carbsGoal={carbsGoal} fatsGoal={fatsGoal} showToast={showToast} />;
      case 'dashboard-edit': return <Dashboard user={user} calorieGoal={calorieGoal} proteinGoal={proteinGoal} carbsGoal={carbsGoal} fatsGoal={fatsGoal} editMode onExitEdit={() => setActiveTab('profile')} showToast={showToast} />;
      case 'food-log': return <div className="content"><FoodLog showToast={showToast} calorieGoal={calorieGoal} proteinGoal={proteinGoal} carbsGoal={carbsGoal} fatsGoal={fatsGoal} onSelectModeChange={setFoodSelectMode} workoutBarVisible={!!activeWorkout && !workoutExpanded} autoCollapse={foodAutoCollapse} timeFormat={foodTimeFormat} /></div>;
      case 'profile-goals': return <Goals metricSystem={metricSystem} onGoalsUpdate={(g) => setGoals(prev => ({ ...prev, ...g }))} showToast={showToast} />;
      case 'profile-habits': return <DailyHabits onBack={() => setActiveTab('profile')} showToast={showToast} />;
      case 'profile-measurements': return <Measurements metricSystem={metricSystem} onBack={() => setActiveTab('profile')} showToast={showToast} />;
      case 'workout-start':
      case 'workout-exercises':
      case 'workout-prs':
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
          workoutPaused={activeWorkout?.paused || false}
          onTogglePause={togglePause}
          activeRest={activeRest}
          restRemaining={restRemaining}
          completedRest={completedRest}
          onStartRest={startRest}
          onSkipRest={skipRest}
        />;
      case 'profile': return <Profile onOpenGoals={() => setActiveTab('profile-goals')} onOpenHabits={() => setActiveTab('profile-habits')} onOpenMeasurements={() => setActiveTab('profile-measurements')} onOpenAccount={() => setActiveTab('profile-account')} onOpenSubscription={() => setActiveTab('profile-subscription')} onOpenDataExport={() => setActiveTab('profile-data')} onOpenUnits={() => setActiveTab('profile-units')} onOpenFoodPrefs={() => setActiveTab('profile-food-prefs')} onOpenEditDashboard={() => setActiveTab('dashboard-edit')} onOpenPrivacy={() => setActiveTab('profile-privacy')} onOpenTerms={() => setActiveTab('profile-terms')} user={user} theme={theme} setTheme={setTheme} metricSystem={metricSystem} />;
      case 'profile-account': return <AccountInformation user={user} metricSystem={metricSystem} onBack={() => setActiveTab('profile')} />;
      case 'profile-subscription': return <Subscription onBack={() => setActiveTab('profile')} />;
      case 'profile-data': return <DataExport user={user} onBack={() => setActiveTab('profile')} />;
      case 'profile-units': return <Units metricSystem={metricSystem} setMetricSystem={setMetricSystem} />;
      case 'profile-food-prefs': return <FoodLogPreferences autoCollapse={foodAutoCollapse} setAutoCollapse={setFoodAutoCollapse} timeFormat={foodTimeFormat} setTimeFormat={setFoodTimeFormat} />;
      case 'profile-privacy': return <PrivacyPolicy />;
      case 'profile-terms': return <TermsOfService />;
      default: return <Dashboard user={user} calorieGoal={calorieGoal} proteinGoal={proteinGoal} carbsGoal={carbsGoal} fatsGoal={fatsGoal} showToast={showToast} />;
    }
  };

  // While the initial session check is in flight, show a centered spinner.
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <style>{`@keyframes appAuthSpin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'appAuthSpin 0.7s linear infinite' }} />
      </div>
    );
  }

  // No authenticated user → full-screen auth flow (no tab bar).
  if (!user) {
    return <AuthScreen onAuth={setUser} />;
  }

  return (
    <div className="app">
      {/* Header — only Profile sub-screens keep a header (bare blue back chevron
          stacked above the title). The dashboard renders its own greeting, and the
          top-level sections (Food Log, Workouts, Profile) have no title header. */}
      {activeTab.startsWith('profile-') && activeTab !== 'profile-habits' && activeTab !== 'profile-measurements' && activeTab !== 'profile-account' && activeTab !== 'profile-subscription' && activeTab !== 'profile-data' && (
        <div className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <button onClick={() => setActiveTab('profile')} aria-label="Back" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <span className="header-title">{getHeaderTitle(activeTab)}</span>
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
            display: 'flex', flexDirection: 'column', gap: '8px',
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '15px' }}>{activeWorkout.routineName}</span>
            <span style={{ fontWeight: '700', color: 'var(--accent)', fontSize: '15px', fontVariantNumeric: 'tabular-nums' }}>{formatTime(workoutSeconds)}</span>
          </div>
          {activeRest && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontWeight: '600', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rest</span>
              <span style={{ fontWeight: '700', color: 'var(--accent)', fontSize: '15px', fontVariantNumeric: 'tabular-nums' }}>{formatTime(restRemaining)}</span>
            </div>
          )}
        </div>
      )}

      {/* Active-workout recovery prompt — shown after a reload/crash mid-workout */}
      {showWorkoutRecovery && activeWorkout && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: '24px' }}>
          <div style={{ background: 'var(--card)', borderRadius: '16px', padding: '24px', width: '320px', maxWidth: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
            <p style={{ fontWeight: '700', marginBottom: '8px', fontSize: '18px', color: 'var(--text-primary)' }}>Uh oh!</p>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
              Looks like you were in an active workout. Would you like to pick up where you left off?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowWorkoutRecovery(false);
                  setActiveWorkout(null);
                  setWorkoutSeconds(0);
                }}
                className="btn-secondary" style={{ flex: 1 }}>No</button>
              <button
                onClick={() => {
                  setShowWorkoutRecovery(false);
                  setActiveTab('workout-start');
                  setWorkoutExpanded(true);
                }}
                className="btn-primary" style={{ flex: 1 }}>Yes</button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Toast */}
      {toast && (
        <UndoToast key={toast.id} message={toast.message} onUndo={toast.onUndo ? () => {
          clearTimeout(toastTimerRef.current);
          pendingDeleteRef.current = null;
          toast.onUndo();
          setToast(null);
        } : null} />
      )}

      {/* Bottom Tab Bar — hidden while the food select bar replaces it */}
      {!foodSelectMode && (
      <div className="tab-bar">
        {currentTabs.map(tab => (
          <button key={tab.id}
            className={`tab-item ${activeTab === tab.id || (tab.id === 'profile' && (activeTab === 'profile' || activeTab === 'profile-goals' || activeTab === 'profile-habits' || activeTab === 'profile-measurements' || activeTab === 'profile-account' || activeTab === 'profile-subscription' || activeTab === 'profile-data' || activeTab === 'profile-units' || activeTab === 'profile-privacy' || activeTab === 'profile-terms' || activeTab === 'dashboard-edit')) ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}>
            <span className="tab-icon"><TabIcon name={tab.icon} /></span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
      )}
    </div>
  );
}

export default App;