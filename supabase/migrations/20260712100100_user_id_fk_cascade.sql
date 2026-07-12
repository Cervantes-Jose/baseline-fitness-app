-- Make every per-user table clean up after account deletion.
--
-- Verified against pg_constraint on the live DB (information_schema hides FKs
-- whose referenced table is owned by another role, so auth.users FKs are
-- invisible there — query pg_catalog per CLAUDE.md):
--   - user_goals has NO foreign key on user_id at all → orphans rows forever.
--   - Every other per-user table HAS a FK to auth.users but with ON DELETE
--     NO ACTION → deleting an auth user is blocked unless every table is
--     manually cleared first (and the delete-account function's manual list
--     is missing habits / habit_logs / exercise_prs, so deletion breaks).
--   - Only api_rate_limits already cascades.
--
-- Fix, generically so any table is covered: add a cascading FK where user_id
-- has none, and rebuild every existing user_id → auth.users FK as ON DELETE
-- CASCADE. Idempotent: re-running finds nothing left to change.
do $$
declare
  r record;
begin
  -- 1. Tables with a user_id column but no FK on it: purge any rows already
  --    orphaned by past account deletions (exactly the rows a cascade would
  --    have removed — 0 rows at the time this was written), then add the FK.
  for r in
    select c.oid::regclass as tbl, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not exists (
        select 1 from pg_constraint con
        where con.conrelid = c.oid and con.contype = 'f' and a.attnum = any(con.conkey)
      )
  loop
    execute format(
      'delete from %s t where not exists (select 1 from auth.users u where u.id = t.user_id)',
      r.tbl
    );
    execute format(
      'alter table %s add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
      r.tbl, r.relname || '_user_id_fkey'
    );
  end loop;

  -- 2. Existing user_id FKs to auth.users that do not cascade: rebuild them.
  --    (Postgres has no ALTER CONSTRAINT for delete rules; drop + re-add keeps
  --    the same constraint name.)
  for r in
    select con.conrelid::regclass as tbl, con.conname
    from pg_constraint con
    join pg_namespace n on n.oid = con.connamespace
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any(con.conkey) and a.attname = 'user_id'
    where n.nspname = 'public'
      and con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
      and con.confdeltype <> 'c'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
      r.tbl, r.conname
    );
  end loop;
end;
$$;
