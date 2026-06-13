import React from 'react';

// Static legal screen. Reached from Profile → Support → Terms of Service.
const EFFECTIVE_DATE = 'June 12, 2026';
const LAST_UPDATED = 'June 13, 2026';
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
// Bulleted list (mirrors the HTML <ul> blocks).
const List = ({ items }) => (
  <ul style={{ margin: '4px 0 6px', paddingLeft: 18 }}>
    {items.map((it, i) => (
      <li key={i} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 3 }}>{it}</li>
    ))}
  </ul>
);
// Emphasized callout (mirrors the HTML .warning-box, e.g. the "Important" health note).
const Callout = ({ label, children }) => (
  <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', margin: '10px 0' }}>
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 6px' }}>{label}</p>
    <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>{children}</p>
  </div>
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
        <P>By creating an account or using Baseline Fitness, you agree to these Terms of Service. If you do not agree, do not use the app.</P>

        <H>Who Can Use Baseline Fitness</H>
        <P>You must be at least 13 years old to use Baseline Fitness. By using the app you confirm you meet this requirement.</P>

        <H>Your Account</H>
        <P>You are responsible for maintaining the security of your account credentials. Do not share your password. You are responsible for all activity that occurs under your account.</P>
        <P>If you believe your account has been compromised, contact us immediately at <Email />.</P>

        <H>What Baseline Fitness Is</H>
        <P>Baseline Fitness is a personal fitness tracking tool designed to help you log food, workouts, and body measurements for your own reference.</P>
        <Callout label="Important">Baseline Fitness is not a medical device and is not a substitute for professional medical, nutritional, or fitness advice. Do not use it to diagnose, treat, or manage any medical condition. Always consult a qualified healthcare professional before making significant changes to your diet or exercise routine. Do not disregard professional medical advice or delay seeking medical attention because of anything in this app.</Callout>

        <H>Your Data</H>
        <P>You own your fitness data. Baseline Studios does not claim any rights to the data you enter into Baseline Fitness. See our Privacy Policy for details on how your data is stored and protected.</P>

        <H>Acceptable Use</H>
        <P>You agree not to:</P>
        <List items={['Use the app for any unlawful purpose', "Attempt to gain unauthorized access to the service or other users' data", 'Reverse engineer, scrape, or abuse the app or its APIs', 'Use automated scripts or bots to interact with the service']} />

        <H>Service Availability</H>
        <P>We aim to keep Baseline Fitness available at all times but do not guarantee uninterrupted access. The service may be temporarily unavailable due to maintenance, updates, or circumstances outside our control.</P>

        <H>Changes to the Service</H>
        <P>We reserve the right to modify, suspend, or discontinue any part of Baseline Fitness at any time. We will make reasonable efforts to notify users of significant changes.</P>

        <H>Disclaimer of Warranties</H>
        <P>Baseline Fitness is provided as-is without warranties of any kind, express or implied. We do not warrant that the app will be error-free or that nutrition data from third party sources is complete or accurate. Food search data comes from the USDA FoodData Central database and is not guaranteed to be accurate or complete.</P>

        <H>Limitation of Liability</H>
        <P>To the maximum extent permitted by law, Baseline Studios shall not be liable for any indirect, incidental, or consequential damages arising from your use of Baseline Fitness.</P>

        <H>Subscriptions and Billing</H>
        <P>Deleting the app from your device does not cancel a subscription. Subscriptions must be cancelled through the Google Play Store.</P>
        <P>Baseline Studios will provide reasonable advance notice to users before any price changes take effect.</P>

        <H>App Store</H>
        <P>These Terms are an agreement between you and Baseline Studios, not with Google Play. Google Play is not responsible for the app, its content, or any claims related to it. Baseline Studios is solely responsible for the app and its services.</P>

        <H>Changes to These Terms</H>
        <P>We may update these Terms of Service from time to time. The effective date at the top of this document will reflect the most recent version. Continued use of the app after changes constitutes acceptance.</P>

        <H>Governing Law</H>
        <P>These Terms are governed by the laws of the State of Georgia, United States.</P>

        <H>Contact</H>
        <P>Questions about these Terms:</P>
        <P><Email /></P>
        <P>Baseline Studios — Georgia, United States</P>
      </div>
    </div>
  );
}
