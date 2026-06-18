// Inline SVG icons for the bottom tab bar.
// All use stroke="currentColor" so the active/inactive color comes from
// the parent .tab-item color (set in App.css). Sized via .tab-icon svg.

const ICON_PATHS = {
  // House — roof + body
  home: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
    </>
  ),
  // Plus — "add food"
  plus: (
    <>
      <line x1="12" y1="6" x2="12" y2="18" />
      <line x1="6" y1="12" x2="18" y2="12" />
    </>
  ),
  // Dumbbell — center bar with inner + outer plates
  dumbbell: (
    <>
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="5" y1="8" x2="5" y2="16" />
      <line x1="7" y1="9" x2="7" y2="15" />
      <line x1="19" y1="8" x2="19" y2="16" />
      <line x1="17" y1="9" x2="17" y2="15" />
    </>
  ),
  // Person — head + shoulders
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
    </>
  ),
};

export default function TabIcon({ name }) {
  const paths = ICON_PATHS[name];
  if (!paths) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}
