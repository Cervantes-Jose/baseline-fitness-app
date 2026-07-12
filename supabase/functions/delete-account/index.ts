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

  // Deleting the auth user removes all of their data: as of migration
  // 20260712100100_user_id_fk_cascade.sql every public table's user_id FK to
  // auth.users is ON DELETE CASCADE (this function previously cleared a
  // hardcoded table list that had gone stale — habits, habit_logs and
  // exercise_prs were missing, which blocked deletion outright). New per-user
  // tables must keep the `references auth.users(id) on delete cascade` pattern
  // from CLAUDE.md or deletion will fail here with an FK violation.
  const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
  if (deleteError) {
    return json({ error: "Failed deleting account", details: deleteError.message }, 500);
  }

  return json({ success: true });
});
