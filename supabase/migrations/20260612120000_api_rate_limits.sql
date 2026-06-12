-- Server-only rate-limit counters for Edge Functions.
--
-- SECURITY MODEL (per CLAUDE.md): rate limits must never be readable or writable
-- by users. This table therefore deliberately DOES NOT follow the usual
-- "grant to anon, authenticated" pattern — only service_role may touch it, and
-- RLS is enabled with no user-facing policy so even a leaked anon/JWT call gets
-- nothing. It is kept separate from all user-editable data on purpose.

create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, endpoint, window_start)
);

-- Lock the table down: revoke from everyone, grant only to service_role.
revoke all on public.api_rate_limits from anon, authenticated;
grant all on public.api_rate_limits to service_role;

alter table public.api_rate_limits enable row level security;
-- Intentionally NO policy for anon/authenticated. service_role bypasses RLS, so
-- only the Edge Function (running as service_role) can read/write counters.

-- Atomic check-and-increment for a fixed-window limiter. Increments both the
-- per-minute and per-day buckets in one round-trip and reports whether the call
-- is allowed. SECURITY DEFINER so it runs with the owner's rights; search_path is
-- pinned to defeat search_path hijacking.
create or replace function public.consume_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_per_minute integer,
  p_per_day integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minute_start timestamptz := date_trunc('minute', now());
  v_day_start    timestamptz := date_trunc('day', now());
  v_minute_count integer;
  v_day_count    integer;
begin
  insert into api_rate_limits (user_id, endpoint, window_start, count)
  values (p_user_id, p_endpoint || ':min', v_minute_start, 1)
  on conflict (user_id, endpoint, window_start)
  do update set count = api_rate_limits.count + 1
  returning count into v_minute_count;

  insert into api_rate_limits (user_id, endpoint, window_start, count)
  values (p_user_id, p_endpoint || ':day', v_day_start, 1)
  on conflict (user_id, endpoint, window_start)
  do update set count = api_rate_limits.count + 1
  returning count into v_day_count;

  if v_minute_count > p_per_minute then
    return jsonb_build_object(
      'allowed', false, 'scope', 'minute',
      'retry_after', greatest(1, 60 - extract(second from now())::int)
    );
  end if;

  if v_day_count > p_per_day then
    return jsonb_build_object(
      'allowed', false, 'scope', 'day',
      'retry_after', extract(epoch from (v_day_start + interval '1 day' - now()))::int
    );
  end if;

  return jsonb_build_object('allowed', true, 'minute_count', v_minute_count, 'day_count', v_day_count);
end;
$$;

-- Only the service role may execute the limiter.
revoke all on function public.consume_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(uuid, text, integer, integer) to service_role;
