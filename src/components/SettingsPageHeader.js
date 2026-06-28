// Row header for settings pages that own their own navigation: a blue back
// chevron with the page title immediately to its right. (Top-level profile
// sub-pages use App.js's stacked header; Account Information and its Change
// Password / Change Email sub-pages render this instead.)
export default function SettingsPageHeader({ title, onBack }) {
  return (
    <div className="header" style={{ justifyContent: 'flex-start', gap: 6 }}>
      <button
        onClick={onBack}
        aria-label="Back"
        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, marginLeft: -4, display: 'flex' }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <span className="header-title">{title}</span>
    </div>
  );
}
