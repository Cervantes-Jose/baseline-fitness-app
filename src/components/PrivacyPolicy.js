import React from 'react';

// Static legal screen. Reached from Profile → Support → Privacy Policy.
const EFFECTIVE_DATE = 'June 12, 2026';
const LAST_UPDATED = 'June 12, 2026';
const CONTACT_EMAIL = 'baselinestudios.dev@gmail.com';

const H = ({ children, first }) => (
  <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: first ? '0 0 6px' : '22px 0 6px' }}>{children}</h2>
);
const P = ({ children }) => (
  <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 6px' }}>{children}</p>
);
const Email = () => (
  <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{CONTACT_EMAIL}</a>
);

export default function PrivacyPolicy({ onBack = () => {}, hideBack = false }) {
  return (
    <div style={{ paddingTop: 4, paddingBottom: 100 }}>
      {/* Back to Profile — hidden when shown inside the signup bottom sheet */}
      {!hideBack && (
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: '4px 12px 8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Profile
        </button>
      )}

      <div className="card-flat" style={{ margin: '0 16px', padding: 20 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 2px' }}>Effective date: {EFFECTIVE_DATE}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>Last updated: {LAST_UPDATED}</p>

        <H first>Overview</H>
        <P>This Privacy Policy explains what information this fitness app collects, how it is used, and the choices you have. By using the app you agree to the practices described here.</P>

        <H>Information We Collect</H>
        <P>When you create an account we store your email address and the profile details you choose to provide, such as your name, gender, date of birth, and height. As you use the app we store the data you enter: food logs, custom foods and meals, workouts and routines, body measurements, and your goals.</P>

        <H>How We Use Your Information</H>
        <P>Your information is used solely to provide the app's features — saving your logs, showing your progress, and syncing your data across sessions. We do not sell your personal information or use it for advertising.</P>

        <H>Third-Party Services</H>
        <P>Food search results are provided by the U.S. Department of Agriculture's FoodData Central, and barcode lookups use the Open Food Facts database. Only your search term or scanned barcode is sent to these services — never your account or personal data.</P>

        <H>Data Storage &amp; Security</H>
        <P>Your data is stored with our hosting provider (Supabase) and is protected by row-level security so that you can only access your own records. No method of storage is completely secure, but we take reasonable measures to protect your information.</P>

        <H>Your Choices &amp; Account Deletion</H>
        <P>You can view and edit your profile and logged data at any time. You may permanently delete your account and all associated data from Profile → Account Information → Delete Account. This action is immediate and cannot be undone.</P>

        <H>Changes to This Policy</H>
        <P>We may update this policy from time to time. Material changes will be reflected by the "Last updated" date above.</P>

        <H>Contact</H>
        <P>If you have questions about this Privacy Policy, contact us at <Email />.</P>
      </div>
    </div>
  );
}
