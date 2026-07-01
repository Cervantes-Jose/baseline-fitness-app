-- Per-measurement trend cadence for custom (user-created) measurements.
--
-- 'daily'  → rolling 7-day trend (same as Weight / Body Fat).
-- 'weekly' → simple entry-over-entry delta (latest vs the previous entry).
--
-- This is purely a trend-display preference with no access/billing consequence,
-- so it lives on the already user-owned `measurements` table under its existing
-- RLS policy (auth.uid() = user_id). The seeded body-measurement defaults derive
-- their cadence by name in the client, so they don't rely on this column.

alter table public.measurements
  add column if not exists frequency text not null default 'daily'
  check (frequency in ('daily', 'weekly'));
