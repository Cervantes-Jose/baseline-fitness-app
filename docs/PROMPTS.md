# Prompt Playbook

Templates and habits distilled from the [Fable 5 Tips and Review] session (2026-07-11). These are for **me** (Jose) when prompting Claude Code — not instructions for Claude.

## The seven habits that matter most

1. **Stop pixel-tweaking through the model.** Ask for the knob: "Tell me the exact file and line where the gap value lives, set it to 16px, and I'll fine-tune with hot reload." Batch remaining nudges into one numbered message. Use a cheaper/faster model for polish sessions; save the big model for features, bugs, schema, security.
2. **Every UI prompt names three coordinates**: Screen (+ component file), Element, Change (with a number or an anchor: "identical to X on the Y screen"). Use the element selector/screenshot annotation.
3. **Second failed fix = root-cause mode** (template below). Never say "fix it" a third time.
4. **Commit per verified change.** "commit" is a complete prompt — Claude writes the message from the diff.
5. **Big features use the spec template** below. Fuzzy specs get the interview pattern first.
6. **Multi-session work gets a plan file** in `docs/plans/<feature>.md` with phase checkboxes. Next session: "Read docs/plans/x.md. Phase 2 done. Start phase 3."
7. **Fresh session per task.** New feature → new session. Unrelated topic → /clear.

## Templates

### Bug report
```
BUG: [screen + component file if known]
Steps: 1) ... 2) ... 3) ...
Expected: [with numbers: "180 cal at 50g"]
Actual: [what happens instead]
Started after: [commit/feature if known]
Diagnose first and explain the root cause. Don't change code until I confirm.
```

### UI change
```
Screen: [name] ([File.js])
Element: [what, precisely]
Change: [number or anchor: "same as X on Y screen"]
Targeted edit only. If adjacent code should also change, flag it — don't change it.
```

### Repeat-failure escalation (after any fix fails twice)
```
The [symptom] fix didn't work — this is attempt N. Do NOT write a fix yet.
1. Read [File.js] and list every code path that could cause [symptom].
2. List each previous fix attempt from git history and why it didn't work.
3. Add temporary console.log instrumentation to the relevant handlers.
   I'll reproduce on my phone and paste the console output back.
4. Only propose a fix after we've seen the logs.
```

### Feature spec
```
This is a large feature. Make decisions independently based on existing
patterns. Don't ask clarifying questions mid-build — make a reasonable choice
and flag it at the end. Only stop if a schema change is needed beyond what
this prompt defines.

GOAL: [one sentence — what the user can do when this ships]

SCHEMA (design and apply first):
- New table X — columns... follow the CLAUDE.md table-creation steps exactly
  (cascade FK, CRUD-only grants, RLS).

SCREENS / BEHAVIOR:
- [screen 1]: ... (anchor: "identical to the hour picker pattern")
- [screen 2]: ...

OUT OF SCOPE: [what NOT to build — future session will add ...]

PHASES: schema → phase 1 → phase 2.
CI=true npm run build after each phase. Commit after each phase passes.
Write the plan to docs/plans/<feature>.md and check phases off as they land.
```

### Interview pattern (fuzzy spec)
```
Before writing any code, ask me every question you need to make this spec
unambiguous. Then restate the full spec back to me for approval.
```

### Refactor / extraction
```
Refactor session — no behavior changes, no styling changes, extraction only.
Split [File.js] into: [list target files and what moves].
After each extraction: CI=true npm run build, then commit that extraction alone.
List every extracted component and its new file at the end.
```

### Audit / investigation
```
Do not change anything. [Search for X / trace Y]. Report every file and line,
grouped by [category], ranked by severity.
```

### Schema / security work
```
[The change.] Design the security model first, before any code.
Then run the RLS Audit Scenarios from CLAUDE.md against this change and
report each answer explicitly. Present migration SQL for approval before
touching the database.
```

## Final-audit fix prompts (2026-07-12) — ready to paste, one session each

Each prompt maps to a BACKLOG.md item (L* = Legal / compliance, A* = Final-audit additions). Run them in separate sessions; commit per verified change.

### A2 — RLS initplan optimization (+ A3 FK indexes, same session is fine)

```
Performance migration, no behavior change. Two parts, one migration file each,
following the Schema/security template: present the SQL for approval before
touching the database, and verify live state after (pg_policies / pg_indexes),
not just the push report.

1. Rewrite every RLS policy in public (17 tables) from `auth.uid() = user_id`
   to `(select auth.uid()) = user_id` (both USING and WITH CHECK; habit_logs
   also has an EXISTS subquery referencing auth.uid() — wrap that one too).
   Use ALTER POLICY, keep policy names identical.
2. Add covering indexes for every FK the Supabase performance advisor flags:
   user_id on custom_exercises, custom_foods, exercises, favorite_foods,
   food_entries, habit_logs, meals, measurement_entries, measurements,
   routines, session_exercises, user_goals, workout_sessions; plus
   exercises.routine_id, measurement_entries.measurement_id,
   session_exercises.session_id, workout_sessions.routine_id.
   Plain btree, `if not exists`, named idx_<table>_<column>.

After applying: run the Supabase performance advisor and confirm the
auth_rls_initplan WARNs and unindexed_foreign_keys INFOs are gone. Then run
the RLS Audit Scenarios from CLAUDE.md and report each answer — the policy
rewrite must not change who can see what.
```

### A4 — Revoke anon CRUD (grants ↔ intent alignment)

```
Security alignment migration, no app code changes. Live grants still give the
anon role SELECT/INSERT/UPDATE/DELETE on every public table except profiles;
the CLAUDE.md table template says per-user tables grant only authenticated +
service_role (RLS already blocks anon, this is defense-in-depth).

Write one migration that revokes all remaining anon privileges on every public
table, plus `alter default privileges ... revoke ... from anon` so future
tables don't regain them. api_rate_limits already grants anon nothing.

Present the SQL for approval first. After applying, verify via
information_schema.role_table_grants that anon appears nowhere, and confirm in
the app (I'll test signed-out and signed-in on prod preview) that nothing
broke — the app never queries unauthenticated, so no change is expected.
```

### A5 — CSP hardening in vercel.json

```
Targeted edit to vercel.json only (strict JSON — no comments; validate with
JSON.parse before committing). In the Content-Security-Policy header value,
append: base-uri 'self'; form-action 'self'; object-src 'none'.
Change nothing else in the policy. Explain what each directive blocks, then
CI=true npm run build (should be untouched) and I'll verify the deploy: cold
load, login, food search, barcode scan must stay clean per the CLAUDE.md
Security Headers section.
```

### A1 — Migrate off Create React App (post-launch, own plan file)

```
Multi-session migration — write docs/plans/cra-to-vite.md first with phased
checkboxes and STOP for my approval before changing anything. Goal: replace
react-scripts 5 with Vite while keeping CRA conventions working: CI-style
warnings-as-errors build, Jest (or Vitest with jest-dom) for existing tests,
process.env.REACT_APP_* envs (map to import.meta.env with a shim, don't mass-
rename), public/ static files, the dynamic import('@zxing/library') split
point, and identical Vercel output. Phases: 1) tooling swap building locally,
2) env/test migration, 3) deploy to a Vercel preview and verify the CLAUDE.md
production checks, 4) cutover + delete react-scripts. npm audit should drop
to ~0 — report the before/after. Commit per phase.
```

### L1 — Legal document content pass

```
Update the legal documents in my React fitness app (Create React App + Supabase). Work ONLY in
src/components/PrivacyPolicy.js and src/components/TermsOfService.js, using the existing
component helpers in each file (H, P, Sub, List, Link, Callout, Email). Make targeted edits —
do not rewrite the files, do not touch any other file, do not change the styling/JSX patterns.
Keep the existing plain-English tone; these are read on a 480px phone screen. Bump LAST_UPDATED
in both files to today's date; leave EFFECTIVE_DATE alone.

PRIVACY POLICY (src/components/PrivacyPolicy.js) — add/modify these sections:

1. New section "Legal Bases for Processing (EU/EEA/UK Users)" after "How We Use Your Data":
   - Contract performance: account info, providing the service.
   - Explicit consent (GDPR Art. 9): all fitness and health data (food logs, body measurements,
     body fat, goals), collected via a consent step at signup; consent can be withdrawn at any
     time by deleting the account or contacting us.
   - Legitimate interest: service security and abuse prevention.
   - State that we do no automated decision-making or profiling with legal effects.
2. In "How Your Data Is Stored": add an "International Transfers" paragraph — data is processed
   in the United States; for EU/EEA/UK users, transfers rely on our processors' safeguards
   (EU-U.S. Data Privacy Framework and/or Standard Contractual Clauses via Supabase and Vercel).
3. In "What Data We Collect": soften the "We do not collect" list — remove or qualify "Device
   identifiers" with a note that our hosting providers process IP addresses and browser
   information in server logs for security purposes.
4. Expand "Your Rights": add restriction of processing, objection, withdrawal of consent, data
   portability, and (for EU/EEA/UK users) the right to lodge a complaint with their local
   supervisory authority. Keep the existing in-app bullets.
5. New section "California Privacy Rights" before "Children's Privacy": categories collected
   (identifiers, health data — treated as sensitive personal information), we do not sell or
   share personal information as defined by the CCPA/CPRA, rights to know/delete/correct/limit,
   non-discrimination, requests via the contact email with identity verification, response
   within 45 days.
6. "Children's Privacy": add that EU/EEA users must meet their country's age of digital consent
   (up to 16 in some countries) and that we do not offer the service to EU users below that age.
7. "Changes to This Policy": replace "continued use constitutes acceptance" with: material
   changes will be notified in-app before taking effect, and where processing relies on consent
   we will ask for renewed consent.

TERMS OF SERVICE (src/components/TermsOfService.js) — add/modify:

8. "Who Can Use": add the EU age-of-digital-consent sentence (mirror item 6).
9. New "Termination" section after "Acceptable Use": we may suspend or terminate accounts that
   violate these Terms; on termination your data is deleted per the Privacy Policy; you may
   delete your account at any time in Settings.
10. "Limitation of Liability": add a carve-out — nothing in these Terms excludes or limits
    liability for death or personal injury caused by negligence, fraud, or any liability that
    cannot be excluded under applicable law; consumers in the EU/UK retain their mandatory
    statutory rights.
11. "Subscriptions and Billing": mark clearly that subscriptions are handled entirely by Google
    Play (billing, renewal, refunds per Google Play's policies); we never receive or store your
    payment card details. If no subscription is currently offered, say the section applies only
    if/when paid features launch.
12. "Governing Law": append that EU/UK consumers additionally benefit from mandatory provisions
    of their local law.
13. Add short "Severability" and "Entire Agreement" sentences before "Contact".
14. "Changes to These Terms": same notice-before-effect language as item 7.

ALSO (added 2026-07-12): the same legal text is now published as static pages at
public/privacy-policy.html and public/terms-of-service.html. Apply the equivalent content
changes there too so the public and in-app versions stay in sync (BACKLOG L6).

When done: run CI=true npm run build to confirm it compiles, and summarize exactly which
sections changed in each file.
```

### L2 — Health-data consent step at signup

```
Feature, small but legally load-bearing (GDPR Art. 9). In AuthScreen.js signup
only: add a required, unchecked-by-default checkbox above the Create Account
button — label: "I consent to Baseline Fitness processing my health and
fitness data (food, workouts, measurements) to provide the service." with a
link opening the existing Privacy Policy sheet. Block submit until checked
(same disabled pattern as the existing age gate). Record consent server-side:
store consented_at timestamp — propose where (user_metadata at signUp vs a
profiles column) with trade-offs BEFORE coding; if profiles, follow the
CLAUDE.md table rules for the column. Sentence case, neutral tone, no
pre-ticking. CI=true npm run build when done.
```

### L3 — Age-gate hardening

```
Two targeted changes in AuthScreen.js signup, nothing else:
1. After an under-13 DOB rejection, block retrying with a different DOB for
   the rest of the session (in-memory flag, not localStorage — explain why in
   a comment: FTC COPPA guidance against gates that invite falsification).
   Show the neutral copy: "You must be at least 13 to use Baseline Fitness."
2. Trace what happens to the DOB when signup fails or is abandoned before
   email confirmation — report whether any DOB lands in auth user_metadata or
   profiles for unconfirmed accounts, and if so propose the fix before coding.
```

### L4 — Web account-deletion request page (Play requirement)

```
Google Play requires an account-deletion path that works without reinstalling
the app. Build public/delete-account.html as a static page matching
privacy-policy.html's styling: explains data deleted on account deletion,
primary path "sign in → Profile → Danger Zone", and a mailto fallback to the
support address for users who can't sign in, stating identity verification is
required and deletion completes within 30 days. No JS, no forms, no new
endpoints — static content only. It must load with the current CSP. I'll
declare the URL in the Play Data safety form myself.
```

### L5 — Play declarations consistency (manual, with one code-audit assist)

```
Audit only, no changes: list every piece of data the app actually collects or
that our processors log (walk AuthScreen signup fields, profiles columns, all
17 tables, Supabase/Vercel server logs, the OpenFoodFacts direct fetch
exposing user IP + scanned barcodes). Output a table formatted to match
Google Play's Data safety form categories (Collected/Shared/Processed
ephemerally, purpose, optional/required) so I can fill the form and the
Health Apps declaration without guessing. Flag any mismatch with what the
Privacy Policy currently claims.
```

## Small habits

- Approvals against old options: restate the referent — "Apply fix 2 (the serving-size snapshot one)", not "2".
- After any fix: "list every file you changed and the specific behavior difference."
- After schema work: "query pg_proc to confirm the live signature."
- When an explanation smells wrong: "Show me the exact code path that causes this before you change anything."
- Don't resend a prompt that seems stalled — check whether the first is still running (double git pushes have happened).
- Small tweaks batch together in one session; anything needing a schema change, a new file, or a new interaction pattern gets its own session and the feature template.
