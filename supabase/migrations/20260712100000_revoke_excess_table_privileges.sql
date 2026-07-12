-- Tighten table privileges for the API-facing roles.
--
-- The live database granted TRUNCATE, TRIGGER, and REFERENCES to anon and
-- authenticated on every public table (Supabase's default broad grant). None of
-- those are needed by the app:
--   - TRUNCATE bypasses RLS's per-row model entirely (it is not policy-checked;
--     it only needs the table privilege), so a stray truncate through the Data
--     API could wipe a whole table.
--   - TRIGGER / REFERENCES let API roles attach triggers or FKs to our tables;
--     API clients must never do DDL-adjacent things.
-- SELECT/INSERT/UPDATE/DELETE for authenticated are intentionally left in place
-- (RLS scopes them per-user), so no re-grant is needed — this migration only
-- removes privileges. api_rate_limits already grants nothing to these roles;
-- the revoke is a no-op there.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

-- profiles was never meant to be visible to anon at all (db/profiles.sql grants
-- only authenticated + service_role). Remove every anon privilege on it.
revoke all on table public.profiles from anon;

-- Stop future tables from regaining the three privileges. Default privileges
-- are per-creating-role; migrations and the dashboard SQL editor both run as
-- postgres, which is the role this statement applies to when pushed.
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;
