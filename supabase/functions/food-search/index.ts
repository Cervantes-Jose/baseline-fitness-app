import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const USDA_API_KEY = Deno.env.get("USDA_API_KEY") ?? "";

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

    if (!query) {
      return new Response(
        JSON.stringify({ error: "query parameter required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitized = query.trim().slice(0, 100);
    const usdaUrl = "https://api.nal.usda.gov/fdc/v1/foods/search?api_key=" + USDA_API_KEY + "&query=" + encodeURIComponent(sanitized) + "&pageSize=20";

    const response = await fetch(usdaUrl);
    const responseText = await response.text();

    if (!response.ok) {
      throw new Error("USDA API error: " + response.status + " - " + responseText);
    }

    const data = JSON.parse(responseText);

    const foods = (data.foods ?? [])
      .filter((f: any) => f.description)
      .map((f: any) => {
        const getNutrient = (name: string) => {
          const n = f.foodNutrients?.find((n: any) =>
            n.nutrientName?.toLowerCase().includes(name)
          );
          return n ? Math.round((n.value ?? 0) * 10) / 10 : 0;
        };

        return {
          fdcId: f.fdcId,
          name: f.description,
          brandOwner: f.brandOwner ?? null,
          servingSize: f.servingSize ?? 100,
          servingSizeUnit: f.servingSizeUnit ?? "g",
          calories: getNutrient("energy"),
          protein: getNutrient("protein"),
          carbs: getNutrient("carbohydrate"),
          fats: getNutrient("total lipid"),
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