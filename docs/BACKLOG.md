# Backlog — consolidated audit findings

Source: the four [Fable 5] audit sessions of 2026-07-11 (Security Audit, Codebase Audit 1, Codebase Audit 2, Tips & Review). Reconciled against code + live DB on **2026-07-12**: security fix sessions 1–5 and the food-log fix are deployed; **codebase audits 1 & 2 are not yet started**. Line numbers drift — anchor by function/component name. Full ready-to-paste fix prompts for items 1–12 live in the "[Fable 5 Codebase audit report]" session transcript.

**Suggested run order for what remains:** 1 → 2 → 6 → 7 → 3 → 4 → 5 → 8 → 9 → 10 → 11 → 12 (ISO migration planned-first, needs approval mid-flight). Prompts 1–2 first (they touch the most lines), dead code before perf, memoization (5) after the timer fix (3), a11y anytime, schema migration (12) last.

## ✅ Done (security audit, deployed & verified 2026-07-12)

- [x] **S1 — Account deletion orphans** — `20260712100100_user_id_fk_cascade.sql` puts `on delete cascade` on every per-user table; delete-account now deletes the auth user and cascades (verified live with a throwaway account: 0 rows remained).
- [x] **S2 — Over-broad grants** — `20260712100000_revoke_excess_table_privileges.sql` + event trigger `enforce_api_table_privileges` (`20260712110000`) blocks future over-grants.
- [x] **S4 — delete-account hardened** — scoped CORS, 3/hour rate limit (fail closed, before the password check), current-password re-auth.
- [x] **S5 — Security headers** — enforcing CSP in `vercel.json`, verified live on a real device 2026-07-12.
- [x] **S6 — Internal error leaks** — send-feedback / export-data / food-search now log server-side, return generic.
- [x] **S7 — CSV formula injection** — `csvCell` neutralizes leading `= + - @ \t \r`.
- [x] **S8 — Spoofable reply_to** — JWT-verified email only.
- [x] **S10 — localStorage sign-out cleanup** — `PER_USER_KEYS` + `PER_USER_KEY_PREFIXES` (`prPeriod_`, `defaultMeasurementIds_`), `dashboardHabitsHidden` included.
- [x] **S11 — supabase/.temp untracked** + gitignored.
- [x] **S12 — Rate-limit purge** — `20260712100200_purge_stale_rate_limits.sql`, daily pg_cron.
- [x] **S14 — Email confirmation ON** — confirmed 2026-07-12 (signup returns `confirmation_sent_at`, no session).
- [x] **USDA nginx-400 flake** — food-search v20 retries 400s with 0/300/900/1800 ms backoff; 15/15 live verification.
- [x] **`enforce_api_table_privileges` mutable search_path** — pinned `search_path = public` (stays SECURITY INVOKER by design); migration `20260712120000`, commit `cb9aafa`. Advisor WARN verified cleared + `pg_proc` proconfig confirmed 2026-07-12.
- [x] **delete-account 500 path leaked `deleteError.message`** — now logged server-side, generic message returned; commit `c38695e`, deployed as v5.
- [x] **Final pre-launch audit ran 2026-07-12** — git-history secret scan clean (only the publishable anon key was ever committed; no rotation needed); session/token lifecycle sound; live advisors show nothing new beyond S3; Edge Functions/RLS/grants verified against conventions. New findings filed below (Legal / compliance + Final-audit sections).
- [x] **Broken service worker removed** — `public/service-worker.js` precached dev-only asset paths, so it 404'd and never installed in production; the "Update available" banner it fed was dead code. Deleted the file + banner, replaced registration with an unregister sweep for lingering dev-device workers. A real PWA update/offline flow is a future feature (spec first — see Low / polish).
- [x] **`npm audit fix` (non-breaking) applied 2026-07-12** — 30 → 28 advisories; every remaining one is dev/build-only and pinned by react-scripts 5 (see CRA migration item below). Runtime deps (react, supabase-js, zxing, dnd-kit) have zero advisories.
- [x] **Public legal-page URLs live** — `privacy-policy.html` / `terms-of-service.html` return 200 on production, satisfying Google Play's public-policy-URL requirement (was finding 7 of the 2026-07-11 legal audit).

## Security — still open

- [ ] **S3 — Server-side password policy.** Leaked-password (HIBP) protection still disabled (live advisor WARN, 2026-07-12); minimum length/character classes should be set in Supabase Auth settings to match `passwordPolicy.js`. Likely needs the Pro upgrade.
- [ ] **S9 — Signup enumeration.** "An account already exists with that email" still confirms registration status (AuthScreen). Deliberate-UX decision pending: keep, or always show "Check your email".
- [ ] **S13 — OpenFoodFacts direct-from-browser.** Barcode lookups still `fetch` openfoodfacts.org directly (user IP + scanned products to a third party, no timeout). Decide: proxy behind a rate-limited Edge Function, or accept + add `AbortSignal.timeout` + document in privacy policy. (Its origins are already in the CSP — keep CSP in sync with the decision.)

## Legal / compliance (2026-07-11 legal audit, filed 2026-07-12 — blocks Play submission / EU exposure)

Source: the "[Fable 5 Privacy and Terms of service]" session. Ready-to-paste fix prompts live in `docs/PROMPTS.md` § Final-audit fix prompts. Not legal advice — counsel review before open testing.

- [ ] **L1 — Legal document content pass** (PrivacyPolicy.js + TermsOfService.js): GDPR legal bases + Art. 9 explicit-consent language for health data, international-transfer disclosure, expanded rights (restrict/object/withdraw/complain), California section, EU age-of-digital-consent, notice-before-effect change clauses; ToS adds termination, personal-injury liability carve-out, subscriptions-handled-by-Play wording, severability/entire-agreement.
- [ ] **L2 — Explicit health-data consent step at signup** (AuthScreen) — GDPR Art. 9 requires consent separate from ToS acceptance; biggest EU exposure item.
- [ ] **L3 — Age-gate hardening** — block same-session DOB retry after an under-13 rejection; confirm abandoned/rejected signups leave no DOB in auth metadata.
- [ ] **L4 — Web-based account-deletion request path** — Play requires deletion without reinstalling the app (URL declared in the Data safety form); in-app Danger Zone alone doesn't satisfy it.
- [ ] **L5 — Play Data safety / Health Apps declarations** must match the policy; the "we do not collect device identifiers" claim conflicts with Supabase/Vercel server logs (IP/user-agent) — disclose or verify non-retention.
- [ ] **L6 — Legal content now lives in two places** (in-app components + `public/*.html`) — keep them in sync; consider generating one from the other.

## Final pre-launch audit additions (2026-07-12)

- [ ] **A1 — Migrate off Create React App** (post-launch). react-scripts 5 is unmaintained and pins 28 dev/build-only vulnerable transitive deps (nth-check, webpack-dev-server, postcss, serialize-javascript…) that `npm audit fix` cannot touch. Vite is the natural target; none of the advisories ship in the production bundle, so this is debt, not exposure.
- [ ] **A2 — RLS initplan optimization**: every policy re-evaluates `auth.uid()` per row (live advisor WARN on all 17 tables). Rewrite `auth.uid() = user_id` → `(select auth.uid()) = user_id`; zero behavior change, compounds with item 4/12 wins.
- [ ] **A3 — Index the FK columns**: no covering index on any `user_id` FK (nor `routine_id`/`session_id`/`measurement_id`) — advisor INFO since the 2026-07-12 cascade-FK migration. Every app query filters by `user_id` and delete-account cascades walk these FKs.
- [ ] **A4 — Revoke anon CRUD on the 14 pre-existing tables** — live grants still give `anon` full CRUD everywhere except `profiles` (RLS blocks it, so defense-in-depth only), contradicting the CLAUDE.md table template. One revoke migration aligns live state with intent.
- [ ] **A5 — CSP hardening** in `vercel.json`: add `base-uri 'self'`, `form-action 'self'`, `object-src 'none'` (`base-uri` is NOT covered by default-src). Add an explicit HSTS header if/when a custom domain replaces `*.vercel.app`.

## Launch blockers (codebase audit — not started)

- [ ] **1 — Silent write failures (~40 sites).** Unchecked writes, `if (error) return;` swallows, fire-and-forget writes across FoodLog, Workouts, Measurements, Dashboard, AuthScreen, BodyGoals, DailyHabits, HabitsWidget, ExerciseDatabase, PersonalRecordDetail. Standard: toast + rollback/reload (reference: `DailyHabits.deleteHabit`, `AccountInformation.saveProfile`). Worst: `handleAddChecked` (Add N Foods); undo-toast deferred deletes never verified.
- [ ] **12 — ISO date migration.** `food_entries.date` / `workout_sessions.date` store `toLocaleDateString()`. Backfill to `YYYY-MM-DD`, write ISO on insert, parse local-midnight, keep dual-format tolerance during transition. Unlocks SQL date filtering (removes forced full-table fetches in Nutrition/Dashboard/compareSources). Plan first; Safe Deployment Order; approval before touching the DB. Gets more expensive with every production row written.

## High value (codebase audit — not started)

- [ ] **2 — Read error handling.** ~35 reads ignore `error`, rendering failures as empty data. Keep existing state on failure.
- [ ] **3 — Workout timer perf.** `workoutSeconds` (1s) and `restRemaining` (250ms) as App-level state → whole-tree re-render 1–4×/sec + per-second localStorage write. Tick in leaf components from timestamps; preserve recovery/pause/resume.
- [ ] **4 — Query efficiency.** Dashboard fetches `workout_sessions` twice per load; measurement-widget N+1; unbounded fetches in `loadRoutines` (all `session_exercises` ever), PersonalRecords, compareSources; reorder saves one UPDATE per row (batch upsert); Add-Food sheet refetches 4 lists on every open (cache until mutation).
- [ ] **5 — Memoization.** Zero useMemo/useCallback/React.memo. Targeted: FoodLog totals/filters per keystroke, Measurements detail groupings, Dashboard widgetMap, App.js callbacks, memo MacroCircle/LoggingExerciseCard/RestRow/chart components. After item 3.
- [ ] **8/9/10 — Accessibility.** Clickable divs → real buttons/role="button" (food rows, workout bar, logging headers, picker rows, tiles); aria-labels on ~30 icon-only buttons (set-complete toggle most important) and placeholder-only inputs; touch targets <44px (22px selection circles, 26px set toggle, 28px steppers, compare-pill × span).

## Medium

- [ ] **6 — Dead code.** App.js `date`/`changeDate`; `web-vitals` + reportWebVitals.js (never executes); stale App.test.js; unreachable `getHeaderTitle` entries; @testing-library/* → devDependencies; Subscription stub buttons tappable but inert.
- [ ] **7 — routineMeta duplication.** Consolidate last-performed/avg-duration aggregation between `routineMeta.js` and `Workouts.loadRoutines` (share the math, not extra queries).
- [ ] **11 — Bundle.** Lazy-load Profile subscreens/legal/DailyHabits/Measurements; split ExerciseDatabase data from component (kills the circular-import hazard); get @dnd-kit (~35–45KB) out of the initial chunk.
- [ ] **Transactional writes.** `confirmFinishWorkout` can orphan an empty session on partial failure (retry mints new id); ExerciseDatabase rename cascade unchecked across 3 tables; duplicateRoutine can create exercise-less copies. Atomic RPCs or per-step checks with rollback.
- [ ] **Refactor: split FoodLog.js and Workouts.js** (frozen per CLAUDE.md). Extraction-only sessions, build+commit per extraction. Do before launch — every future fix gets cheaper.
- [ ] **Component APIs**: FoodDetailView 24 props (`edit` vs `editing`; origin flags → one `origin` enum); WorkoutHome pure pass-through of 15 props; rest-timer quintet drills 5 layers (context/hook); Profile's 11 `onOpenX` → `onNavigate(screenId)`; pass `goals` object not 4 scalars.
- [ ] **Tests** — priority order in CLAUDE.md § Testing (foodMath first).

## Low / polish

- [ ] **PWA update/offline flow, done properly** (optional future feature — the broken v1 was removed 2026-07-12). Spec first: hashed-asset precache generated at build time (e.g. Workbox via the post-CRA toolchain), versioned cache invalidation, update toast driven by a real `waiting` worker. Don't hand-write asset lists again.
- [ ] **Color cleanup**: two reds (`#EF4444`/`#ff4444`), three greens, macroColors.js bypassed inline in FoodLog/Dashboard, dark-mode breakers (`#101624` AuthScreen, `#fff` Start Workout button, `#EFF6FF` Profile pill), duplicated `MEAS_COLORS`/`CHART_COLORS` arrays, Tailwind-blue boxShadow. Introduce `--danger`/`--success` tokens.
- [ ] **Toast consolidation**: Profile/Subscription/DataExport local toasts → App-level showToast.
- [ ] **Delete UX**: `deleteMeasurement` wipes all history from one tap, no confirm/undo; bulk deletes less protected than single deletes.
- [ ] **Copy pass**: raw Supabase errors in AuthScreen (×3) and scanner `Error: {scannerError}`; "Uh oh!"/Yes/No resume modal; "That was a quick one!" on destructive discard; "Let's crush your goals today."; "Elevate your fitness journey."; Sign In/Sign up casing; `…` vs `...`; "+0 from last week" with no prior week; "0 entries" empty state; dead-end Coming soon rows + display-only $7.99 Subscription screen.
- [ ] **Units consistency**: hardcoded `lb`/`lbs` in history/WorkoutHome vs metricSystem-aware logging modal; casing drift (Kg/kg/Lbs/lbs/lb).
- [ ] **food-search called via raw fetch with hardcoded project URL** (FoodLog.js top) → `supabase.functions.invoke`; hardcoded redirect URL in AuthScreen.
- [ ] **Documentation gaps**: PersonalRecordDetail, ExerciseDatabase (lazy-binding workaround unflagged inline), AddHabitPage, AddWidgetSheet, DailyHabits, ChangeEmail/ChangePassword re-auth rationale, UndoToast timing contract, App.js profile-tab ternary, Workouts lastSessionMap/sort-trick/closure-capture, WorkoutHome loadWeekStats, FoodLog onAdd five-path dispatch.
