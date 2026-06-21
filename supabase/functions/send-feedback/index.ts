import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Auto-injected by the Supabase platform at runtime.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Set with: supabase secrets set RESEND_API_KEY=...
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const FEEDBACK_TO = "hello@baselinestudios.app";
// Resend requires the From address to be on a domain you've verified in Resend.
const FEEDBACK_FROM = "Baseline Fitness <noreply@send.baselinestudios.app>";
const MAX_MESSAGE = 500;
const PER_HOUR = 5;

// CORS is browser-only defense-in-depth (stops other sites embedding this
// endpoint); the real protection is the JWT check below. Only these origins
// get an Access-Control-Allow-Origin header back.
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

  // ── Identity: the user comes from the verified JWT, never from the body. A
  // caller can only ever send feedback as themselves.
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

  // ── Parse + validate the body. We trust the JWT for the user's email (the
  // body's userEmail is only a fallback for display).
  let body: { message?: unknown; userEmail?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return json({ error: "Message is required" }, 400);
  }
  if (message.length > MAX_MESSAGE) {
    return json({ error: `Message must be ${MAX_MESSAGE} characters or fewer` }, 400);
  }

  const fromEmail = user.email ?? (typeof body.userEmail === "string" ? body.userEmail : "unknown");

  // ── Rate limit: atomic, server-side. Counters live in a service-only table the
  // user cannot read or write. Fail CLOSED if the limiter errors, so a broken
  // counter can never be used to bypass the limit and spam feedback emails.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: rl, error: rlError } = await admin.rpc("consume_rate_limit", {
    p_user_id: user.id,
    p_endpoint: "send-feedback",
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

  if (!RESEND_API_KEY) {
    return json({ error: "Email service not configured" }, 503);
  }

  // ── Send via Resend. reply_to is the user so a reply goes straight back to them.
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const resendResp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FEEDBACK_FROM,
      to: [FEEDBACK_TO],
      reply_to: fromEmail,
      subject: "Baseline Fitness Feedback",
      html:
        `<p><strong>From:</strong> ${escapeHtml(fromEmail)}</p>` +
        `<p><strong>Message:</strong></p>` +
        `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
      text: `From: ${fromEmail}\n\nMessage:\n${message}`,
    }),
  });

  if (!resendResp.ok) {
    const details = await resendResp.text();
    return json({ error: "Failed to send feedback", details }, 502);
  }

  return json({ success: true });
});
