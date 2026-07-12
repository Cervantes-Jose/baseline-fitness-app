import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Auto-injected by the Supabase platform at runtime.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const PER_HOUR = 3;

// CORS is browser-only defense-in-depth (stops other sites embedding this
// endpoint); the real protection is the JWT + password checks below. Only
// these origins get an Access-Control-Allow-Origin header back.
const ALLOWED_ORIGINS = [
  "https://fitness-app-ebon-six.vercel.app",
  "http://localhost:3000",
];

function corsHeadersFor(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = corsHeadersFor(origin);
  const jsonHeaders = { ...cors, "Content-Type": "application/json" };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: jsonHeaders });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
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

  // ── Parse the body: the current password is required for re-auth. Identity
  // still comes only from the JWT — the body never names a user.
  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return json({ error: "Password is required" }, 400);
  }

  // Service-role client bypasses RLS so it can remove every row. This key lives
  // only in the function's environment and is never exposed to the browser.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Rate limit BEFORE the password check so failed guesses consume the
  // budget — otherwise this endpoint doubles as a password oracle. Counters
  // live in a service-only table the user cannot touch. Fail CLOSED if the
  // limiter errors, so a broken counter never bypasses the limit.
  const { data: rl, error: rlError } = await admin.rpc("consume_rate_limit", {
    p_user_id: uid,
    p_endpoint: "delete-account",
    p_per_hour: PER_HOUR,
  });
  if (rlError) {
    return json({ error: "Rate limiter unavailable" }, 503);
  }
  if (rl && rl.allowed === false) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded", scope: rl.scope }),
      { status: 429, headers: { ...jsonHeaders, "Retry-After": String(rl.retry_after ?? 3600) } }
    );
  }

  // ── Re-auth: a stolen or leftover session token alone must not be enough to
  // destroy an account. Verify the password against the JWT-derived email on a
  // throwaway client (no session persisted).
  if (!user.email) {
    return json({ error: "Password verification unavailable for this account" }, 403);
  }
  const reauthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: pwError } = await reauthClient.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (pwError) {
    return json({ error: "Incorrect password" }, 403);
  }

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
