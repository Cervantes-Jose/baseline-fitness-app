import React, { useState } from 'react';

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const hour = i % 12 === 0 ? 12 : i % 12;
  const ampm = i < 12 ? 'AM' : 'PM';
  return { label: `${hour}:00 ${ampm}`, value: i };
});

function FoodLog() {
  const currentHour = new Date().getHours();
  const [foods, setFoods] = useState({});
  const [selectedHour, setSelectedHour] = useState(currentHour);
  const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fats: '' });

  const addFood = () => {
    if (!form.name || !form.calories) return;
    const existing = foods[selectedHour] || [];
    setFoods({ ...foods, [selectedHour]: [...existing, form] });
    setForm({ name: '', calories: '', protein: '', carbs: '', fats: '' });
  };

  const allFoods = Object.values(foods).flat();
  const totals = allFoods.reduce((acc, f) => ({
    calories: acc.calories + Number(f.calories),
    protein: acc.protein + Number(f.protein),
    carbs: acc.carbs + Number(f.carbs),
    fats: acc.fats + Number(f.fats),
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Food Log</h2>
      {allFoods.length > 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 10px', fontWeight: 'bold', fontSize: '13px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Daily Totals</p>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {Object.entries(totals).map(([key, val]) => (
              <div key={key} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4CAF50' }}>{val}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>{key}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 10px', fontWeight: 'bold', fontSize: '13px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Add Food</p>
        <select value={selectedHour} onChange={e => setSelectedHour(Number(e.target.value))}
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #333', background: '#222', color: 'white', fontSize: '14px', marginBottom: '10px' }}>
          {HOURS.map(h => (
            <option key={h.value} value={h.value}>{h.label}{h.value === currentHour ? ' (Now)' : ''}</option>
          ))}
        </select>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {['name', 'calories', 'protein', 'carbs', 'fats'].map(field => (
            <input key={field} placeholder={field.charAt(0).toUpperCase() + field.slice(1)} value={form[field]}
              onChange={e => setForm({ ...form, [field]: e.target.value })}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #333', background: '#222', color: 'white', fontSize: '14px' }} />
          ))}
          <button onClick={addFood}
            style={{ padding: '12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold' }}>
            + Add Food
          </button>
        </div>
      </div>
      <p style={{ margin: '0 0 10px', fontWeight: 'bold', fontSize: '13px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Today</p>
      {HOURS.map(h => {
        const hourFoods = foods[h.value] || [];
        const isNow = h.value === currentHour;
        return (
          <div key={h.value} style={{ marginBottom: '4px', borderRadius: '8px', border: isNow ? '1px solid #4CAF50' : '1px solid #222', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: '#1a1a1a' }}>
              <span style={{ fontSize: '13px', color: isNow ? '#4CAF50' : '#555', width: '80px', fontWeight: isNow ? 'bold' : 'normal' }}>{h.label}</span>
              {hourFoods.length === 0 ? <span style={{ fontSize: '12px', color: '#333' }}>—</span> : (
                <div style={{ flex: 1 }}>
                  {hourFoods.map((f, i) => (
                    <div key={i} style={{ marginBottom: i < hourFoods.length - 1 ? '6px' : 0 }}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{f.name}</span>
                      <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>{f.calories} cal · {f.protein}g P · {f.carbs}g C · {f.fats}g F</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default FoodLog;