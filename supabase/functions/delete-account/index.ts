import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Auto-injected by the Supabase platform at runtime.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Tables that hold per-user rows, deleted child -> parent. Within the public
// schema the parent/child FKs already CASCADE (e.g. deleting a routine removes
// its exercises), but the FKs to auth.users are NO ACTION, so we must clear
// every table by user_id here before removing the auth user. user_goals has no
// FK at all, so it would orphan if we skipped it. Keep this list in sync when
// new per-user tables are added.
const USER_TABLES = [
  "session_exercises",
  "exercises",
  "workout_sessions",
  "measurement_entries",
  "measurements",
  "routines",
  "food_entries",
  "custom_exercises",
  "custom_foods",
  "favorite_foods",
  "meals",
  "user_goals",
  "profiles",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // The user id comes ONLY from the verified JWT, never from the request body,
  // so a caller can only ever delete their own account.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Missing authorization" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: "Invalid or expired token" }, 401);
  }

  const uid = user.id;

  // Service-role client bypasses RLS so it can remove every row. This key lives
  // only in the function's environment and is never exposed to the browser.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Delete the data first. If any of these fail we stop and leave the auth user
  // intact so the request can be retried without a half-deleted account.
  for (const table of USER_TABLES) {
    const { error } = await admin.from(table).delete().eq("user_id", uid);
    if (error) {
      return json({ error: `Failed clearing ${table}`, details: error.message }, 500);
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
  if (deleteError) {
    return json({ error: "Failed deleting account", details: deleteError.message }, 500);
  }

  return json({ success: true });
});
