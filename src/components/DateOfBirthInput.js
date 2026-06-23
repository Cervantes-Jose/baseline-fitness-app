import { useState, useRef, useEffect } from 'react';

// Hybrid date-of-birth field: the user can either TYPE their birthday in
// mm/dd/yyyy (auto-formatted as they go) or tap the calendar icon to open the
// native date picker — which makes picking a year far easier than the bare
// <input type="date"> year stepper. Emits an ISO "YYYY-MM-DD" string (or '' when
// the typed value isn't yet a valid date) so it drops straight into the existing
// `dob` state in AuthScreen.

// "1990-05-06" -> "05/06/1990"
function isoToDisplay(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

// Strip non-digits and re-insert slashes so typing flows mm -> mm/dd -> mm/dd/yyyy.
function formatTyped(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// "05/06/1990" -> "1990-05-06", or null if it isn't a real, complete date.
function displayToIso(display) {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const month = +mm, day = +dd, year = +yyyy;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(year, month - 1, day);
  // Reject impossible dates like 02/31 (JS rolls them over).
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export default function DateOfBirthInput({ value = '', onChange = () => {}, disabled = false, max, style }) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const pickerRef = useRef(null);
  // Track what we last sent up so an external value change (e.g. form reset) can
  // resync the text field without clobbering what the user is mid-typing.
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(isoToDisplay(value));
    }
  }, [value]);

  const emit = (iso) => {
    lastEmitted.current = iso;
    onChange(iso);
  };

  const handleText = (e) => {
    const formatted = formatTyped(e.target.value);
    setText(formatted);
    emit(displayToIso(formatted) || '');
  };

  const handlePicker = (e) => {
    const iso = e.target.value; // already YYYY-MM-DD
    setText(isoToDisplay(iso));
    emit(iso);
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker(); // Chromium / modern browsers
    } catch {
      el.focus();
      el.click(); // fallback for browsers without showPicker()
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="mm/dd/yyyy"
        value={text}
        onChange={handleText}
        disabled={disabled}
        maxLength={10}
        style={{ ...style, textAlign: 'left', paddingRight: 52 }}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-label="Open calendar"
        style={{
          position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          color: 'var(--text-muted)',
        }}
      >
        <CalendarIcon />
      </button>
      {/* Hidden native date input anchors showPicker() near the icon and feeds
          the chosen date back as YYYY-MM-DD. */}
      <input
        ref={pickerRef}
        type="date"
        value={value}
        max={max}
        onChange={handlePicker}
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: 'absolute', right: 14, top: '50%', width: 1, height: 1,
          opacity: 0, pointerEvents: 'none', border: 'none', padding: 0,
        }}
      />
    </div>
  );
}
