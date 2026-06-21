-- Extend the rate limiter with a per-HOUR window (needed by send-feedback) and
-- make every window optional so each endpoint can pick the buckets it needs.
--
-- The original signature only supported minute + day. We drop it and recreate a
-- superset: p_per_minute / p_per_hour / p_per_day all default to null, and a bucket
-- is only incremented + checked when its limit is provided. food-search keeps
-- working unchanged — it passes p_per_minute + p_per_day by name, p_per_hour stays
-- null. The security model is identical: SECURITY DEFINER, pinned search_path,
-- execute granted to service_role only.

drop function if exists public.consume_rate_limit(uuid, text, integer, integer);

create or replace function public.consume_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_per_minute integer default null,
  p_per_hour integer default null,
  p_per_day integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_per_minute is not null then
    insert into api_rate_limits (user_id, endpoint, window_start, count)
    values (p_user_id, p_endpoint || ':min', date_trunc('minute', now()), 1)
    on conflict (user_id, endpoint, window_start)
    do update set count = api_rate_limits.count + 1
    returning count into v_count;
    if v_count > p_per_minute then
      return jsonb_build_object(
        'allowed', false, 'scope', 'minute',
        'retry_after', greatest(1, 60 - extract(second from now())::int)
      );
    end if;
  end if;

  if p_per_hour is not null then
    insert into api_rate_limits (user_id, endpoint, window_start, count)
    values (p_user_id, p_endpoint || ':hour', date_trunc('hour', now()), 1)
    on conflict (user_id, endpoint, window_start)
    do update set count = api_rate_limits.count + 1
    returning count into v_count;
    if v_count > p_per_hour then
      return jsonb_build_object(
        'allowed', false, 'scope', 'hour',
        'retry_after', extract(epoch from (date_trunc('hour', now()) + interval '1 hour' - now()))::int
      );
    end if;
  end if;

  if p_per_day is not null then
    insert into api_rate_limits (user_id, endpoint, window_start, count)
    values (p_user_id, p_endpoint || ':day', date_trunc('day', now()), 1)
    on conflict (user_id, endpoint, window_start)
    do update set count = api_rate_limits.count + 1
    returning count into v_count;
    if v_count > p_per_day then
      return jsonb_build_object(
        'allowed', false, 'scope', 'day',
        'retry_after', extract(epoch from (date_trunc('day', now()) + interval '1 day' - now()))::int
      );
    end if;
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

-- Only the service role may execute the limiter.
revoke all on function public.consume_rate_limit(uuid, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(uuid, text, integer, integer, integer) to service_role;
