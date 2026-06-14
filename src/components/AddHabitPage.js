import { useState } from 'react';
import { WEEK_ORDER, DOW_LETTER, customFreqLabel } from './habitMath';
import WheelTimePicker from './WheelTimePicker';

// Full-page form to create (or edit) a daily habit. Reminders store settings only.
// onSave receives the assembled fields (no id/user_id; the caller persists).
export default function AddHabitPage({ onBack, onSave, initial = null }) {
  const [name, setName] = useState(initial?.name || '');
  const [frequency, setFrequency] = useState(initial?.frequency || 'daily');
  const [customDays, setCustomDays] = useState(initial?.custom_days || []);   // JS getDay() indices
  const [target, setTarget] = useState(initial?.target || '');
  const [reminderEnabled, setReminderEnabled] = useState(initial?.reminder_enabled || false);
  const [reminderTime, setReminderTime] = useState(initial?.reminder_time ? initial.reminder_time.slice(0, 5) : '09:00');
  const [reminderFreq, setReminderFreq] = useState(initial?.reminder_frequency || 'daily');
  const [reminderDays, setReminderDays] = useState(initial?.reminder_custom_days || []);
  // Inline editors inside the Reminders card
  const [timeOpen, setTimeOpen] = useState(false);
  const [daysOpen, setDaysOpen] = useState(false);

  const canSave = name.trim().length > 0 && (frequency !== 'custom' || customDays.length > 0);

  const toggleDay = (dow, setter, current) =>
    setter(current.includes(dow) ? current.filter(d => d !== dow) : [...current, dow]);

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      frequency,
      custom_days: frequency === 'custom' ? customDays : [],
      target: target.trim() || null,
      reminder_enabled: reminderEnabled,
      reminder_time: reminderEnabled ? reminderTime : null,
      reminder_frequency: reminderEnabled ? reminderFreq : 'daily',
      reminder_custom_days: reminderEnabled && reminderFreq === 'custom' ? reminderDays : [],
    });
  };

  // 12-hour display for a "HH:MM" value.
  const fmtTime = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  const daysLabel = reminderFreq === 'weekdays' ? 'Weekdays'
    : reminderFreq === 'custom' ? (reminderDays.length ? customFreqLabel(reminderDays) : 'Custom')
    : 'Every day';

  // Frequency / Days pills: outlined, no fill — selection just turns the word blue.
  const segTile = (label, value, active, onClick) => (
    <button key={value} onClick={onClick}
      style={{
        flex: 1, padding: '12px 0', borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 500,
        border: '1px solid var(--accent)', background: 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-primary)',
        transition: 'color 0.15s',
      }}>
      {label}
    </button>
  );

  const dayCircles = (selected, setter) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 12 }}>
      {WEEK_ORDER.map(dow => {
        const on = selected.includes(dow);
        return (
          <button key={dow} onClick={() => toggleDay(dow, setter, selected)} aria-label={`Toggle ${DOW_LETTER[dow]}`}
            style={{
              flex: 1, aspectRatio: '1', maxWidth: 42, borderRadius: '50%', cursor: 'pointer',
              border: on ? 'none' : '1px solid var(--border)',
              background: on ? 'var(--accent)' : 'transparent',
              color: on ? '#fff' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}>
            {DOW_LETTER[dow]}
          </button>
        );
      })}
    </div>
  );

  const sectionLabel = (text, optional) => (
    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
      {text}{optional && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> (Optional)</span>}
    </p>
  );

  // Matches the section headers inside a habit's detail (uppercase, grey, tracked).
  const cardHeader = (text, optional) => (
    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 18px' }}>
      {text}{optional && <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}> (Optional)</span>}
    </p>
  );

  // Full-width divider inside a 16px-padded card.
  const divider = <div style={{ borderTop: '1px solid var(--border)', margin: '0 -16px' }} />;

  const chevron = (open) => (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', color: 'var(--text-muted)', flexShrink: 0 }}>
      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Header — back chevron, then the title dropped a little below it */}
      <div style={{ padding: '16px 20px 0' }}>
        <button onClick={onBack} aria-label="Back"
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, display: 'flex', marginBottom: 16 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>{initial ? 'Edit Habit' : 'Add Habit'}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>
          Create a new daily habit to<br />track on your dashboard.
        </p>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Habit Details */}
        <div className="card" style={{ paddingBottom: 28 }}>
          {cardHeader('Habit Details')}

          <div style={{ marginBottom: 24 }}>
            {sectionLabel('Habit Name')}
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Creatine, Water, Stretching" className="input" />
          </div>

          <div style={{ marginBottom: 24 }}>
            {sectionLabel('Frequency')}
            <div style={{ display: 'flex', gap: 8 }}>
              {segTile('Daily', 'daily', frequency === 'daily', () => setFrequency('daily'))}
              {segTile('Weekdays', 'weekdays', frequency === 'weekdays', () => setFrequency('weekdays'))}
              {segTile('Custom', 'custom', frequency === 'custom', () => setFrequency('custom'))}
            </div>
            {frequency === 'custom' && dayCircles(customDays, setCustomDays)}
          </div>

          <div>
            {sectionLabel('Target', true)}
            <input value={target} onChange={e => setTarget(e.target.value)}
              placeholder="e.g. 5g, 8 cups, 10 min, 10,000 steps" className="input" />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>Leave blank if no specific target.</p>
          </div>
        </div>

        {/* Reminders */}
        <div className="card">
          {cardHeader('Reminders', true)}

          {/* Reminder on/off */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: reminderEnabled ? 14 : 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Reminder</span>
            <button onClick={() => setReminderEnabled(v => !v)} aria-label="Toggle reminder"
              style={{
                width: 50, height: 30, borderRadius: 15, border: 'none', cursor: 'pointer', padding: 0,
                background: reminderEnabled ? 'var(--accent)' : 'var(--border)', position: 'relative', transition: 'background 0.2s',
              }}>
              <span style={{
                position: 'absolute', top: 3, left: reminderEnabled ? 23 : 3, width: 24, height: 24, borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>

          {reminderEnabled && (
            <>
              {divider}
              {/* Time row */}
              <button onClick={() => { setTimeOpen(o => !o); setDaysOpen(false); }}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Time</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>{fmtTime(reminderTime)}</span>
                  {chevron(timeOpen)}
                </span>
              </button>
              {timeOpen && (
                <div style={{ paddingBottom: 14 }}>
                  <WheelTimePicker value={reminderTime} onChange={setReminderTime} />
                </div>
              )}

              {divider}
              {/* Days row */}
              <button onClick={() => { setDaysOpen(o => !o); setTimeOpen(false); }}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Days</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>{daysLabel}</span>
                  {chevron(daysOpen)}
                </span>
              </button>
              {daysOpen && (
                <div style={{ paddingBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {segTile('Every day', 'daily', reminderFreq === 'daily', () => setReminderFreq('daily'))}
                    {segTile('Weekdays', 'weekdays', reminderFreq === 'weekdays', () => setReminderFreq('weekdays'))}
                    {segTile('Custom', 'custom', reminderFreq === 'custom', () => setReminderFreq('custom'))}
                  </div>
                  {reminderFreq === 'custom' && dayCircles(reminderDays, setReminderDays)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={!canSave}
          style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: 'var(--accent)', color: '#fff', fontSize: 16, fontWeight: 700,
            cursor: canSave ? 'pointer' : 'default', opacity: canSave ? 1 : 0.45,
          }}>
          {initial ? 'Save Changes' : 'Add Habit'}
        </button>
      </div>
    </div>
  );
}
