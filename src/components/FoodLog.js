import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import SwipeToDelete from './SwipeToDelete';

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const hour = i % 12 === 0 ? 12 : i % 12;
  const ampm = i < 12 ? 'AM' : 'PM';
  return { label: `${hour}:00 ${ampm}`, value: i };
});

function FoodLog() {
  const currentHour = new Date().getHours();
  const today = new Date().toLocaleDateString();
  const [foods, setFoods] = useState({});
  const [selectedHour, setSelectedHour] = useState(currentHour);
  const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fats: '' });
  const [loading, setLoading] = useState(true);

 useEffect(() => {
  loadFoods();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

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

  const addFood = async () => {
    if (!form.name || !form.calories) return;
    const { data, error } = await supabase
      .from('food_entries')
      .insert([{
        name: form.name,
        calories: Number(form.calories),
        protein: Number(form.protein) || 0,
        carbs: Number(form.carbs) || 0,
        fats: Number(form.fats) || 0,
        hour: selectedHour,
        date: today
      }])
      .select()
      .single();

    if (error) { console.error(error); return; }

    const existing = foods[selectedHour] || [];
    setFoods({ ...foods, [selectedHour]: [...existing, data] });
    setForm({ name: '', calories: '', protein: '', carbs: '', fats: '' });
  };

  const deleteFood = async (id, hour) => {
    const { error } = await supabase.from('food_entries').delete().eq('id', id);
    if (error) { console.error(error); return; }
    setFoods(prev => ({ ...prev, [hour]: prev[hour].filter(f => f.id !== id) }));
  };

  const allFoods = Object.values(foods).flat();
  const totals = allFoods.reduce((acc, f) => ({
    calories: acc.calories + Number(f.calories),
    protein: acc.protein + Number(f.protein),
    carbs: acc.carbs + Number(f.carbs),
    fats: acc.fats + Number(f.fats),
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>Loading...</p>;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Daily Totals */}
      {allFoods.length > 0 && (
        <div className="card">
          <p className="section-title">Daily Totals</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
            {Object.entries(totals).map(([key, val]) => (
              <div key={key} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent)' }}>{val}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Food Form */}
      <div className="card">
        <p className="section-title">Add Food</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          <select value={selectedHour} onChange={e => setSelectedHour(Number(e.target.value))} className="input">
            {HOURS.map(h => (
              <option key={h.value} value={h.value}>{h.label}{h.value === currentHour ? ' (Now)' : ''}</option>
            ))}
          </select>
          {['name', 'calories', 'protein', 'carbs', 'fats'].map(field => (
            <input key={field} placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
              value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })}
              className="input" />
          ))}
          <button onClick={addFood} className="btn-primary">+ Add Food</button>
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <p className="section-title">Today</p>
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {HOURS.map(h => {
            const hourFoods = foods[h.value] || [];
            const isNow = h.value === currentHour;
            return (
              <div key={h.value} style={{
                display: 'flex', alignItems: 'flex-start', padding: '8px 12px',
                borderRadius: '10px', gap: '12px',
                background: isNow ? 'var(--accent-light)' : 'transparent',
                border: isNow ? '1px solid var(--blue-200)' : '1px solid transparent'
              }}>
                <span style={{
                  fontSize: '12px', fontWeight: isNow ? '700' : '500',
                  color: isNow ? 'var(--accent)' : 'var(--text-muted)',
                  width: '72px', flexShrink: 0, paddingTop: '2px'
                }}>{h.label}</span>
                {hourFoods.length === 0
                  ? <span style={{ fontSize: '12px', color: 'var(--border)' }}>—</span>
                  : <div style={{ flex: 1 }}>
                    {hourFoods.map((f, i) => (
                      <SwipeToDelete key={f.id} onDelete={() => deleteFood(f.id, h.value)} style={{ borderRadius: '8px', marginBottom: i < hourFoods.length - 1 ? '6px' : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)' }}>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{f.name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                            {f.calories} cal · {f.protein}g P · {f.carbs}g C · {f.fats}g F
                          </span>
                        </div>
                        <button onClick={() => deleteFood(f.id, h.value)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>
                          ×
                        </button>
                      </div>
                      </SwipeToDelete>
                    ))}
                  </div>
                }
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

export default FoodLog;