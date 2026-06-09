-- profiles: one row per user holding editable personal fields.
-- Run this in the Supabase SQL editor.
--
-- NOTE: this intentionally deviates from the "Allow all for now" RLS template in
-- CLAUDE.md. That template (using (true)) would let any signed-in user read every
-- other user's profile — exactly the cross-account leak this table is meant to
-- prevent. Policies below are scoped to auth.uid() so each user only ever sees and
-- edits their own row.

create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  gender      text,
  dob         date,
  height      numeric,
  created_at  timestamptz not null default now()
);

-- Authenticated requests carry a JWT, so RLS sees the `authenticated` role. anon
-- (no JWT) is deliberately NOT granted access to this private table.
grant select, insert, update, delete on public.profiles to authenticated, service_role;

alter table public.profiles enable row level security;

-- Each user may only read/insert/update/delete their OWN row.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);
