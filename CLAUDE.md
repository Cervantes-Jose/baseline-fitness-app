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
9. **Never use dangerouslySetInnerHTML** — if HTML must be rendered from user input, sanitize it server-side first
10. **Every new Edge Function requires** JWT verification, CORS headers scoped to allowed origins, and rate limiting if it calls any external API or has cost implications

## Supabase Table Creation (required for every new table)

Every new table must include all four steps. Never skip any of them:

```sql
-- 1. CREATE the table (always include user_id column)
create table public.your_table (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  -- your columns here
  created_at timestamptz default now()
);

-- 2. GRANT access
grant select, insert, update, delete on public.your_table to anon, authenticated, service_role;

-- 3. ENABLE RLS
alter table public.your_table enable row level security;

-- 4. ADD POLICY (scoped to authenticated user — never use "Allow all for now")
create policy "Users can only access their own data"
on public.your_table
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

Never use `using (true)` — that allows any authenticated user to read all other users' data.

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

## Safe Deployment Order (always follow this order)

1. Apply database migration first (`supabase db push` or manual SQL)
2. Push frontend to Vercel (GitHub push triggers auto-deploy)
3. Redeploy Edge Function last (`supabase functions deploy function-name`)

Deploying the Edge Function before the frontend creates a production gap where the function expects a schema that the frontend has not yet adopted.

## Architecture

**Stack:** Create React App (React 19) + Supabase (hosted Postgres). No routing library — navigation is pure state. No local backend; all data goes directly to Supabase from the browser.

**Supabase client** is a singleton in `src/supabaseClient.js`.

**Tables (13 total, all with RLS):**
- `profiles` — user profile data (first name, DOB)
- `food_entries` — daily food log with macros and micronutrient snapshots
- `custom_foods` — user-created foods with saved serving sizes
- `favorite_foods` — favorited food snapshots for quick logging
- `meals` — saved meal combinations with component foods
- `routines` — user workout routines
- `exercises` — exercises within routines, with position ordering
- `workout_sessions` — completed workout history
- `session_exercises` — per-exercise sets/reps/weight for each session
- `measurements` — custom measurement types
- `measurement_entries` — logged measurement values over time
- `habits` — user-defined daily habits
- `habit_completions` — daily completion records per habit
- `user_goals` — calorie and macro targets
- `api_rate_limits` — server-side rate limiting counters (service_role only, never user-writable)

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

**Styling:** all inline styles + shared CSS classes defined in `App.css`. Design tokens are CSS custom properties on `:root`. Key classes: `.card`, `.input`, `.btn-primary`, `.btn-secondary`, `.tile`, `.content`, `.section-title`.

**Key design tokens:**
- Primary accent: `--accent: #0757FB`
- Background: `--bg: #FAFBFC`
- Font: Inter (loaded from Google Fonts in index.html)
- Never hardcode hex values — always reference CSS variables

## Edge Function Conventions

All Edge Functions must follow this pattern:

- `verify_jwt = true` in `config.toml`
- CORS headers scoped to allowed origins only (not wildcard)
- OPTIONS preflight handler
- JWT verified via `supabase.auth.getUser()` — user identity always comes from the token, never the request body
- Rate limiting via `consume_rate_limit` RPC using service role client before any external API call
- Fail closed on rate limiter errors (return 503, never bypass)
- Secrets accessed via `Deno.env.get()` — never hardcoded

**Current rate limits:**
- `food-search`: 20/minute, 500/day
- `send-feedback`: 5/hour
- `export-data`: 2/day

**`consume_rate_limit` RPC signature:**
```
consume_rate_limit(p_user_id uuid, p_endpoint text, p_per_minute integer, p_per_hour integer, p_per_day integer)
```
All window parameters default to null. Only pass the windows you need by name.

## Pre-deployment Checklist

- [x] Remove all console.log/console.error statements
- [x] Supabase RLS audit
- [x] Auth added and tested
- [x] No API keys or secrets in frontend code
- [x] Rate limiting on external API calls
- [x] Age verification on signup (13+)
- [x] Privacy Policy and Terms of Service in-app
- [x] Feedback Edge Function with rate limiting
- [ ] Email confirmation re-enabled before open testing
- [ ] Supabase Pro upgrade before open testing
- [ ] 4-character minimum trigger for food search
- [ ] Manual barcode entry text field in scanner UI
- [ ] Second security audit before open testing
