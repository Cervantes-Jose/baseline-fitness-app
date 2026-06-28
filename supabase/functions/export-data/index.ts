import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Auto-injected by the Supabase platform at runtime.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Set with: supabase secrets set RESEND_API_KEY=...
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

// Resend requires the From address to be on a domain verified in Resend.
const EXPORT_FROM = "Baseline Fitness <noreply@send.baselinestudios.app>";
const PER_DAY = 2;

// The export type the client may request. Identity (user/email) always comes from
// the JWT — the body only chooses WHICH of the caller's own data to export.
const VALID_TYPES = ["all", "workouts", "nutrition", "measurements", "prs"] as const;
type ExportType = typeof VALID_TYPES[number];

// CORS is browser-only defense-in-depth; the JWT check below is the real gate.
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

// ── CSV helpers ─────────────────────────────────────────────
function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const head = headers.join(",");
  const body = rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}
// Base64 for the Resend attachment payload (UTF-8 safe).
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

type Admin = ReturnType<typeof createClient>;

// ── Dataset builders (each returns one CSV string, scoped to uid) ────────────
async function workoutsCsv(admin: Admin, uid: string): Promise<string> {
  const { data: sessions } = await admin
    .from("workout_sessions")
    .select("id, date, routine_name, duration, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: true });
  const ids = (sessions ?? []).map((s) => s.id);
  const { data: exs } = ids.length
    ? await admin.from("session_exercises").select("session_id, exercise_name, sets").eq("user_id", uid).in("session_id", ids)
    : { data: [] as Record<string, unknown>[] };

  const byId: Record<string, Record<string, unknown>> = {};
  (sessions ?? []).forEach((s) => { byId[s.id as string] = s; });

  const rows: Record<string, unknown>[] = [];
  (exs ?? []).forEach((ex) => {
    const s = byId[ex.session_id as string] ?? {};
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    sets.forEach((set: { weight?: unknown; reps?: unknown }, i: number) => {
      rows.push({
        date: s.date ?? "",
        routine: s.routine_name ?? "",
        duration_seconds: s.duration ?? "",
        exercise: ex.exercise_name ?? "",
        set_number: i + 1,
        weight: set?.weight ?? "",
        reps: set?.reps ?? "",
      });
    });
  });
  return toCsv(rows, ["date", "routine", "duration_seconds", "exercise", "set_number", "weight", "reps"]);
}

async function nutritionCsv(admin: Admin, uid: string): Promise<string> {
  const { data } = await admin
    .from("food_entries")
    .select("date, hour, name, serving, unit, servings, calories, protein, carbs, fats")
    .eq("user_id", uid)
    .order("date", { ascending: true });
  return toCsv(data ?? [], ["date", "hour", "name", "serving", "unit", "servings", "calories", "protein", "carbs", "fats"]);
}

async function measurementsCsv(admin: Admin, uid: string): Promise<string> {
  const { data: meas } = await admin.from("measurements").select("id, name").eq("user_id", uid);
  const { data: ents } = await admin
    .from("measurement_entries")
    .select("measurement_id, value, unit, date, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: true });
  const nameById: Record<string, unknown> = {};
  (meas ?? []).forEach((m) => { nameById[m.id as string] = m.name; });
  const rows = (ents ?? []).map((e) => ({
    measurement: nameById[e.measurement_id as string] ?? "",
    value: e.value ?? "",
    unit: e.unit ?? "",
    date: e.date ?? "",
  }));
  return toCsv(rows, ["measurement", "value", "unit", "date"]);
}

// PRs: aggregate the best (heaviest) set and total volume per exercise from the
// user's completed session sets.
async function prsCsv(admin: Admin, uid: string): Promise<string> {
  const { data: exs } = await admin
    .from("session_exercises")
    .select("exercise_name, sets")
    .eq("user_id", uid);

  const agg: Record<string, { best: number; reps: unknown; sets: number; volume: number }> = {};
  (exs ?? []).forEach((ex) => {
    const name = (ex.exercise_name as string) ?? "";
    if (!name) return;
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    const a = agg[name] ?? { best: 0, reps: "", sets: 0, volume: 0 };
    sets.forEach((set: { weight?: unknown; reps?: unknown }) => {
      const w = Number(set?.weight) || 0;
      const r = Number(set?.reps) || 0;
      a.sets += 1;
      a.volume += w * r;
      if (w > a.best) { a.best = w; a.reps = set?.reps ?? ""; }
    });
    agg[name] = a;
  });

  const rows = Object.entries(agg).map(([exercise, a]) => ({
    exercise,
    best_weight: a.best,
    reps_at_best: a.reps,
    total_sets: a.sets,
    total_volume: a.volume,
  }));
  return toCsv(rows, ["exercise", "best_weight", "reps_at_best", "total_sets", "total_volume"]);
}

const BUILDERS: Record<Exclude<ExportType, "all">, { file: string; build: (a: Admin, u: string) => Promise<string> }> = {
  workouts: { file: "workouts.csv", build: workoutsCsv },
  nutrition: { file: "nutrition.csv", build: nutritionCsv },
  measurements: { file: "measurements.csv", build: measurementsCsv },
  prs: { file: "personal-records.csv", build: prsCsv },
};

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

  // ── Identity from the verified JWT, never the body. The caller can only ever
  // export their own data, to their own email.
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
  if (!user.email) {
    return json({ error: "Your account has no email to send the export to" }, 400);
  }

  // ── Validate the requested export type.
  let body: { type?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const type = body.type as ExportType;
  if (!VALID_TYPES.includes(type)) {
    return json({ error: "Invalid export type" }, 400);
  }

  // ── Rate limit: 2/day, atomic and server-side. Fail CLOSED so a broken counter
  // can never be used to spam large export jobs / emails.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: rl, error: rlError } = await admin.rpc("consume_rate_limit", {
    p_user_id: user.id,
    p_endpoint: "export-data",
    p_per_day: PER_DAY,
  });
  if (rlError) {
    return json({ error: "Rate limiter unavailable" }, 503);
  }
  if (rl && rl.allowed === false) {
    return new Response(
      JSON.stringify({ error: "You can only request 2 exports per day. Try again tomorrow.", scope: rl.scope }),
      { status: 429, headers: { ...jsonHeaders, "Retry-After": String(rl.retry_after ?? 86400) } },
    );
  }

  if (!RESEND_API_KEY) {
    return json({ error: "Email service not configured" }, 503);
  }

  // ── Build the CSV attachment(s). "all" bundles every dataset as a separate file.
  // TECH DEBT: CSVs are built fully in memory and inlined (base64) into the email.
  // For large accounts this can exceed email/attachment size limits — future work
  // is to upload to Storage and email a signed download URL instead.
  const targets = type === "all"
    ? (Object.keys(BUILDERS) as Exclude<ExportType, "all">[])
    : [type as Exclude<ExportType, "all">];

  let attachments: { filename: string; content: string }[];
  try {
    attachments = await Promise.all(
      targets.map(async (t) => ({
        filename: BUILDERS[t].file,
        content: toBase64(await BUILDERS[t].build(admin, user.id)),
      })),
    );
  } catch (_e) {
    return json({ error: "Failed to assemble your export" }, 500);
  }

  // ── Email it to the JWT-derived address via Resend.
  const label = type === "all" ? "all of your data" : type;
  const resendResp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EXPORT_FROM,
      to: [user.email],
      subject: "Your Baseline Fitness data export",
      html:
        `<p>Your export of <strong>${label}</strong> is attached as CSV.</p>` +
        `<p>If you didn't request this, you can ignore this email.</p>`,
      text: `Your export of ${label} is attached as CSV.\n\nIf you didn't request this, you can ignore this email.`,
      attachments,
    }),
  });

  if (!resendResp.ok) {
    const details = await resendResp.text();
    return json({ error: "Failed to send your export", details }, 502);
  }

  return json({ success: true });
});
