# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

App: **Baseline Fitness** — mobile-first fitness tracker (food, workouts, measurements, habits). Brand voice reference: *"Track everything. Know your baseline."* — clean, minimal, neutral.

Repo: `https://github.com/Cervantes-Jose/baseline-fitness-app` · Production: `https://fitness-app-ebon-six.vercel.app`

## Commands

```bash
npm start        # dev server (localhost:3000)
npm run build    # production build
npm test         # Jest/React Testing Library (watch mode)
npm test -- --watchAll=false  # single run
```

## Verifying changes (do not deviate)

- **Never use the Claude Preview tool** (or any browser-automation/preview MCP). I run `npm start` locally and verify UI changes myself in the browser — do not start, attach to, or screenshot a preview server.
- To check for compile/lint errors, run `npm run build` only when needed (e.g. before saying a change is done, or when a change might break the build). CI treats warnings as errors, so prefer `CI=true npm run build`.
- Describe what changed and what to look at; leave the visual confirmation to me.
- Since you can't see the app, when a bug can't be diagnosed from code alone: add **temporary console.log instrumentation**, tell me what to do on my phone/browser, and I'll paste the output back. One instrumented round-trip beats several blind guesses.

## Session Workflow

1. **Commit per verified change**, not per session. After I confirm a change works, offer to commit it alone. Never bundle unrelated changes into one commit — it breaks `git revert`/`git bisect`.
2. **Second failed fix = stop fixing.** If a fix for the same symptom has failed before, switch to root-cause mode: read the relevant code, list what previous attempts changed and why they didn't work, add instrumentation, and only propose a fix once the cause is proven. Never re-guess.
3. **Multi-session features get a plan file** in `docs/plans/<feature>.md` with phased checkboxes. Mark phases complete as they land. Next session resumes from the file, not from memory.
4. **Targeted edits only — but flag adjacent problems.** "Don't touch anything else" doesn't mean stay silent: if you notice nearby duplication, a bug, or debt, flag it (don't change it). Track bigger items in `docs/BACKLOG.md`.
5. **No feature creep** — if a new idea comes up mid-session, note it in `docs/BACKLOG.md` instead of building it.
6. **Ask before building** — confirm requirements before writing code for any new feature. For fuzzy specs, interview me first, then restate the full spec for approval before coding.

## Coding Standards (follow every session without being reminded)

1. **Never rewrite whole files** — make targeted edits to specific sections only
2. **Always use separate component files** — never add new major sections to App.js directly
3. **Components stay under ~300 lines.** `FoodLog.js` (~2,500 lines) and `Workouts.js` (~2,000) are **frozen**: never add new features directly to them — extract the section you're touching into its own file first. Refactor sessions are extraction-only: no behavior changes, build + commit per extraction.
4. **Explain what changed** after every code update — don't just paste code blindly
5. **Flag technical debt** — if something is a shortcut that needs fixing later, say so explicitly
6. **Mobile first** — always design for phone screen size (max-width 480px) before desktop
7. **Never remove console.log statements silently** — flag them and ask before removing
8. **Comment the non-obvious**: date/timezone arithmetic, scaling math, race guards (refs/nonces/abort controllers), cross-file invariants, and workaround code get a comment explaining *why*. Reference bar: `foodMath.js`, `offlineQueue.js`, `trendMath.js`.
9. **Component APIs**: keep props at ≤7. Prefer one object over parallel scalars (pass `goals`, not `calorieGoal/proteinGoal/carbsGoal/fatsGoal`). Prefer `onNavigate(screenId)` over N per-screen callbacks. If a prop travels through 2+ layers unused, use context or a hook instead. Never pair a noun and a boolean with near-identical names (`edit` vs `editing`).
10. **Reuse shared helpers before writing new ones.** Check `foodMath.js`, `trendMath.js`, `prMath.js`, `habitMath.js`, `macroColors.js`, `routineMeta.js` first. Known single sources of truth: `parseSets` (prMath), `parseEntryDate` (trendMath), `ymd`-style date keys, Monday-of-week math, `fmtNum`/`fmtVolume`. Never re-inline a copy.
11. **`async/await`, never `.then()`** — and never fire-and-forget a write (see Error Handling).
12. **Data modules stay separate from component modules.** A module that exports both a large dataset and a component creates circular-import hazards (ExerciseDatabase white-screen incident). Static data → its own file with no component imports.

## Error Handling Standard (every Supabase call)

Reference implementations: `DailyHabits.js` `deleteHabit` (toast + rollback/reload), `AccountInformation.js` `saveProfile` (toast on failure), `Workouts.js` history load (offline-aware).

- **Every user-initiated write**: `await` it, check `error`. On failure: toast via the existing `showToast` (e.g. "Couldn't save — check your connection.") **and** re-sync optimistic state (reload the affected list). Never close a sheet or clear inputs on a failed save.
- **Never** `if (error) return;` with no user feedback, and **never** discard a write's result (`.then(() => {})` or un-awaited). ⚠️ ~40 legacy call sites still violate this — Backlog item 1; fix them when touching that code.
- **Reads**: check `error`; on failure keep existing state — never clobber it with empty data.
- **Undo-toast deferred deletes**: if the deferred commit fails, reload the list so the item visibly reappears, plus toast.
- **Multi-statement writes** (insert parent then children, rename cascades): use an atomic RPC, or check every step and roll back/toast on partial failure. Never leave orphans silently.
- **The offline queue (`offlineQueue.js`) covers workout finishes ONLY.** Food, measurements, and habits have no offline story — do not assume queuing exists elsewhere.

## Consistency Canon (one way to do each thing)

- **Dates in the DB are ISO `YYYY-MM-DD`**, parsed at local midnight (`new Date(s + 'T00:00:00')`) — the `measurement_entries`/`habit_logs` pattern. ⚠️ Known debt: `food_entries.date` and `workout_sessions.date` still store `toLocaleDateString()` (locale-dependent, unqueryable — top item in `docs/BACKLOG.md`). Never write a new locale-formatted date to the DB; new date columns are always ISO; reads of the two legacy columns must tolerate both formats until the migration lands.
- **Colors**: never hardcode hex — use CSS variables from `:root` in `App.css`. Macro colors come only from `macroColors.js` (Protein green, Carbs yellow, Fats blue). One danger red, one success green — via tokens, not inline hex (the codebase currently has both `#EF4444` and `#ff4444`; don't add a third).
- **Toasts**: only the App-level `showToast` / `UndoToast`. Never write a local toast implementation.
- **Delete UX**: single-item destructive actions get the undo-toast deferred delete; bulk or history-destroying deletes get an explicit confirm. Never delete irreversibly from a single tap with no confirm and no undo.
- **Units**: every weight display respects the `metricSystem` setting. Label casing: lowercase `lbs` / `kg`.
- **Edge Functions from the client**: always `supabase.functions.invoke()`. Never raw `fetch` with a hardcoded project URL, and never hardcode redirect URLs.
- **Identity**: prefer the `user` prop / session already in scope over re-calling `supabase.auth.getSession()` in every helper.
- **Calendars**: use the shared `MonthOverviewCalendar` / `ScrollMonthStack`; don't build bespoke month grids.

## Performance Rules

- **No per-second (or faster) state at App level.** Ticking displays derive from persisted timestamps inside leaf components with their own interval. ⚠️ The current workout timer violates this (see Architecture) — don't extend the pattern; the fix is Backlog item 3.
- **Every query is bounded** — date window, `limit`, or both. Never fetch a full table to filter client-side. Select only needed columns. Never fetch the same table twice in one load function.
- **No N+1 widget loads** — parent fetches once, passes data down.
- **Batch multi-row position updates** into a single upsert, not one UPDATE per row.
- **Memoize real recomputation only** (list filters/totals recomputed per keystroke, chart groupings); `React.memo` pure display components that sit under frequently-updating parents. Don't blanket-memoize. No new exhaustive-deps warnings (CI fails on warnings).
- **Lazy-load rarely-visited screens** (`React.lazy`), keep the main tabs eager. The dynamic `import('@zxing/library')` in FoodLog is the model.

## Accessibility Rules (apply to all new/edited UI)

- Interactive elements are real `<button>`s (style-reset to match visuals). If a row contains nested buttons, use `role="button"` + `tabIndex={0}` + Enter/Space `onKeyDown` on the container instead — never a bare clickable `<div>`.
- Icon-only buttons get `aria-label`; toggles get `aria-pressed`; placeholder-only inputs get `aria-label`.
- Touch targets ≥ 44×44px — expand the hit area (padding/inset), never the visual size.
- Decorative inline SVGs get `aria-hidden="true"`.

## UX Copy Style Guide

- Voice: clean, minimal, neutral. No bro-fitness ("crush your goals"), no jokey copy on destructive actions, no marketing filler ("elevate your journey").
- **Never show raw provider errors** (`error.message` from Supabase, exception text, server body strings). Translate to the formula: *what happened + what to do next* ("Couldn't save — check your connection.").
- Buttons and screen titles: Title Case ("Add Food", "Sign In"). Body/helper text: sentence case.
- Confirm dialogs use specific verbs ("Resume" / "Discard"), never "Yes" / "No".
- Ellipsis: the `…` character, never `...`.
- Empty states: "No X yet." plus a one-line next step. Complete sentences end with a period; fragments don't — be consistent within a screen.
- Errors that have an in-UI remedy should point to it ("Product not found — try entering the barcode below.").
- No dead-end UI: anything non-functional is hidden or visibly labeled "Coming soon" inline (not a surprise toast).

## Testing

Jest + React Testing Library (`src/App.test.js` is stale CRA boilerplate — pending cleanup, Backlog item 6). Rules:

- New pure logic goes in a math/helper module and gets unit tests with it.
- Priority order for backfilling coverage: `foodMath.js` (every calorie flows through it; snapshot-reproduction invariant), `offlineQueue.js` (data-loss path, untestable manually), `habitMath.js` (streak math), `trendMath.js` (`weeklyTrendDelta` window edges), `prMath.js` (pre-save-history invariant), then extracted `confirmFinishWorkout` logic, the Dashboard streak walk, FoodLog search race handling, and AuthScreen signup validation (age-13 legal gate).

## Security Standards (non-negotiable, apply to every session)

1. **Never trust the client** — any decision with consequences (access, billing, rate limits) must be validated server-side
2. **Subscription status and rate limits are server-side only** — never writable by the user under any circumstances
3. **RLS policies must be reviewed for design intent, not just syntax** — ask "should the user even have this access" not just "is this policy correct"
4. **No sensitive logic in frontend code** — if it involves money, access control, or user data, it belongs on the server
5. **Before building any feature involving payments, subscriptions, or AI endpoints** — stop and design the security model first, before writing any code
6. **Flag any shortcuts taken for speed that touch security** — these get fixed before the app goes public, no exceptions
7. **Never hardcode API keys, secrets, or service role keys in frontend code**
8. **Environment variables in frontend code are not secure** — they are visible to anyone. Only use them on the server side for sensitive values
9. **Never use dangerouslySetInnerHTML** — if HTML must be rendered from user input, sanitize it server-side first
10. **Every new Edge Function requires** JWT verification, CORS headers scoped to allowed origins, and rate limiting — every function gets a limit, including account operations
11. **User identity comes from the verified JWT only** — never use client-supplied identity fields (email, user id) from the request body for anything. (A password sent for re-auth is fine — it's a credential to verify, not an identity claim.)
12. **Edge Functions never return internal error details** (raw upstream response bodies, `error.message`) — `console.error` server-side, return a generic message
13. **Account deletion relies on FK cascade** — `delete-account` deletes the auth user and every per-user table's `user_id` FK is `on delete cascade` (migration `20260712100100_user_id_fk_cascade.sql`). A new per-user table without the cascade FK makes account deletion **fail with an FK violation** — the table-creation template below is load-bearing.
14. **Destructive account operations require re-authentication** (current password), not just a live session — `delete-account` implements this; keep the pattern.
15. **Exports escape CSV formula injection** — `csvCell` in export-data prefixes `'` to cells starting `=`, `+`, `-`, `@`, tab, or CR. Keep this in any new export surface.
16. **Never grant `TRUNCATE`, `TRIGGER`, or `REFERENCES` to `anon`/`authenticated`** — RLS does not govern TRUNCATE. The event trigger `enforce_api_table_privileges` (migration `20260712110000`) blocks re-granting; don't remove it.
17. **Every per-user localStorage key is cleared on sign-out** — add exact keys to `PER_USER_KEYS` in App.js, or use a prefix in `PER_USER_KEY_PREFIXES` (`prPeriod_`, `defaultMeasurementIds_`). Cross-account leaks on shared devices are a known incident class.
18. Password rules must be **enforced server-side** (Supabase Auth settings), not only in `passwordPolicy.js` — client validation is UX, not security. ⚠️ Leaked-password (HIBP) protection is still disabled (advisor WARN) — pending Pro upgrade; see Backlog.

## Security Headers (vercel.json)

Enforcing CSP + security headers are set in `vercel.json` on all routes (verified live on production 2026-07-12: cold load, login, food search, and barcode scanner on a real device all clean).

- `vercel.json` must be **strict JSON** — comments (`//`) are not supported and make the Vercel deploy fail with "Invalid vercel.json file provided". Validate with `JSON.parse` before committing.
- **Any new external origin the app talks to must be added to the CSP** (`connect-src` for APIs, `img-src` for remote images — Open Food Facts product images are already allowed) or the feature works locally and silently breaks in production only.
- If Supabase Realtime is ever enabled, its websocket (`wss://xbvncbvoyatxbdhkkifq.supabase.co`) will NOT match the `https://` entry in `connect-src` — the `wss://` origin must be added to the CSP then.

## Supabase Table Creation (required for every new table)

Every new table must include all four steps. Never skip any of them:

```sql
-- 1. CREATE the table (user_id with ON DELETE CASCADE is mandatory —
--    account deletion depends on it; see Security Standard 13)
create table public.your_table (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  -- your columns here; date columns are ISO 'YYYY-MM-DD' text or a proper date type
  created_at timestamptz default now()
);

-- 2. GRANT access (CRUD only — never ALL; never TRUNCATE/TRIGGER/REFERENCES.
--    The enforce_api_table_privileges event trigger will reject over-grants.)
grant select, insert, update, delete on public.your_table to authenticated, service_role;

-- 3. ENABLE RLS
alter table public.your_table enable row level security;

-- 4. ADD POLICY (scoped to authenticated user — never use "Allow all for now")
create policy "Users can only access their own data"
on public.your_table
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

Then update the Architecture table list in this file.

Never use `using (true)` — that allows any authenticated user to read all other users' data.

Missing the GRANT step causes a 403 permission denied error from the Data API. Per-user tables don't need `anon` grants — the app requires auth and RLS blocks anon anyway.

## RLS Audit Scenarios (run these checks whenever auth or database rules are added or changed)

Before any Supabase RLS policy is considered done, verify these specific scenarios:

- Can a user read another user's data?
- Can a user modify their own subscription status?
- Can a user modify their own rate limits?
- Can a user modify fields they should only be able to read?
- Is there any scenario where a user can abuse an endpoint to rack up costs?
- Are sensitive fields (subscription status, rate limits, billing info) stored separately from user-writable data?
- Can a user escalate their own permissions?
- Is the anon key being used correctly — public read where intended, restricted write everywhere else?
- Do the live grants match intent? Verify `information_schema.role_table_grants` — the live DB once granted TRUNCATE to anon on every table while the repo SQL said otherwise.

Never store subscription status or rate limits on the same table as user-editable data.

## Supabase Diagnosis Patterns

**Migration appears to succeed but change is not in the database:**
`supabase db push` reporting success does not guarantee the migration ran. Supabase may think it already ran and skip it. Always verify by checking the actual database object signature via `pg_proc` or `information_schema.parameters`. Fix by running the migration SQL manually in the SQL editor.

**Edge Function returns 503 and logs only show "booted":**
The function is crashing internally, not a network or CORS issue. Check the actual function signature or secret availability. Common causes: missing secret, wrong RPC parameter name, function referencing a column or parameter that does not exist.

**Postgres function behaves like the old version after a migration:**
Query `pg_proc` or `information_schema.parameters` directly to confirm the actual signature in the database. Do not trust the push report. Fix by running the migration SQL manually.

```sql
-- Check function signature
select oid::regprocedure as signature
from pg_proc
where proname = 'your_function_name';

-- Check parameters
select parameter_name, parameter_mode, data_type
from information_schema.parameters
where specific_name = 'your_function_name_XXXXX'
order by ordinal_position;
```

**FK constraints on auth.users are invisible in information_schema** — use `pg_constraint` to verify them (cross-schema FKs don't show in `information_schema` views).

## Safe Deployment Order (always follow this order)

1. Apply database migration first (`supabase db push` or manual SQL)
2. Push frontend to Vercel (GitHub push triggers auto-deploy)
3. Redeploy Edge Function last (`supabase functions deploy function-name`)

Deploying the Edge Function before the frontend creates a production gap where the function expects a schema that the frontend has not yet adopted.

## Architecture

**Stack:** Create React App (React 19) + Supabase (hosted Postgres). No routing library — navigation is pure state. No local backend; all data goes directly to Supabase from the browser. Deployed on Vercel.

**Supabase client** is a singleton in `src/supabaseClient.js`.

**Tables (17 total, all with RLS, verified against the live DB 2026-07-12):**
- `profiles` — user profile data (first name, DOB, gender, height, dashboard layout)
- `food_entries` — daily food log with macros and micronutrient snapshots
- `custom_foods` — user-created foods with saved serving sizes
- `favorite_foods` — favorited food snapshots for quick logging
- `meals` — saved meal combinations with component foods
- `routines` — user workout routines
- `exercises` — exercises within routines, with position ordering + `planned_sets` jsonb
- `custom_exercises` — user-created exercises for the exercise database
- `workout_sessions` — completed workout history
- `session_exercises` — per-exercise sets/reps/weight for each session
- `exercise_prs` — personal records per exercise
- `measurements` — custom measurement types (incl. `frequency`)
- `measurement_entries` — logged measurement values over time
- `habits` — user-defined daily habits
- `habit_logs` — daily completion records per habit (NOT `habit_completions`)
- `user_goals` — calorie and macro targets
- `api_rate_limits` — server-side rate limiting counters (service_role only, never user-writable; stale rows purged daily by pg_cron)

**Navigation model** (all in `App.js`):
- `activeSection`: `main | food | workouts | measurements`
- `activeTab`: screen within a section (e.g. `workout-start`, `workout-history`)
- The bottom tab bar (`currentTabs`) is determined by `activeSection`
- Side panel navigates between sections
- `renderContent()` switches on `activeTab` to render the right component

**Active workout state** is lifted to `App.js`:
- `activeWorkout`: `{ routineName, startTime, routine, sessionLog }` — null when no workout
- `workoutSeconds`: incremented by an interval in App.js when `activeWorkout` is set (⚠️ known perf debt: re-renders the whole tree every second during a workout — Backlog item 3; don't add more App-level ticking state)
- `workoutExpanded`: controls whether the full logging modal is visible (true) or collapsed to the mini bar (false)

**Styling:** all inline styles + shared CSS classes defined in `App.css`. Design tokens are CSS custom properties on `:root`. Key classes: `.card`, `.input`, `.btn-primary`, `.btn-secondary`, `.tile`, `.content`, `.section-title`. Use the classes — don't re-implement their styles inline.

**Key design tokens:**
- Primary accent: `--accent: #0757FB`
- Background: `--bg: #FAFBFC`
- Font: Inter (loaded from Google Fonts in index.html)
- Never hardcode hex values — always reference CSS variables

## Edge Function Conventions

All Edge Functions must follow this pattern (`delete-account/index.ts` is the current reference implementation):

- `verify_jwt = true` in `config.toml`
- CORS headers scoped to allowed origins only (never wildcard — allowed: `https://fitness-app-ebon-six.vercel.app`, `http://localhost:3000`)
- OPTIONS preflight handler
- JWT verified via `supabase.auth.getUser()` — user identity always comes from the token, never the request body
- Rate limiting via `consume_rate_limit` RPC using service role client — **before** any expensive or sensitive work (in delete-account it runs before the password check so failed guesses consume the budget)
- Fail closed on rate limiter errors (return 503, never bypass)
- Secrets accessed via `Deno.env.get()` — never hardcoded
- Errors: log details server-side (`console.error`), return generic messages to the client
- Called from the client via `supabase.functions.invoke()` only
- **Third-party API flakiness — don't treat every 4xx as permanent.** The USDA API intermittently returns nginx-level 400s for valid requests; `food-search` (v20) classifies those as retryable and retries with 0/300/900/1800 ms backoff. When integrating any external API: decide explicitly which statuses are retryable, cap the retries, keep total added latency bounded, and never retry non-idempotent operations.

**Current rate limits:**
- `food-search`: 20/minute, 500/day
- `send-feedback`: 5/hour
- `export-data`: 2/day
- `delete-account`: 3/hour

**`consume_rate_limit` RPC signature:**
```
consume_rate_limit(p_user_id uuid, p_endpoint text, p_per_minute integer, p_per_hour integer, p_per_day integer)
```
All window parameters default to null. Only pass the windows you need by name.

## Known Hazards (learned the hard way — don't relearn)

- **vercel.json is strict JSON** — `//` comments make the Vercel deploy fail. Validate with `JSON.parse` before committing any change to it.
- **CSP is enforcing in production** — a new external origin that isn't added to `vercel.json`'s CSP works locally and breaks only in production. Check the CSP whenever adding any external call or image source.
- **USDA API intermittently 400s valid requests** (nginx-level flake) — see Edge Function Conventions; don't "fix" food-search's retry logic away, and don't assume a third-party 400 means the request was wrong.
- **Account deletion = FK cascade** — a new per-user table missing `on delete cascade` breaks `delete-account` with an FK violation (this exact drift once orphaned `habits`/`habit_logs`/`exercise_prs`).
- **ExerciseDatabase circular imports**: data + component in one module caused a white screen on hard reload while the build still passed. Keep data modules import-free of components; read bindings lazily if unavoidable.
- **Locale date strings in `food_entries.date` / `workout_sessions.date`** — forces full-table fetches and strands data on locale change. Until the ISO migration (Backlog item 12) lands, reads must tolerate both formats.
- **`supabase db push` lies** — see Supabase Diagnosis Patterns; always verify the live object.
- **Per-user localStorage leaks across accounts** on shared devices — `PER_USER_KEYS` + `PER_USER_KEY_PREFIXES` cleanup on sign-out is load-bearing.
- **`updateSet`/`addSet`/`deleteSet` in Workouts.js** mutate a closure variable inside a `setState` updater and use it after — relies on synchronous updater execution. Don't copy this pattern.

## Backlog & Audits

`docs/BACKLOG.md` holds the consolidated, prioritized findings from the July 2026 security + codebase audits, reconciled 2026-07-12 (security fixes 1–5 + food-log fix deployed; codebase audit items still open). Consult it before starting related work; check items off as they land. Prompt templates for me (the user) live in `docs/PROMPTS.md`; multi-session feature plans in `docs/plans/`.

## Pre-deployment Checklist

Done:
- [x] Remove all console.log/console.error statements
- [x] Supabase RLS audit
- [x] Auth added and tested
- [x] No API keys or secrets in frontend code
- [x] Rate limiting on external API calls
- [x] Age verification on signup (13+)
- [x] Privacy Policy and Terms of Service in-app
- [x] Feedback Edge Function with rate limiting
- [x] Email confirmation re-enabled (confirmed 2026-07-12: signup returns confirmation_sent_at, no session)
- [x] CSP enforcing (vercel.json) (verified live on production 2026-07-12: cold load, login, food search, and barcode scanner on a real device all clean)
- [x] Security audit fixes 1–5 deployed (cascade FKs + grant revocation + enforcement trigger, hardened delete-account, Edge Function error/CSV/reply_to hardening, localStorage sign-out cleanup + supabase/.temp untracked, security headers) — verified in code and live DB 2026-07-12

Blocking open testing (see `docs/BACKLOG.md`):
- [ ] ISO date migration for `food_entries.date` / `workout_sessions.date`
- [ ] Error handling on all Supabase writes (no more silent failures)
- [ ] Server-side password policy + leaked-password protection (advisor WARN still active; likely needs Pro)
- [ ] Supabase Pro upgrade
- [ ] Second security audit before open testing

Nice-to-have before launch:
- [ ] Codebase audit items (perf, a11y, dead code, bundle — `docs/BACKLOG.md` items 2–11)
- [ ] Signup enumeration copy decision
- [ ] Decide: proxy OpenFoodFacts or accept + timeout
- [ ] Pin search_path on `enforce_api_table_privileges` (advisor WARN)
- [ ] Remove `details: deleteError.message` from delete-account's 500 response
- [ ] 4-character minimum trigger for food search
- [ ] Manual barcode entry text field in scanner UI
