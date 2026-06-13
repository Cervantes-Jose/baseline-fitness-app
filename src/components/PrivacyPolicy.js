import React from 'react';

// Static legal screen. Reached from Profile → Support → Privacy Policy.
const EFFECTIVE_DATE = 'June 12, 2026';
const LAST_UPDATED = 'June 13, 2026';
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
// Sub-label inside a section (mirrors the HTML card titles, e.g. "Account Information").
const Sub = ({ children }) => (
  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '14px 0 4px' }}>{children}</p>
);
// Bulleted list (mirrors the HTML <ul> blocks).
const List = ({ items }) => (
  <ul style={{ margin: '4px 0 6px', paddingLeft: 18 }}>
    {items.map((it, i) => (
      <li key={i} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 3 }}>{it}</li>
    ))}
  </ul>
);
// External link shown under a third-party service (mirrors .third-party-link).
const Link = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', fontSize: 13, color: 'var(--accent)', textDecoration: 'none', margin: '0 0 6px' }}>{children}</a>
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

        <H first>Who We Are</H>
        <P>Baseline Fitness is operated by Baseline Studios, based in Georgia, United States. If you have questions about this Privacy Policy, contact us at <Email />.</P>

        <H>What Data We Collect</H>
        <P>When you create an account and use Baseline Fitness, we collect only what you enter yourself.</P>
        <Sub>Account Information</Sub>
        <List items={['Email address', 'Full name', 'Gender, date of birth, and height (optional)']} />
        <Sub>Fitness and Health Data</Sub>
        <List items={['Food entries including calories, macros, and meal times', 'Workout routines, exercises, sets, reps, and weight logged', 'Body measurements including weight, body fat, and custom measurements', 'Nutrition and body composition goals you set']} />
        <Sub>We do not collect</Sub>
        <List items={['Location data', 'Device identifiers', 'Advertising identifiers', 'Samsung Health or Apple Health data']} />

        <H>How We Use Your Data</H>
        <P>We use your data solely to provide the Baseline Fitness service to you.</P>
        <List items={['To display your food, workout, and measurement history', 'To calculate progress toward your goals', 'To sync your data across devices when you sign in', 'To send password reset emails when requested']} />
        <P>We do not use your data for advertising, marketing, or any purpose beyond operating the app. We do not sell your data to anyone.</P>

        <H>How Your Data Is Stored</H>
        <P>Your data is stored securely using Supabase, a PostgreSQL database platform. All data is protected by Row Level Security — your data is only accessible to your account and cannot be accessed by other users. Supabase stores data on servers in the United States.</P>

        <H>Security</H>
        <P>Baseline Studios implements technical and administrative measures designed to protect your personal data against unauthorized access, disclosure, alteration, and destruction. No security system is perfect, however, and we cannot guarantee absolute security.</P>
        <P>We also cannot guarantee the security of your data if you are running an outdated version of the app, so we recommend keeping the app updated to the latest release.</P>

        <H>Third Party Services</H>
        <P>Baseline Fitness uses the following third party services to operate.</P>
        <Sub>Supabase</Sub>
        <P>Database and authentication. Stores your account and fitness data securely.</P>
        <Link href="https://supabase.com/privacy">supabase.com/privacy</Link>
        <Sub>USDA FoodData Central</Sub>
        <P>Food nutrition data. When you search for a food, your search query is routed through our secure server. No personal information is sent to USDA. Nutrition information is sourced from the USDA FoodData Central database, and Baseline Studios does not guarantee its accuracy or completeness.</P>
        <Sub>Vercel</Sub>
        <P>App hosting. Serves the application.</P>
        <Link href="https://vercel.com/legal/privacy-policy">vercel.com/legal/privacy-policy</Link>
        <Sub>Google Play Store</Sub>
        <P>App distribution. Subject to Google's privacy policy.</P>

        <H>Data Retention</H>
        <P>Your data is retained as long as your account exists. If you delete your account, all of your data is permanently and immediately deleted — food entries, workout history, measurements, goals, and account information. This cannot be undone.</P>
        <P>In the event of a data breach affecting your personal information, we will notify affected users in accordance with applicable law.</P>

        <H>Your Rights</H>
        <List items={['Access your data at any time within the app', 'Export your data from Settings', 'Delete your account and all data from Settings → Account Information → Danger Zone', 'Correct any information by editing it directly in the app']} />

        <H>Children's Privacy</H>
        <P>Baseline Fitness is not intended for users under the age of 13. We do not knowingly collect data from children under 13. We implement a technical age verification step at signup to prevent users under 13 from creating an account. If you believe a child has provided us with personal information, contact us and we will delete it.</P>

        <H>Changes to This Policy</H>
        <P>If we make material changes to this Privacy Policy we will update the effective date at the top of this document. Continued use of the app after changes constitutes acceptance.</P>

        <H>Contact</H>
        <P>For privacy questions or concerns:</P>
        <P><Email /></P>
        <P>Baseline Studios — Georgia, United States</P>
      </div>
    </div>
  );
}
