import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

const FOOD_SEARCH_URL = 'https://xbvncbvoyatxbdhkkifq.supabase.co/functions/v1/food-search';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhidm5jYnZveWF0eGJkaGtraWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTQzNzgsImV4cCI6MjA5NDk3MDM3OH0.rMAoMAlVvaAgfcAM4um750S-ZFXLccVy45OGe2-VHl0';

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const hour = i % 12 === 0 ? 12 : i % 12;
  const ampm = i < 12 ? 'AM' : 'PM';
  return { label: `${hour}:00 ${ampm}`, value: i };
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

function CircleProgress({ value, goal, size = 90, strokeWidth = 8, color = 'var(--accent)' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / goal, 1);
  const offset = circumference - progress * circumference;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
    </svg>
  );
}

function FoodLog({ showToast = () => {}, calorieGoal = 2000, proteinGoal = 180, carbsGoal = 200, fatsGoal = 60 }) {
  const currentHour = new Date().getHours();
  const today = new Date().toLocaleDateString();
  const [foods, setFoods] = useState({});
  const [loading, setLoading] = useState(true);

  // Add Food screen
  const [showAddFoodScreen, setShowAddFoodScreen] = useState(false);
  const [addFoodHour, setAddFoodHour] = useState(currentHour);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFoods, setSelectedFoods] = useState({});
  const [recentFoodList, setRecentFoodList] = useState([]);

  // Search state
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    loadFoods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showAddFoodScreen) loadRecentFoods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddFoodScreen]);

  // Debounced USDA search
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
      .eq('date', today)
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

  const searchFoods = async (query) => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `${FOOD_SEARCH_URL}?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
          },
        }
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

  const openAddFood = (hour) => {
    setAddFoodHour(hour);
    setShowAddFoodScreen(true);
  };

  const closeAddFood = () => {
    setShowAddFoodScreen(false);
    setSearchQuery('');
    setSelectedFoods({});
    setSearchResults(null);
    setSearchError(null);
  };

  const toggleFood = (food) => {
    setSelectedFoods(prev => {
      const key = food.name;
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = { ...food, _serving: food.servingSize ?? null };
      }
      return next;
    });
  };

  const updateServing = (foodName, value) => {
    setSelectedFoods(prev => ({
      ...prev,
      [foodName]: { ...prev[foodName], _serving: value },
    }));
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
        date: today,
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

  const selectedCount = Object.keys(selectedFoods).length;
  const isSearchActive = searchQuery.trim().length > 0;
  const displayedFoods = (isSearchActive && searchResults !== null) ? searchResults : recentFoodList;
  const listLabel = isSearchActive ? 'Results' : 'Recent';

  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>Loading...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* Summary Tile */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircleProgress value={totals.calories} goal={calorieGoal} />
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1 }}>{totals.calories}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>kcal</div>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>of {calorieGoal}</div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'PROTEIN', consumed: totals.protein, goal: proteinGoal },
              { label: 'CARBS',   consumed: totals.carbs,   goal: carbsGoal   },
              { label: 'FATS',    consumed: totals.fats,    goal: fatsGoal    },
            ].map(({ label, consumed, goal }) => (
              <div key={label}>
                <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', color: 'var(--text-primary)', marginBottom: '4px' }}>{label}</div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '3px', background: 'var(--accent)', width: `${Math.min(goal > 0 ? consumed / goal * 100 : 0, 100)}%`, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right', marginTop: '2px' }}>{consumed}g / {goal}g</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hour Cards */}
      {HOURS.map(h => {
        const hourFoods = foods[h.value] || [];
        const isNow = h.value === currentHour;
        return (
          <div key={h.value} className="card" style={{
            borderLeft: isNow ? '3px solid #22C55E' : undefined,
            background: isNow ? 'var(--accent-light)' : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)' }}>{h.label}</span>
              <button onClick={() => openAddFood(h.value)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: '600', fontSize: '13px', padding: '4px 0' }}>
                + Add Food
              </button>
            </div>
            {hourFoods.length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {hourFoods.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{f.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{f.calories} cal · {f.protein}g P · {f.carbs}g C · {f.fats}g F</div>
                    </div>
                    <button onClick={() => deleteFood(f.id, h.value)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Add Food Screen */}
      {showAddFoodScreen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg)',
          display: 'flex', flexDirection: 'column',
          animation: 'slideUpFull 0.3s cubic-bezier(0.4,0,0.2,1) forwards',
        }}>
          <style>{`
            @keyframes slideUpFull { from { transform: translateY(100%); } to { transform: translateY(0); } }
            @keyframes slideUpBar  { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            @keyframes spin        { to { transform: rotate(360deg); } }
          `}</style>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '20px 20px 12px', gap: '12px', background: 'var(--bg)' }}>
            <button onClick={closeAddFood} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: '22px', lineHeight: 1,
              padding: '4px', borderRadius: '8px', display: 'flex', alignItems: 'center',
            }}>←</button>
            <span style={{ flex: 1, textAlign: 'center', fontWeight: '700', fontSize: '17px', color: 'var(--text-primary)' }}>Add Food</span>
            <div style={{
              background: 'var(--accent-light)', color: 'var(--accent)',
              padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
            }}>
              {HOURS[addFoodHour].label}
            </div>
          </div>

          {/* Search bar */}
          <div style={{ padding: '0 20px 12px', position: 'relative' }}>
            <input
              placeholder="Search foods..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input"
              style={{ paddingRight: '48px' }}
            />
            <div style={{ position: 'absolute', right: '32px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
              {searchLoading ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <button
                  onClick={() => showToast('Coming Soon', null, null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '4px' }}
                >
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

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>

            {/* Favorites + Recipes tiles — hidden while searching */}
            {!isSearchActive && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Favorites', icon: '★' },
                  { label: 'Recipes',   icon: '📖' },
                ].map(({ label, icon }) => (
                  <button key={label} onClick={() => showToast('Coming Soon', null, null)} style={{
                    flex: 1, background: 'var(--accent-light)', border: '1px solid var(--border)',
                    borderRadius: '16px', padding: '16px 12px', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ fontSize: '20px', marginBottom: '6px' }}>{icon}</div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{label}</div>
                    <div style={{
                      marginTop: '6px', display: 'inline-block',
                      background: 'var(--border)', color: 'var(--text-muted)',
                      fontSize: '10px', fontWeight: '600', padding: '2px 6px',
                      borderRadius: '6px', letterSpacing: '0.3px',
                    }}>Coming Soon</div>
                  </button>
                ))}
              </div>
            )}

            {/* Search error fallback */}
            {searchError && (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                {searchError} — showing recent foods
              </p>
            )}

            {/* List section header */}
            {(!isSearchActive || searchError || (searchResults && searchResults.length > 0)) && (
              <p className="section-title" style={{ marginBottom: '4px' }}>{searchError ? 'Recent' : listLabel}</p>
            )}

            {/* No results state */}
            {isSearchActive && !searchLoading && !searchError && searchResults && searchResults.length === 0 && (
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>
                No results found
              </p>
            )}

            {/* Food list */}
            {(searchError ? recentFoodList : displayedFoods).map(food => {
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

                  {/* Serving size row — only for foods with servingSize (USDA results) */}
                  {isSelected && base != null && (
                    <div onClick={e => e.stopPropagation()} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 0 12px', paddingLeft: '36px',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={sel._serving ?? ''}
                        onChange={e => updateServing(food.name, e.target.value)}
                        style={{
                          width: '72px', padding: '6px 10px', borderRadius: '8px',
                          border: '1.5px solid var(--accent)', background: 'var(--bg)',
                          color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {food.servingSizeUnit || 'g'}
                      </span>
                      {currentServing > 0 && (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          = {Math.round(food.calories * ratio)} cal
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom action bar */}
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
        </div>
      )}
    </div>
  );
}

export default FoodLog;
