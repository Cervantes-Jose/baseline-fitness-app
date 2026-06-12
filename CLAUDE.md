# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Coding Standards (follow every session without being reminded)

1. **Never rewrite whole files** — make targeted edits to specific sections only
2. **Always use separate component files** — never add new major sections to App.js directly
3. **Split files before they get big** — if a component grows beyond ~100 lines, move it to its own file
4. **Explain what changed** after every code update — don't just paste code blindly
5. **Flag technical debt** — if something is a shortcut that needs fixing later, say so explicitly
6. **Ask before building** — confirm requirements before writing code for any new feature
7. **Mobile first** — always design for phone screen size (max-width 480px) before desktop
8. **No feature creep** — if a new idea comes up mid-session, note it instead of building it immediately
9. **Never remove console.log statements silently** — flag them and ask before removing

## Security Standards (non-negotiable, apply to every session)

1. **Never trust the client** — any decision with consequences (access, billing, rate limits) must be validated server-side
2. **Subscription status and rate limits are server-side only** — never writable by the user under any circumstances
3. **RLS policies must be reviewed for design intent, not just syntax** — ask "should the user even have this access" not just "is this policy correct"
4. **No sensitive logic in frontend code** — if it involves money, access control, or user data, it belongs on the server
5. **Before building any feature involving payments, subscriptions, or AI endpoints** — stop and design the security model first, before writing any code
6. **Flag any shortcuts taken for speed that touch security** — these get fixed before the app goes public, no exceptions
7. **Never hardcode API keys, secrets, or service role keys in frontend code**
8. **Environment variables in frontend code are not secure** — they are visible to anyone. Only use them on the server side for sensitive values

## Supabase Table Creation (required for every new table)

Every new table must include all four steps. Never skip any of them:

1. CREATE the table (always include user_id column):
   create table public.your_table (
     id uuid default gen_random_uuid() primary key,
     user_id uuid references auth.users(id) not null,
     -- your columns here
     created_at timestamptz default now()
   );

2. GRANT access:
   grant select, insert, update, delete on public.your_table to anon, authenticated, service_role;

3. ENABLE RLS:
   alter table public.your_table enable row level security;

4. ADD POLICY (scoped to authenticated user — never use "Allow all for now"):
   create policy "Users can only access their own data"
   on public.your_table
   for all
   using (auth.uid() = user_id)
   with check (auth.uid() = user_id);

Never use using (true) — that allows any authenticated user to read all other users' data.

Note: For tables with server-only fields (subscription status, rate limits, billing), a blanket for all owner policy is not sufficient — see the RLS Audit Scenarios section below for additional checks required.

Missing the GRANT step causes a 403 permission denied error from the Data API.

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

Never store subscription status or rate limits on the same table as user-editable data.

## Architecture

**Stack:** Create React App (React 19) + Supabase (hosted Postgres). No routing library — navigation is pure state. No local backend; all data goes directly to Supabase from the browser.

**Supabase client** is a singleton in `src/supabaseClient.js`. Tables:
- `food_entries` — name, calories, protein, carbs, fats, hour, date
- `routines` / `exercises` — routine has many exercises (routine_id FK)
- `workout_sessions` / `session_exercises` — session has many exercises; sets stored as JSON array `[{weight, reps}]`
- `measurements` / `measurement_entries` — measurement has many timestamped entries

**Navigation model** (all in `App.js`):
- `activeSection`: `main | food | workouts | measurements`
- `activeTab`: screen within a section (e.g. `workout-start`, `workout-history`)
- The bottom tab bar (`currentTabs`) is determined by `activeSection`
- Side panel navigates between sections
- `renderContent()` switches on `activeTab` to render the right component

**Active workout state** is lifted to `App.js`:
- `activeWorkout`: `{ routineName, startTime, routine, sessionLog }` — null when no workout
- `workoutSeconds`: incremented by an interval in App.js when `activeWorkout` is set
- `workoutExpanded`: controls whether the full logging modal is visible (true) or collapsed to the mini bar (false)
- These three are passed as props into both `Workouts` instances (`key="workout-start"` and `key="workout-history"`)

**`Workouts` component** (`src/components/Workouts.js`) is the most complex piece. It has an internal `view` state (`routines → exercises → logging`, or `history`). Key relationships:
- When `view === 'logging'`, the logging modal is computed into `loggingModal` and rendered as a `position: fixed` overlay inside the `view === 'routines' || view === 'logging'` branch — it must be `view === 'logging'` to exist in the DOM.
- `sessionLog` (`{ [exerciseId]: [{weight, reps}] }`) and `checkedSets` (`{ [exerciseId]: [boolean] }`) track in-progress workout data locally.
- `sessionLogRef` keeps a ref in sync with `sessionLog` so `finishWorkout` can read the latest value without stale closures.
- Exercise reordering uses `@dnd-kit/core` + `@dnd-kit/sortable`.
- The logging modal supports swipe-to-collapse via pointer events (`dragY`, `dragStartY`).

**Styling:** all inline styles + shared CSS classes defined in `App.css`. Design tokens are CSS custom properties on `:root` (light) and `[data-theme="dark"]`. Key classes: `.card`, `.input`, `.btn-primary`, `.btn-secondary`, `.tile`, `.content`, `.section-title`.

## Pre-deployment Checklist (complete before app goes public)

- [x] Remove all console.log/console.error statements
- [ ] Supabase RLS audit using scenarios above
- [ ] Auth added and tested
- [ ] No API keys or secrets in frontend code
- [ ] Rate limiting on any external API calls
- [ ] Supabase spend alerts configured
- [ ] .env file confirmed in .gitignore
