// Requires custom_foods table in Supabase:
// create table custom_foods (id uuid default uuid_generate_v4() primary key, name text, calories numeric, protein numeric, carbs numeric, fats numeric, created_at timestamp default now());
// grant select, insert, update, delete on public.custom_foods to anon, authenticated, service_role;
// alter table public.custom_foods enable row level security;
// create policy "Allow all for now" on public.custom_foods for all using (true) with check (true);
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

const FOOD_SEARCH_URL = 'https://xbvncbvoyatxbdhkkifq.supabase.co/functions/v1/food-search';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhidm5jYnZveWF0eGJkaGtraWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTQzNzgsImV4cCI6MjA5NDk3MDM3OH0.rMAoMAlVvaAgfcAM4um750S-ZFXLccVy45OGe2-VHl0';

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 === 0 ? 12 : i % 12;
  const ampm = i < 12 ? 'AM' : 'PM';
  return { label: `${h} ${ampm}`, range: `${h}:00 ${ampm} – ${h}:59 ${ampm}`, value: i };
});

const PLACEHOLDER_FOODS = [
  { name: 'Chicken Breast',  calories: 165, protein: 31, carbs: 0,  fats: 4  },
  { name: 'Brown Rice',      calories: 216, protein: 5,  carbs: 45, fats: 2  },
  { name: 'Whole Eggs',      calories: 155, protein: 13, carbs: 1,  fats: 11 },
  { name: 'Ground Beef 93%', calories: 218, protein: 27, carbs: 0,  fats: 12 },
  { name: 'Sweet Potato',    calories: 103, protein: 2,  carbs: 24, fats: 0  },
  { name: 'Broccoli',        calories: 55,  protein: 4,  carbs: 11, fats: 1  },
  { name: 'Greek Yogurt',    calories: 100, protein: 17, carbs: 6,  fats: 0  },
  { name: 'Oatmeal',         calories: 158, protein: 6,  carbs: 27, fats: 3  },
  { name: 'Salmon',          calories: 208, protein: 20, carbs: 0,  fats: 13 },
  { name: 'Cottage Cheese',  calories: 206, protein: 25, carbs: 6,  fats: 9  },
  { name: 'Banana',          calories: 105, protein: 1,  carbs: 27, fats: 0  },
  { name: 'Almonds',         calories: 164, protein: 6,  carbs: 6,  fats: 14 },
  { name: 'White Rice',      calories: 206, protein: 4,  carbs: 45, fats: 0  },
  { name: 'Turkey Breast',   calories: 135, protein: 30, carbs: 0,  fats: 1  },
  { name: 'Protein Shake',   calories: 150, protein: 25, carbs: 8,  fats: 3  },
];

const FILTER_TABS = ['Add Food', 'Favorites', 'Meals', 'Nutrition'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── CALENDAR MODAL ─────────────────────────────────────────
function CalendarModal({ selected, onSelect, onClose }) {
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstDay = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const todayStr = new Date().toDateString();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, monthIdx, d));

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500, overflow: 'hidden' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: 'var(--card)', borderRadius: '24px 24px 0 0',
        padding: '12px 20px 44px', zIndex: 501,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={() => setMonth(new Date(year, monthIdx - 1, 1))} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 22, padding: '4px 10px', lineHeight: 1,
          }}>‹</button>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            {MONTH_NAMES[monthIdx]} {year}
          </span>
          <button onClick={() => setMonth(new Date(year, monthIdx + 1, 1))} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 22, padding: '4px 10px', lineHeight: 1,
          }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, padding: '2px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const isToday = d.toDateString() === todayStr;
            const isSel = d.toDateString() === selected.toDateString();
            return (
              <button key={i} onClick={() => onSelect(d)} style={{
                aspectRatio: '1', borderRadius: '50%', border: 'none',
                background: isSel ? 'var(--accent)' : isToday ? 'var(--accent-light)' : 'transparent',
                color: isSel ? '#fff' : isToday ? 'var(--accent)' : 'var(--text-primary)',
                fontWeight: isSel || isToday ? 700 : 400,
                fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{d.getDate()}</button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── MACRO CIRCLE TILE ───────────────────────────────────────
function MacroCircle({ value, goal, color, trackColor, label, isCalories }) {
  const size = 80;
  const sw = 7;
  const radius = (size - sw) / 2;
  const circ = 2 * Math.PI * radius;
  const progress = Math.min(goal > 0 ? value / goal : 0, 1);
  const offset = circ - progress * circ;
  const pct = Math.round(progress * 100);

  return (
    <div style={{
      background: 'var(--card)', borderRadius: 16, padding: '12px 10px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      flexShrink: 0, minWidth: 104,
      border: '1px solid var(--border)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={trackColor} strokeWidth={sw} />
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={sw}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, textAlign: 'center' }}>
            {isCalories ? value : `${value}g`}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1 }}>
            /{isCalories ? goal : `${goal}g`}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{pct}%</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── FOOD LOG ────────────────────────────────────────────────
function FoodLog({ showToast = () => {}, calorieGoal = 2000, proteinGoal = 180, carbsGoal = 200, fatsGoal = 60 }) {
  const currentHour = new Date().getHours();

  const [date, setDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Add Food');
  const [foods, setFoods] = useState({});
  const [loading, setLoading] = useState(true);

  const [showAddFoodScreen, setShowAddFoodScreen] = useState(false);
  const [addFoodOpen, setAddFoodOpen] = useState(false);   // drives the slide-up / drag transform
  const [addFoodDragY, setAddFoodDragY] = useState(0);
  const addFoodDragStart = useRef(null);
  const [addFoodHour, setAddFoodHour] = useState(currentHour);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFoods, setSelectedFoods] = useState({});
  const [recentFoodList, setRecentFoodList] = useState([]);

  // Custom foods (user-defined). Pinned at the top of the Add Food list.
  const [customFoods, setCustomFoods] = useState([]);
  const [customModalMode, setCustomModalMode] = useState(null);   // 'create' | 'rename' | null
  const [customForm, setCustomForm] = useState({ name: '', calories: '', protein: '', carbs: '', fats: '' });
  const [editingCustomId, setEditingCustomId] = useState(null);
  const [customMenuOpen, setCustomMenuOpen] = useState(null);     // id of food whose ··· menu is open
  const [customMenuPos, setCustomMenuPos] = useState({ top: 0, right: 0 });

  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const searchDebounceRef = useRef(null);

  const isToday = date.toDateString() === new Date().toDateString();
  const dateStr = date.toLocaleDateString();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadFoods(); }, [date]);

  useEffect(() => {
    if (showAddFoodScreen) { loadRecentFoods(); loadCustomFoods(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddFoodScreen]);

  useEffect(() => {
    if (!showAddFoodScreen) return;
    const query = searchQuery.trim();
    if (!query) {
      clearTimeout(searchDebounceRef.current);
      setSearchResults(null);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => searchFoods(query), 400);
    return () => clearTimeout(searchDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, showAddFoodScreen]);

  const loadFoods = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('food_entries')
      .select('*')
      .eq('date', dateStr)
      .order('created_at', { ascending: true });
    if (error) { console.error(error); setLoading(false); return; }
    const grouped = {};
    data.forEach(entry => {
      if (!grouped[entry.hour]) grouped[entry.hour] = [];
      grouped[entry.hour].push(entry);
    });
    setFoods(grouped);
    setLoading(false);
  };

  const loadRecentFoods = async () => {
    const { data } = await supabase
      .from('food_entries')
      .select('name, calories, protein, carbs, fats')
      .order('created_at', { ascending: false })
      .limit(200);
    const seen = new Set();
    const recent = [];
    if (data) {
      for (const entry of data) {
        if (!seen.has(entry.name) && recent.length < 15) {
          seen.add(entry.name);
          recent.push({ name: entry.name, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fats: entry.fats });
        }
      }
    }
    for (const p of PLACEHOLDER_FOODS) {
      if (recent.length >= 15) break;
      if (!seen.has(p.name)) { seen.add(p.name); recent.push(p); }
    }
    setRecentFoodList(recent);
  };

  const loadCustomFoods = async () => {
    const { data } = await supabase
      .from('custom_foods')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCustomFoods(data.map(f => ({ ...f, isCustom: true })));
  };

  const openCreateCustom = () => {
    setCustomForm({ name: '', calories: '', protein: '', carbs: '', fats: '' });
    setEditingCustomId(null);
    setCustomModalMode('create');
  };

  const openRenameCustom = (food) => {
    setCustomForm({ name: food.name, calories: food.calories, protein: food.protein, carbs: food.carbs, fats: food.fats });
    setEditingCustomId(food.id);
    setCustomMenuOpen(null);
    setCustomModalMode('rename');
  };

  const closeCustomModal = () => { setCustomModalMode(null); setEditingCustomId(null); };

  const saveCustomFood = async () => {
    const name = customForm.name.trim();
    if (!name) return;
    if (customModalMode === 'rename' && editingCustomId) {
      const { error } = await supabase.from('custom_foods').update({ name }).eq('id', editingCustomId);
      if (error) { console.error(error); return; }
      setCustomFoods(prev => prev.map(f => (f.id === editingCustomId ? { ...f, name } : f)));
    } else {
      const payload = {
        name,
        calories: Number(customForm.calories) || 0,
        protein: Number(customForm.protein) || 0,
        carbs: Number(customForm.carbs) || 0,
        fats: Number(customForm.fats) || 0,
      };
      const { data, error } = await supabase.from('custom_foods').insert([payload]).select().single();
      if (error) { console.error(error); return; }
      setCustomFoods(prev => [{ ...data, isCustom: true }, ...prev]);
    }
    closeCustomModal();
  };

  const deleteCustomFood = async (food) => {
    setCustomMenuOpen(null);
    setCustomFoods(prev => prev.filter(f => f.id !== food.id));
    setSelectedFoods(prev => { const n = { ...prev }; delete n[food.name]; return n; });
    await supabase.from('custom_foods').delete().eq('id', food.id);
  };

  const searchFoods = async (query) => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `${FOOD_SEARCH_URL}?query=${encodeURIComponent(query)}`,
        { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : (data.foods || []));
    } catch (err) {
      console.error('Food search error:', err);
      setSearchError('Search unavailable');
      setSearchResults(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const deleteFood = (id, hour) => {
    const item = (foods[hour] || []).find(f => f.id === id);
    if (!item) return;
    setFoods(prev => ({ ...prev, [hour]: prev[hour].filter(f => f.id !== id) }));
    showToast(
      `"${item.name}" deleted`,
      () => setFoods(prev => ({ ...prev, [hour]: [...(prev[hour] || []), item] })),
      async () => { await supabase.from('food_entries').delete().eq('id', id); }
    );
  };

  const openAddFood = (hour) => { setAddFoodHour(hour); setAddFoodDragY(0); setShowAddFoodScreen(true); };

  // Slide the sheet up once it has mounted (next frame), so the transform animates.
  useEffect(() => {
    if (showAddFoodScreen) {
      const id = requestAnimationFrame(() => setAddFoodOpen(true));
      return () => cancelAnimationFrame(id);
    }
  }, [showAddFoodScreen]);

  const closeAddFood = () => {
    setAddFoodOpen(false);           // slide down
    setAddFoodDragY(0);
    setTimeout(() => {               // unmount + reset after the slide-out finishes
      setShowAddFoodScreen(false);
      setSearchQuery('');
      setSelectedFoods({});
      setSearchResults(null);
      setSearchError(null);
    }, 350);
  };

  const onAddFoodPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    addFoodDragStart.current = e.clientY;
  };
  const onAddFoodPointerMove = (e) => {
    if (addFoodDragStart.current === null) return;
    setAddFoodDragY(Math.max(0, e.clientY - addFoodDragStart.current));
  };
  const onAddFoodPointerUp = (e) => {
    if (addFoodDragStart.current === null) return;
    const dy = Math.max(0, e.clientY - addFoodDragStart.current);
    addFoodDragStart.current = null;
    if (dy > 80) closeAddFood();
    else setAddFoodDragY(0);
  };

  const toggleFood = (food) => {
    setSelectedFoods(prev => {
      const key = food.name;
      const next = { ...prev };
      if (next[key]) { delete next[key]; }
      else { next[key] = { ...food, _serving: food.servingSize ?? null }; }
      return next;
    });
  };

  const updateServing = (foodName, value) => {
    setSelectedFoods(prev => ({ ...prev, [foodName]: { ...prev[foodName], _serving: value } }));
  };

  const handleAddSelected = async () => {
    const foodsToAdd = Object.values(selectedFoods);
    if (foodsToAdd.length === 0) return;
    const inserts = foodsToAdd.map(f => {
      const base = f.servingSize;
      const current = Number(f._serving);
      const ratio = (base && current > 0) ? current / base : 1;
      return {
        name: f.name,
        calories: Math.round(Number(f.calories) * ratio),
        protein: Math.round(Number(f.protein) * ratio),
        carbs: Math.round(Number(f.carbs) * ratio),
        fats: Math.round(Number(f.fats) * ratio),
        hour: addFoodHour,
        date: dateStr,
      };
    });
    const { data, error } = await supabase.from('food_entries').insert(inserts).select();
    if (error) { console.error(error); return; }
    const newFoods = { ...foods };
    data.forEach(entry => {
      if (!newFoods[entry.hour]) newFoods[entry.hour] = [];
      newFoods[entry.hour].push(entry);
    });
    setFoods(newFoods);
    closeAddFood();
  };

  const allFoods = Object.values(foods).flat();
  const totals = allFoods.reduce((acc, f) => ({
    calories: acc.calories + Number(f.calories),
    protein: acc.protein + Number(f.protein),
    carbs: acc.carbs + Number(f.carbs),
    fats: acc.fats + Number(f.fats),
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  const changeDate = (dir) => {
    const d = new Date(date);
    d.setDate(d.getDate() + dir);
    setDate(d);
  };

  const navDateText = isToday
    ? `Today, ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const selectedCount = Object.keys(selectedFoods).length;
  const isSearchActive = searchQuery.trim().length > 0;
  // Custom foods are pinned at the top, so exclude their names from the recent/search list below to avoid duplicates.
  const customNames = new Set(customFoods.map(f => f.name));
  const displayedFoods = (isSearchActive && !searchError ? (searchResults || []) : recentFoodList).filter(f => !customNames.has(f.name));
  const displayedCustomFoods = isSearchActive
    ? customFoods.filter(f => f.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : customFoods;
  const listLabel = isSearchActive ? 'Results' : 'Recent';

  // Break out of the .content wrapper's 20px padding
  return (
    <div style={{ margin: '-20px' }}>

      {/* Calendar button — fixed to App header's right slot */}
      <button onClick={() => setShowCalendar(true)} style={{
        position: 'fixed', top: 0, right: 0, zIndex: 150,
        padding: '24px 20px 16px',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/>
          <path d="M16 2v4M8 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M3 10h18" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </button>

      {/* ─── DATE NAV ───────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 20px 8px',
      }}>
        <button onClick={() => changeDate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 22, padding: '2px 8px', lineHeight: 1,
        }}>‹</button>
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--accent)' }}>{navDateText}</span>
        <button onClick={() => changeDate(1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 22, padding: '2px 8px', lineHeight: 1,
        }}>›</button>
      </div>

      {/* ─── MACRO CIRCLES ──────────────────────────────────── */}
      <div style={{
        display: 'flex', overflowX: 'auto', gap: 10,
        padding: '12px 16px',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        <MacroCircle value={totals.calories} goal={calorieGoal} color="#3B82F6" trackColor="#DBEAFE" label="Calories" isCalories />
        <MacroCircle value={totals.protein}  goal={proteinGoal} color="#22C55E" trackColor="#DCFCE7" label="Protein" />
        <MacroCircle value={totals.fats}     goal={fatsGoal}    color="#3B82F6" trackColor="#DBEAFE" label="Fat" />
        <MacroCircle value={totals.carbs}    goal={carbsGoal}   color="#EAB308" trackColor="#FEF9C3" label="Carbs" />
        <div style={{ minWidth: 4, flexShrink: 0 }} />
      </div>

      {/* ─── FILTER TABS ────────────────────────────────────── */}
      <style>{`
        .fl-tab-inactive { background: #F3F4F6; }
        [data-theme="dark"] .fl-tab-inactive { background: var(--border); }
      `}</style>
      <div style={{
        display: 'flex', overflowX: 'auto', gap: 8,
        padding: '4px 16px 12px',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {FILTER_TABS.map(tab => {
          const isActive = activeFilter === tab;
          return (
            <button key={tab}
              className={isActive ? '' : 'fl-tab-inactive'}
              onClick={() => {
                if (tab === 'Add Food') setActiveFilter(tab);
                else showToast('Coming soon', null, null);
              }} style={{
                flexShrink: 0, padding: '7px 16px', borderRadius: 20,
                border: 'none',
                background: isActive ? 'var(--accent)' : undefined,
                color: isActive ? '#fff' : 'var(--text-primary)',
                fontWeight: 500, fontSize: 13, cursor: 'pointer',
              }}>{tab}</button>
          );
        })}
        <div style={{ minWidth: 4, flexShrink: 0 }} />
      </div>

      {/* ─── HOUR TIMELINE ──────────────────────────────────── */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Loading...</p>
      ) : (
        <div style={{ position: 'relative', paddingBottom: 40 }}>
          {/* Vertical connecting line through dot centers */}
          <div style={{
            position: 'absolute', left: 28, top: 0, bottom: 0,
            width: 1, background: 'var(--border)', zIndex: 0,
          }} />

          {HOURS.map(h => {
            const hourFoods = foods[h.value] || [];
            const isNow = isToday && h.value === currentHour;
            const [num, ap] = h.label.split(' ');
            return (
              <React.Fragment key={h.value}>
                {/* [dot col 16px] [hour label 44px] [tile] */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '3px 20px', gap: 8 }}>
                  {/* Dot column — line runs through its center */}
                  <div style={{
                    width: 16, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', zIndex: 1,
                  }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      border: '2px solid #3B82F6',
                      background: hourFoods.length > 0 ? '#3B82F6' : 'var(--card)',
                    }} />
                  </div>

                  {/* Hour label — two lines */}
                  <div style={{ width: 44, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isNow ? 'var(--accent)' : 'var(--text-primary)', lineHeight: 1 }}>{num}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1, marginTop: 2 }}>{ap}</span>
                  </div>

                  {/* Card */}
                  <div style={{
                    flex: 1, background: isNow ? 'var(--accent-light)' : 'var(--card)',
                    borderRadius: 12,
                    border: isNow ? '1px solid var(--accent)' : '1px solid var(--border)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                    padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => openAddFood(h.value)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--accent)', fontWeight: 600, fontSize: 13, padding: 0,
                      }}>+ Add Food</button>
                    </div>
                    {hourFoods.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(() => {
                          const ht = hourFoods.reduce((a, f) => ({
                            calories: a.calories + Number(f.calories || 0),
                            protein: a.protein + Number(f.protein || 0),
                            carbs: a.carbs + Number(f.carbs || 0),
                            fats: a.fats + Number(f.fats || 0),
                          }), { calories: 0, protein: 0, carbs: 0, fats: 0 });
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, fontWeight: 700, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                              <span style={{ color: '#3B82F6' }}>Calories: {ht.calories}</span>
                              <span style={{ color: '#22C55E' }}>P: {ht.protein}g</span>
                              <span style={{ color: '#3B82F6' }}>F: {ht.fats}g</span>
                              <span style={{ color: '#EAB308' }}>C: {ht.carbs}g</span>
                            </div>
                          );
                        })()}
                        {hourFoods.map(f => (
                          <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{f.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{f.calories} cal · {f.protein}g P</div>
                            </div>
                            <button onClick={() => deleteFood(f.id, h.value)} style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-muted)', fontSize: 18, padding: '2px 4px',
                              lineHeight: 1, flexShrink: 0,
                            }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section dividers after 5 AM and 11 AM */}
                {(h.value === 5 || h.value === 11) && (
                  <div style={{ margin: '4px 20px 4px 96px', borderTop: '1px dashed var(--border)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ─── CALENDAR MODAL ─────────────────────────────────── */}
      {showCalendar && (
        <CalendarModal
          selected={date}
          onSelect={d => { setDate(d); setShowCalendar(false); }}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* ─── ADD FOOD SCREEN ────────────────────────────────── */}
      {showAddFoodScreen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg)',
          display: 'flex', flexDirection: 'column',
          transform: addFoodOpen ? `translateY(${addFoodDragY}px)` : 'translateY(100%)',
          transition: addFoodDragY > 0 ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <style>{`
            @keyframes slideUpBar  { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            @keyframes spin        { to { transform: rotate(360deg); } }
          `}</style>

          {/* Drag handle — drag down to dismiss */}
          <div
            onPointerDown={onAddFoodPointerDown}
            onPointerMove={onAddFoodPointerMove}
            onPointerUp={onAddFoodPointerUp}
            style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', flexShrink: 0, userSelect: 'none', touchAction: 'none' }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px 12px', gap: '10px', background: 'var(--bg)' }}>
            <span style={{ flex: 1, fontWeight: '700', fontSize: '17px', color: 'var(--text-primary)' }}>Add Food</span>
            <button onClick={openCreateCustom} aria-label="Add custom food"
              style={{ background: 'var(--accent)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '13px', fontWeight: '500', lineHeight: 1, padding: '7px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              + Add Custom Food
            </button>
            <div style={{
              background: 'var(--accent-light)', color: 'var(--accent)',
              padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', flexShrink: 0,
            }}>
              {HOURS[addFoodHour].label}
            </div>
          </div>

          <div style={{ padding: '0 20px 12px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: '32px', top: 0, bottom: '12px', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: 'var(--text-muted)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <input
              placeholder="Search for a food"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input"
              style={{ paddingLeft: '44px', paddingRight: '48px' }}
            />
            <div style={{ position: 'absolute', right: '32px', top: 0, bottom: '12px', display: 'flex', alignItems: 'center' }}>
              {searchLoading ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <button onClick={() => showToast('Coming Soon', null, null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '4px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="2"  y="4" width="2" height="16"/>
                    <rect x="6"  y="4" width="1" height="16"/>
                    <rect x="9"  y="4" width="2" height="16"/>
                    <rect x="13" y="4" width="1" height="16"/>
                    <rect x="16" y="4" width="2" height="16"/>
                    <rect x="20" y="4" width="2" height="16"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>

            {displayedCustomFoods.map(food => {
              const isSelected = !!selectedFoods[food.name];
              return (
                <div key={'custom-' + food.id} onClick={() => toggleFood(food)} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                }}>
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                    border: isSelected ? 'none' : '2px solid var(--border)',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s',
                  }}>
                    {isSelected && <span style={{ color: 'white', fontSize: '12px', lineHeight: 1 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{food.name}</span>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 6px', borderRadius: '8px' }}>Custom</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {Math.round(food.calories)} cal · {Math.round(food.protein)}g P · {Math.round(food.carbs)}g C · {Math.round(food.fats)}g F
                    </div>
                  </div>
                  <button onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setCustomMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                    setCustomMenuOpen(customMenuOpen === food.id ? null : food.id);
                  }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px', padding: '4px 8px', letterSpacing: '2px', lineHeight: 1, flexShrink: 0 }}>···</button>
                </div>
              );
            })}

            {searchError && (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                {searchError} — showing recent foods
              </p>
            )}

            {(!isSearchActive || searchError || (searchResults && searchResults.length > 0)) && (
              <p className="section-title" style={{ marginBottom: '4px', fontWeight: 800, color: 'var(--text-secondary)' }}>{searchError ? 'Recent' : listLabel}</p>
            )}

            {isSearchActive && !searchLoading && !searchError && searchResults && searchResults.length === 0 && (
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>No results found</p>
            )}

            {displayedFoods.map(food => {
              const isSelected = !!selectedFoods[food.name];
              const sel = selectedFoods[food.name];
              const currentServing = sel ? Number(sel._serving) : 0;
              const base = food.servingSize;
              const ratio = (base && currentServing > 0) ? currentServing / base : 1;
              return (
                <div key={food.name + (food.brandOwner || '')}>
                  <div onClick={() => toggleFood(food)} style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '12px 0', borderBottom: isSelected && base ? 'none' : '1px solid var(--border)',
                    cursor: 'pointer',
                  }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                      border: isSelected ? 'none' : '2px solid var(--border)',
                      background: isSelected ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s',
                    }}>
                      {isSelected && <span style={{ color: 'white', fontSize: '12px', lineHeight: 1 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{food.name}</div>
                      {food.brandOwner && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{food.brandOwner}</div>
                      )}
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {Math.round(food.calories * ratio)} cal · {Math.round(food.protein * ratio)}g P · {Math.round(food.carbs * ratio)}g C · {Math.round(food.fats * ratio)}g F
                      </div>
                    </div>
                  </div>

                  {isSelected && base != null && (
                    <div onClick={e => e.stopPropagation()} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 0 12px', paddingLeft: '36px',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <input
                        type="number" inputMode="decimal"
                        value={sel._serving ?? ''}
                        onChange={e => updateServing(food.name, e.target.value)}
                        style={{
                          width: '72px', padding: '6px 10px', borderRadius: '8px',
                          border: '1.5px solid var(--accent)', background: 'var(--bg)',
                          color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{food.servingSizeUnit || 'g'}</span>
                      {currentServing > 0 && (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>= {Math.round(food.calories * ratio)} cal</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedCount > 0 && (
            <div style={{
              padding: '12px 20px 32px', borderTop: '1px solid var(--border)',
              background: 'var(--bg)', animation: 'slideUpBar 0.2s ease forwards',
            }}>
              <button onClick={handleAddSelected} className="btn-primary">
                Add {selectedCount} Food{selectedCount !== 1 ? 's' : ''}
              </button>
            </div>
          )}

          {/* Custom food ··· menu */}
          {customMenuOpen && <div onClick={() => setCustomMenuOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 440 }} />}
          {customMenuOpen && (() => {
            const food = customFoods.find(f => f.id === customMenuOpen);
            if (!food) return null;
            return (
              <div style={{
                position: 'fixed', top: customMenuPos.top, right: customMenuPos.right,
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px',
                overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 441, minWidth: '140px',
              }}>
                <button onClick={() => openRenameCustom(food)}
                  style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>Rename</button>
                <button onClick={() => deleteCustomFood(food)}
                  style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: '#ff4444' }}>Delete</button>
              </div>
            );
          })()}

          {/* Create / rename custom food modal */}
          {customModalMode && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '14vh 16px 16px', zIndex: 460 }}
              onClick={closeCustomModal}>
              <div className="card" style={{ width: '100%', maxWidth: '360px', padding: '24px' }} onClick={e => e.stopPropagation()}>
                <p className="section-title" style={{ marginBottom: '16px' }}>{customModalMode === 'rename' ? 'Rename Custom Food' : 'New Custom Food'}</p>
                <input autoFocus value={customForm.name} onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Food name" className="input" style={{ width: '100%', marginBottom: customModalMode === 'create' ? '12px' : '16px' }}
                  onKeyDown={e => { if (e.key === 'Enter') saveCustomFood(); }} />
                {customModalMode === 'create' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                    <input value={customForm.calories} onChange={e => setCustomForm(f => ({ ...f, calories: e.target.value }))} inputMode="numeric" placeholder="Calories" className="input" />
                    <input value={customForm.protein} onChange={e => setCustomForm(f => ({ ...f, protein: e.target.value }))} inputMode="numeric" placeholder="Protein (g)" className="input" />
                    <input value={customForm.carbs} onChange={e => setCustomForm(f => ({ ...f, carbs: e.target.value }))} inputMode="numeric" placeholder="Carbs (g)" className="input" />
                    <input value={customForm.fats} onChange={e => setCustomForm(f => ({ ...f, fats: e.target.value }))} inputMode="numeric" placeholder="Fats (g)" className="input" />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={closeCustomModal} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  <button onClick={saveCustomFood} className="btn-primary" style={{ flex: 1 }}>{customModalMode === 'rename' ? 'Save' : 'Create'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FoodLog;
