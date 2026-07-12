-- Purge stale api_rate_limits rows daily.
--
-- consume_rate_limit inserts one row per (user, endpoint-bucket, window) and
-- nothing ever deletes them, so the table grows without bound. The widest
-- window is per-day, so any row whose window_start is older than 2 days can
-- never influence a limit decision again.
--
-- pg_cron is available on this project (verified via pg_available_extensions),
-- so cleanup runs as a scheduled job — consume_rate_limit itself is untouched
-- (same SECURITY DEFINER, pinned search_path, service-role-only grant, same
-- return shape). The DO block is defensive for environments without pg_cron
-- (e.g. a stripped-down local stack): it skips with a notice instead of
-- failing, and it is idempotent — cron.schedule upserts by job name, and the
-- unschedule guard makes the intent explicit.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available: skipping scheduled api_rate_limits cleanup';
    return;
  end if;

  execute 'create extension if not exists pg_cron';

  if exists (select 1 from cron.job where jobname = 'purge_stale_api_rate_limits') then
    perform cron.unschedule('purge_stale_api_rate_limits');
  end if;

  perform cron.schedule(
    'purge_stale_api_rate_limits',
    '15 3 * * *',  -- daily at 03:15 UTC, off the top-of-hour rush
    $job$ delete from public.api_rate_limits where window_start < now() - interval '2 days' $job$
  );
end;
$$;
