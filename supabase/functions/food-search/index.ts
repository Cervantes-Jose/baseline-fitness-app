import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const USDA_API_KEY = Deno.env.get("USDA_API_KEY") ?? "";
const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("query");
    const barcode = url.searchParams.get("barcode");

    if (!query && !barcode) {
      return new Response(
        JSON.stringify({ error: "query or barcode parameter required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let usdaUrl = "";

    if (barcode) {
      // Barcode lookup
      usdaUrl = `${USDA_BASE_URL}/foods/search?query=${encodeURIComponent(barcode)}&api_key=${USDA_API_KEY}&pageSize=5`;
    } else {
      // Text search
      const sanitized = query!.trim().slice(0, 100).replace(/[^a-zA-Z0-9\s%.\-]/g, "");
      usdaUrl = `${USDA_BASE_URL}/foods/search?query=${encodeURIComponent(sanitized)}&api_key=${USDA_API_KEY}&pageSize=20&dataType=Survey%20(FNDDS),SR%20Legacy,Branded`;
    }

    const response = await fetch(usdaUrl);

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse and clean the results
    const foods = (data.foods ?? [])
      .filter((f: any) => f.description && f.foodNutrients)
      .map((f: any) => {
        const getNutrient = (id: number) => {
          const n = f.foodNutrients?.find((n: any) => n.nutrientId === id);
          return n ? Math.round(n.value * 10) / 10 : 0;
        };

        return {
          fdcId: f.fdcId,
          name: f.description,
          brandOwner: f.brandOwner ?? null,
          servingSize: f.servingSize ?? 100,
          servingSizeUnit: f.servingSizeUnit ?? "g",
          calories: getNutrient(1008),
          protein: getNutrient(1003),
          carbs: getNutrient(1005),
          fats: getNutrient(1004),
        };
      })
      .filter((f: any) => f.calories > 0);

    return new Response(
      JSON.stringify({ foods }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Search failed", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});