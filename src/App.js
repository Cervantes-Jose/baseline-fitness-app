import React, { useState } from 'react';
import FoodLog from './components/FoodLog';
import Workouts from './components/Workouts';
import Measurements from './components/Measurements';


function App() {
  const [activeTab, setActiveTab] = useState('food');

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#111', minHeight: '100vh', color: 'white' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #333' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Fitness Tracker</h1>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
        {['food', 'workouts', 'measurements'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '14px',
              background: activeTab === tab ? '#222' : 'transparent',
              color: activeTab === tab ? 'white' : '#888',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #4CAF50' : '2px solid transparent',
              cursor: 'pointer', fontSize: '14px', textTransform: 'capitalize'
            }}>
            {tab}
          </button>
        ))}
      </div>
      <div style={{ padding: '20px' }}>
        {activeTab === 'food' && <FoodLog />}
        {activeTab === 'workouts' && <Workouts />}
        {activeTab === 'measurements' && <Measurements />}
      </div>
    </div>
  );
}

export default App;