import { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import SettingsPageHeader from './SettingsPageHeader';
import CenterModal from './CenterModal';
import DeleteAccountModal from './DeleteAccountModal';

// Grey right-pointing chevron, sized to echo the back-button chevron.
const RightChevron = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M9 5l7 7-7 7" stroke="var(--text-muted)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Each export option maps to a `type` the export-data Edge Function understands.
const EXPORT_ROWS = [
  { type: 'all', title: 'Export All Data', desc: 'Workouts, food logs, measurements and more' },
  { type: 'workouts', title: 'Export Workouts', desc: 'Workout history and exercises' },
  { type: 'nutrition', title: 'Export Nutrition', desc: 'Food log and nutrients' },
  { type: 'measurements', title: 'Export Measurements', desc: 'All measurements' },
  { type: 'prs', title: 'Export PRs', desc: 'Exercise PRs and workout volume' },
];

// Stacked title + description row with a grey arrow on the right. `danger` paints
// the title red (used by Delete Account).
function Row({ title, desc, onClick, isLast, danger }) {
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: isLast ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: danger ? '#EF4444' : 'var(--text-primary)' }}>{title}</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{desc}</span>
      </div>
      <RightChevron />
    </div>
  );
}

export default function DataExport({ user = null, onBack = () => {} }) {
  const [exportItem, setExportItem] = useState(null); // the selected EXPORT_ROW, or null
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  };

  const openExport = (row) => { setExportItem(row); setError(''); setLoading(false); };
  const closeExport = () => { if (loading) return; setExportItem(null); };

  // Kick off the server-side export. The function derives the user + email from the
  // JWT, gathers their data, and emails the CSV(s). We never send identity here.
  const runExport = async () => {
    if (!exportItem) return;
    setLoading(true);
    setError('');
    const { error: fnError } = await supabase.functions.invoke('export-data', { body: { type: exportItem.type } });
    setLoading(false);
    if (fnError) {
      let msg = 'Something went wrong. Please try again.';
      try {
        const body = await fnError.context?.json();
        if (body?.error) msg = body.error;
      } catch { /* keep the generic message */ }
      setError(msg);
      return;
    }
    setExportItem(null);
    showToast('Your export is on its way — check your email.');
  };

  return (
    <div style={{ paddingBottom: 100 }}>
      <SettingsPageHeader title="Data & Export" onBack={onBack} />

      <p className="section-title" style={{ padding: '4px 20px 8px', margin: 0 }}>Export your data</p>
      <div className="card-flat" style={{ margin: '0 16px 8px', padding: '0 20px', overflow: 'hidden' }}>
        {EXPORT_ROWS.map((row, i) => (
          <Row key={row.type} title={row.title} desc={row.desc} onClick={() => openExport(row)} isLast={i === EXPORT_ROWS.length - 1} />
        ))}
      </div>

      <p className="section-title" style={{ padding: '20px 20px 8px', margin: 0 }}>Data Management</p>
      <div className="card-flat" style={{ margin: '0 16px', padding: '0 20px', overflow: 'hidden' }}>
        <Row
          title="Delete Account"
          desc="Permanently delete your account and all your associated data. This cannot be undone."
          onClick={() => setDeleteOpen(true)}
          danger
          isLast
        />
      </div>

      {/* Export confirmation popup (centered) */}
      <CenterModal open={!!exportItem} onClose={closeExport}>
        <p style={{ textAlign: 'center', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          {exportItem?.title}
        </p>
        <p style={{ textAlign: 'center', fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
          You will receive an email when your data is ready to download.
        </p>

        {error && (
          <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#EF4444', margin: '0 0 14px' }}>
            {error}
          </p>
        )}

        <button
          onClick={runExport}
          disabled={loading}
          className="btn-primary"
          style={{ marginBottom: 10, opacity: loading ? 0.85 : 1 }}
        >
          {loading ? 'Sending…' : 'Export Data'}
        </button>
        <button
          onClick={closeExport}
          disabled={loading}
          style={{ display: 'block', width: '100%', padding: 14, background: 'transparent', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, cursor: loading ? 'default' : 'pointer' }}
        >
          Cancel
        </button>
      </CenterModal>

      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />

      {toast && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'var(--text-primary)', color: 'var(--card)', padding: '10px 18px', borderRadius: 20, fontSize: 14, fontWeight: 600, zIndex: 800, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', maxWidth: 'calc(100% - 32px)', textAlign: 'center' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
