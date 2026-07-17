-- Performance: covering indexes for every foreign key the advisor flags as
-- unindexed (17 FKs across 13 tables).
--
-- An unindexed FK forces a sequential scan of the *child* table whenever a
-- parent row is deleted or its key updated -- the FK's referential action has to
-- find dependent rows. Every user_id FK here is ON DELETE CASCADE, so account
-- deletion currently seq-scans each table once. The user_id indexes also serve
-- the RLS predicate (user_id = auth.uid()), which every query in the app carries.
--
-- Plain btree, non-concurrent: these tables are small enough that the brief
-- ACCESS EXCLUSIVE lock during build is not worth splitting into CONCURRENTLY
-- (which cannot run inside the migration's transaction anyway).
--
-- Not included, already covered by an existing index -- a btree on (a, b) covers
-- a leading-column lookup on (a), so these FKs are not flagged:
--   exercise_prs.user_id  -> exercise_prs_user_exercise_idx (user_id, exercise_name)
--   habits.user_id        -> habits_user_id_position_idx (user_id, position)
--   profiles.user_id      -> profiles_user_id_key (unique)
--   habit_logs.habit_id   -> habit_logs_habit_id_idx
--   api_rate_limits.user_id -> api_rate_limits_pkey (user_id, endpoint, window_start)

-- user_id FKs (all ON DELETE CASCADE to auth.users)
create index if not exists idx_custom_exercises_user_id on public.custom_exercises (user_id);
create index if not exists idx_custom_foods_user_id on public.custom_foods (user_id);
create index if not exists idx_exercises_user_id on public.exercises (user_id);
create index if not exists idx_favorite_foods_user_id on public.favorite_foods (user_id);
create index if not exists idx_food_entries_user_id on public.food_entries (user_id);
create index if not exists idx_habit_logs_user_id on public.habit_logs (user_id);
create index if not exists idx_meals_user_id on public.meals (user_id);
create index if not exists idx_measurement_entries_user_id on public.measurement_entries (user_id);
create index if not exists idx_measurements_user_id on public.measurements (user_id);
create index if not exists idx_routines_user_id on public.routines (user_id);
create index if not exists idx_session_exercises_user_id on public.session_exercises (user_id);
create index if not exists idx_user_goals_user_id on public.user_goals (user_id);
create index if not exists idx_workout_sessions_user_id on public.workout_sessions (user_id);

-- Intra-schema parent FKs
create index if not exists idx_exercises_routine_id on public.exercises (routine_id);
create index if not exists idx_measurement_entries_measurement_id on public.measurement_entries (measurement_id);
create index if not exists idx_session_exercises_session_id on public.session_exercises (session_id);
create index if not exists idx_workout_sessions_routine_id on public.workout_sessions (routine_id);
