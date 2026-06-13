import React from 'react';

// Static legal screen. Reached from Profile → Support → Terms of Service.
const EFFECTIVE_DATE = 'June 12, 2026';
const LAST_UPDATED = 'June 12, 2026';
const CONTACT_EMAIL = 'baselinestudios.dev@gmail.com';

const H = ({ children, first }) => (
  <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: first ? '0 0 6px' : '20px 0 6px' }}>{children}</h2>
);
const P = ({ children }) => (
  <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 6px' }}>{children}</p>
);
const Email = () => (
  <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{CONTACT_EMAIL}</a>
);

export default function TermsOfService({ onBack = () => {}, hideBack = false }) {
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

        <H first>Acceptance of Terms</H>
        <P>By creating an account or using this fitness app, you agree to these Terms of Service. If you do not agree, please do not use the app.</P>

        <H>The Service</H>
        <P>The app lets you log food, track workouts and body measurements, and set personal goals. We may add, change, or remove features over time.</P>

        <H>Not Medical Advice</H>
        <P>The app is provided for general fitness and informational purposes only and is not a substitute for professional medical advice. Consult a qualified healthcare provider before starting any diet or exercise program. Nutrition values shown are estimates and may not be accurate.</P>

        <H>Your Account</H>
        <P>You are responsible for keeping your login credentials secure and for all activity under your account. You must provide accurate information and be old enough to form a binding agreement in your jurisdiction.</P>

        <H>Acceptable Use</H>
        <P>You agree not to misuse the app, attempt to disrupt or abuse its services, access data that is not yours, or use it for any unlawful purpose.</P>

        <H>Intellectual Property</H>
        <P>The app and its content (excluding the data you enter) are owned by us and protected by applicable laws. You retain ownership of the data you create.</P>

        <H>Disclaimers &amp; Limitation of Liability</H>
        <P>The app is provided "as is" without warranties of any kind. To the fullest extent permitted by law, we are not liable for any damages arising from your use of the app.</P>

        <H>Termination</H>
        <P>You may stop using the app and delete your account at any time. We may suspend or terminate access if these Terms are violated.</P>

        <H>Changes to These Terms</H>
        <P>We may update these Terms from time to time. Material changes will be reflected by the "Last updated" date above; continued use of the app means you accept the updated Terms.</P>

        <H>Contact</H>
        <P>If you have questions about these Terms, contact us at <Email />.</P>
      </div>
    </div>
  );
}
