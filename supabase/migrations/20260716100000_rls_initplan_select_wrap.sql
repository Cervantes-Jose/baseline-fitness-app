-- Performance: stop auth.uid() being re-evaluated per row in RLS policies.
--
-- `auth.uid() = user_id` is volatile-ish to the planner and gets re-run for every
-- candidate row. `(select auth.uid()) = user_id` is an uncorrelated subquery, so
-- the planner hoists it into an InitPlan and evaluates it exactly once per query.
-- Same truth value for every row -- this is a pure planner change, not a policy
-- change. Clears the advisor's auth_rls_initplan WARN.
--
-- Policy names are unchanged (ALTER, not DROP/CREATE) so nothing depends on a
-- rename. Note two tables use non-default policy names (habits, habit_logs).
--
-- api_rate_limits is intentionally absent: RLS is enabled with no policy at all
-- (service_role only, never user-readable). Nothing to rewrite there.

alter policy "Users can only access their own data" on public.custom_exercises
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can only access their own data" on public.custom_foods
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can only access their own data" on public.exercise_prs
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can only access their own data" on public.exercises
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can only access their own data" on public.favorite_foods
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can only access their own data" on public.food_entries
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can only access their own data" on public.meals
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can only access their own data" on public.measurement_entries
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can only access their own data" on public.measurements
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can only access their own data" on public.profiles
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can only access their own data" on public.routines
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can only access their own data" on public.session_exercises
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can only access their own data" on public.user_goals
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can only access their own data" on public.workout_sessions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Non-default policy name.
alter policy "Users can only access their own habits" on public.habits
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Non-default policy name, and the only policy with an EXISTS subquery. The
-- EXISTS lives in WITH CHECK only (writes), not USING (reads): it stops a user
-- attaching a log to someone else's habit. Both auth.uid() calls inside it are
-- wrapped too -- the inner one is uncorrelated with habit_logs, so it also
-- hoists; h.id = habit_logs.habit_id stays correlated and unchanged.
alter policy "Users can only access their own habit logs" on public.habit_logs
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.habits h
      where h.id = habit_logs.habit_id
        and h.user_id = (select auth.uid())
    )
  );
