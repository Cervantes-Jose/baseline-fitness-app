-- Safety net: strip TRUNCATE / TRIGGER / REFERENCES from the API roles on every
-- newly created public table, regardless of which role's default ACL granted them.
--
-- Why this exists: ALTER DEFAULT PRIVILEGES (migration 20260712100000) only fixes
-- defaults for the postgres role. supabase_admin has its own default ACL that
-- still grants everything to anon/authenticated, and postgres is not a member of
-- supabase_admin, so that ACL cannot be altered from any role we control. This
-- event trigger closes the gap at CREATE TABLE time instead.
--
-- Known residual gap (unfixable from the postgres role): Supabase fires
-- non-superuser event triggers only for non-superuser DDL, so a table created by
-- supabase_admin itself (a superuser) is not covered — and its grants could not
-- be revoked by postgres anyway (revoke is a no-op without grant options). In
-- practice every public table here is created as postgres (migrations, dashboard
-- SQL editor, MCP), which this trigger does cover.
--
-- Deliberately NOT security definer: the function must run as the role executing
-- the DDL, since only the grantor (or owner) can actually revoke the grants its
-- own default ACL just applied. Execute privileges are left at their defaults —
-- event_trigger functions cannot be called from SQL, and restricting them could
-- interfere with the trigger firing for other roles.
create or replace function public.enforce_api_table_privileges()
returns event_trigger
language plpgsql
as $$
declare
  obj record;
begin
  for obj in
    select objid
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS')
      and object_type = 'table'
      and schema_name = 'public'
  loop
    execute format(
      'revoke truncate, trigger, references on table %s from anon, authenticated',
      obj.objid::regclass
    );
  end loop;
end;
$$;

drop event trigger if exists enforce_api_table_privileges_trg;

create event trigger enforce_api_table_privileges_trg
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS')
  execute function public.enforce_api_table_privileges();
