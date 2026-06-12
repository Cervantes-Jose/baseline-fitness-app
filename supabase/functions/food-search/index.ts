import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const USDA_API_KEY = Deno.env.get("USDA_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// CORS is browser-only defense-in-depth (stops other sites embedding this
// endpoint); the real cost protection is the JWT check + rate limiter below.
// Only these origins get an Access-Control-Allow-Origin header back.
const ALLOWED_ORIGINS = [
  "https://fitness-app-ebon-six.vercel.app",
  "http://localhost:3000",
];

const PER_MINUTE = 20;
const PER_DAY = 500;

function corsHeadersFor(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = corsHeadersFor(origin);
  const jsonHeaders = { ...cors, "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  // ── Identity: user comes from the verified JWT (verify_jwt=true). It is never
  // taken from a query/body param, so a caller can only ever rate-limit itself.
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: jsonHeaders }
    );
  }

  // ── Rate limit: atomic, server-side. Counters live in a service-only table the
  // user cannot read or write. Fail CLOSED if the limiter errors, so a broken
  // counter can never be used to bypass the limit and hammer the USDA quota.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: rl, error: rlError } = await admin.rpc("consume_rate_limit", {
    p_user_id: user.id,
    p_endpoint: "food-search",
    p_per_minute: PER_MINUTE,
    p_per_day: PER_DAY,
  });
  if (rlError) {
    return new Response(
      JSON.stringify({ error: "Rate limiter unavailable" }),
      { status: 503, headers: jsonHeaders }
    );
  }
  if (rl && rl.allowed === false) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded", scope: rl.scope }),
      { status: 429, headers: { ...jsonHeaders, "Retry-After": String(rl.retry_after ?? 60) } }
    );
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("query");

    if (!query) {
      return new Response(
        JSON.stringify({ error: "query parameter required" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const sanitized = query.trim().slice(0, 100);

    const usdaUrl = "https://api.nal.usda.gov/fdc/v1/foods/search?api_key=" + USDA_API_KEY + "&query=" + encodeURIComponent(sanitized) + "&pageSize=40&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS),Branded";

    const response = await fetch(usdaUrl);
    const responseText = await response.text();

    if (!response.ok) {
      throw new Error("USDA API error: " + response.status + " - " + responseText);
    }

    const data = JSON.parse(responseText);

    const dataTypePriority: Record<string, number> = {
      "Foundation": 0,
      "SR Legacy": 1,
      "Survey (FNDDS)": 2,
      "Branded": 3,
    };

    const isAllCaps = (s: string) => s === s.toUpperCase() && /[A-Z]/.test(s);

    const toTitleCase = (s: string) =>
      s.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

    const foods = (data.foods ?? [])
      .filter((f: any) => {
        const desc: string = f.description ?? "";
        return desc.length >= 4;
      })
      .sort((a: any, b: any) => {
        const pa = dataTypePriority[a.dataType] ?? 4;
        const pb = dataTypePriority[b.dataType] ?? 4;
        if (pa !== pb) return pa - pb;
        const ql = sanitized.toLowerCase();
        const al = (a.description ?? "").toLowerCase();
        const bl = (b.description ?? "").toLowerCase();
        if (al.startsWith(ql) && !bl.startsWith(ql)) return -1;
        if (!al.startsWith(ql) && bl.startsWith(ql)) return 1;
        return 0;
      })
      .map((f: any) => {
        const getNutrient = (name: string) => {
  const n = f.foodNutrients?.find((n: any) =>
    n.nutrientName?.toLowerCase().includes(name) ||
    n.name?.toLowerCase().includes(name)
  );
  return n ? Math.round((n.value ?? 0) * 10) / 10 : 0;
};

        const rawName: string = f.description ?? "";
        const cleanedName = isAllCaps(rawName) ? toTitleCase(rawName) : rawName.trim();

        return {
          fdcId: f.fdcId,
          name: cleanedName,
          brandOwner: f.brandOwner ?? null,
          servingSize: f.servingSize ?? 100,
          servingSizeUnit: f.servingSizeUnit ?? "g",
          calories: getNutrient("energy"),
          protein: getNutrient("protein"),
          carbs: getNutrient("carbohydrate"),
          fats: getNutrient("total lipid"),
          nutrients: (f.foodNutrients ?? []).map((n: any) => ({
            name: n.nutrientName ?? "",
            value: Math.round((n.value ?? 0) * 10) / 10,
            unit: n.unitName ?? "g",
          })).filter((n: any) => n.name && n.value > 0),
        };
      })
      .filter((f: any) => f.calories > 0 || f.protein > 0 || f.carbs > 0 || f.fats > 0);

    return new Response(
      JSON.stringify({ foods }),
      { headers: jsonHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Search failed", details: error.message }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
