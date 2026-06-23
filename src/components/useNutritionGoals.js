import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Shared data layer for the user's nutrition goals (the single `user_goals` row).
// Both App.js (read-only, to feed the Dashboard/Food Log) and NutritionGoals.js
// (read + write) use this so the load query lives in exactly one place.
export const GOAL_DEFAULTS = { calorie_goal: 2000, protein_goal: 180, carbs_goal: 200, fats_goal: 60 };

// userId: pass the signed-in user's id to (re)load whenever it changes — e.g. App.js
// passes user?.id so goals reload on sign-in/out. Pass nothing (undefined) and the hook
// resolves the id from the current session once on mount — used by NutritionGoals, which
// only ever renders while authenticated.
export function useNutritionGoals(userId) {
  const [goals, setGoals] = useState(GOAL_DEFAULTS);
  const [rowId, setRowId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let uid = userId;
      if (uid === undefined) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id;
      }
      if (!uid) { if (!cancelled) setLoading(false); return; }
      const { data, error } = await supabase
        .from('user_goals').select('*').eq('user_id', uid)
        .order('created_at', { ascending: false }).limit(1);
      if (cancelled) return;
      if (!error && data && data.length > 0) {
        const row = data[0];
        setGoals({
          calorie_goal: row.calorie_goal ?? GOAL_DEFAULTS.calorie_goal,
          protein_goal: row.protein_goal ?? GOAL_DEFAULTS.protein_goal,
          carbs_goal:   row.carbs_goal   ?? GOAL_DEFAULTS.carbs_goal,
          fats_goal:    row.fats_goal    ?? GOAL_DEFAULTS.fats_goal,
        });
        setRowId(row.id);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Upsert the goals row (update when one exists, insert otherwise) and reflect the
  // saved values back into the hook's state. Returns { error } so callers can bail
  // before updating their own UI. The caller owns building the payload.
  const saveGoals = async (payload) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return { error: new Error('No session') };
    let error;
    if (rowId) {
      ({ error } = await supabase.from('user_goals').update(payload).eq('id', rowId).eq('user_id', uid));
    } else {
      const { data, error: insErr } = await supabase
        .from('user_goals').insert([{ ...payload, user_id: uid }]).select().single();
      error = insErr;
      if (data) setRowId(data.id);
    }
    if (!error) setGoals(payload);
    return { error };
  };

  return { goals, rowId, loading, saveGoals, setGoals };
}
