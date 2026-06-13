// Shared food math — serving/unit → grams conversion, macro scaling, micro parsing,
// and the logged-entry snapshot builder. Extracted from FoodLog so the meal builder
// (MealBuilder.js) can reuse the exact same conversions.
//
// Macros on every food object are stored per "base" grams: USDA search results use
// food.servingSize; recent/custom foods have no servingSize so default to 100g.
export const UNIT_TO_GRAMS = { g: 1, oz: 28.35, ml: 1, cup: 240, tbsp: 15 };
export const SERVING_UNITS = ['g', 'oz', 'ml', 'cup', 'tbsp', 'serving'];

export const baseGramsOf = (food) => (Number(food?.servingSize) > 0 ? Number(food.servingSize) : 100);

export const servingToGrams = (amount, unit, baseGrams) => {
  const a = Number(amount) || 0;
  if (unit === 'serving') return a * baseGrams;   // 1 serving = the food's base serving size
  return a * (UNIT_TO_GRAMS[unit] ?? 1);
};

export const scaleOf = (food, serving, unit) => {
  const base = baseGramsOf(food);
  return base > 0 ? servingToGrams(serving, unit, base) / base : 1;
};

export const computeMacros = (food, serving, unit, servings = 1) => {
  const s = scaleOf(food, serving, unit) * (Number(servings) || 0);
  return {
    calories: Math.round((Number(food?.calories) || 0) * s),
    protein: Math.round((Number(food?.protein) || 0) * s),
    carbs: Math.round((Number(food?.carbs) || 0) * s),
    fats: Math.round((Number(food?.fats) || 0) * s),
  };
};

// A food's preferred serving (set via the detail screen); falls back to the USDA
// serving size, else 100g.
export const defaultServingOf = (food) => ({
  serving: food?.savedServing != null ? food.savedServing
    : (Number(food?.servingSize) > 0 ? Number(food.servingSize) : 100),
  unit: food?.savedUnit || food?.servingSizeUnit || 'g',
});

// Micronutrients: tolerant parse of common USDA foodNutrients shapes. Values are
// per base serving, so we scale them by the current serving scale.
const MACRO_NAME_RE = /protein|carbohydrate|total lipid|\bfat\b|fatty|energy|calorie/i;
const DV_REFERENCE = {
  Fiber: 28, Sugars: 50, Sodium: 2300, Cholesterol: 300, Potassium: 4700,
  Calcium: 1300, Iron: 18, 'Vitamin C': 90, 'Vitamin D': 20, 'Vitamin A': 900,
};
// Editable micronutrient rows for custom foods. Keys match DV_REFERENCE so %DV could
// be derived later; values stored as a `micros` jsonb object on the custom_foods row.
export const CUSTOM_MICRO_FIELDS = [
  { key: 'Fiber', label: 'Fiber', unit: 'g' },
  { key: 'Sugars', label: 'Sugar', unit: 'g' },
  { key: 'Sodium', label: 'Sodium', unit: 'mg' },
  { key: 'Cholesterol', label: 'Cholesterol', unit: 'mg' },
  { key: 'Potassium', label: 'Potassium', unit: 'mg' },
  { key: 'Calcium', label: 'Calcium', unit: 'mg' },
  { key: 'Iron', label: 'Iron', unit: 'mg' },
  { key: 'Vitamin A', label: 'Vitamin A', unit: 'mcg' },
  { key: 'Vitamin C', label: 'Vitamin C', unit: 'mg' },
  { key: 'Vitamin D', label: 'Vitamin D', unit: 'mcg' },
];

const cleanNutrientName = (name) => String(name).split(',')[0].trim();
export const parseMicros = (food, scale) => {
  const arr = food?.foodNutrients || food?.nutrients || [];
  if (!Array.isArray(arr)) return [];
  return arr
    .map(n => ({
      name: cleanNutrientName(n.nutrientName || n.name || n.nutrient?.name || ''),
      raw: n.value ?? n.amount ?? n.nutrient?.amount,
      unit: String(n.unitName || n.unit || n.nutrient?.unitName || '').toLowerCase(),
    }))
    .filter(n => n.name && n.raw != null && !MACRO_NAME_RE.test(n.name))
    .map(n => {
      const value = Number(n.raw) * scale;
      const ref = DV_REFERENCE[n.name];
      return {
        name: n.name,
        value: Math.round(value * 10) / 10,
        unit: n.unit,
        dv: ref ? Math.round((value / ref) * 100) : null,
      };
    });
};

// Build the serving/unit/servings/snapshot stored on a logged food_entries row so it can
// be reopened in the detail screen and re-scaled. The snapshot's macros + nutrients are
// the *total* (× servings) — Nutrition.js sums snapshot.nutrients as the row's total, and
// snapshot.servingSize is the total grams. We additionally persist the *original* serving,
// unit, and servings count so reopening shows the real breakdown (e.g. "50 g × 3") instead
// of collapsing to "150 g × 1".
//
// Reproduction holds because, for any non-`serving` unit, gramsPerServing × count === total
// grams, so scaleOf(snapshot, serving, unit) × count === 1 and the stored total reproduces.
// The `serving` unit is the only one that re-multiplies by the snapshot base, so we collapse
// it to its gram equivalent on store (display falls back to grams for that case only).
export const buildLoggedFields = (food, serving, unit, servings, macros) => {
  const count = Number(servings) || 0;
  const perServingGrams = Math.round(servingToGrams(serving, unit, baseGramsOf(food))) || 0;
  const grams = Math.round(perServingGrams * count) || 0;
  let nutrients;
  if (food.isCustom && food.micros) {
    nutrients = CUSTOM_MICRO_FIELDS
      .map(m => ({ name: m.label, value: Math.round((Number(food.micros[m.key]) || 0) * count * 10) / 10, unit: m.unit }))
      .filter(n => n.value > 0);
  } else {
    nutrients = parseMicros(food, scaleOf(food, serving, unit) * count).map(n => ({ name: n.name, value: n.value, unit: n.unit }));
  }
  const snapshot = {
    name: food.name,
    brandOwner: food.brandOwner || null,
    calories: macros.calories, protein: macros.protein, carbs: macros.carbs, fats: macros.fats,
    servingSize: grams || 1,
    servingSizeUnit: 'g',
    nutrients,
  };
  // 'serving' unit can't be re-scaled against the gram-normalized snapshot, so store its
  // gram equivalent; every other unit is preserved as the user entered it.
  const storeServing = unit === 'serving' ? perServingGrams : (Number(serving) || 0);
  const storeUnit = unit === 'serving' ? 'g' : unit;
  return { serving: storeServing, unit: storeUnit, servings: count, food: snapshot };
};

// ─── MEAL HELPERS ────────────────────────────────────────────
// A meal component is one added food, frozen at the serving/unit chosen in the picker:
//   { food (snapshot), serving, unit, grams, calories, protein, carbs, fats, micros:[{name,value,unit}] }
// Build one from a food + chosen serving/unit/servings.
export const buildMealComponent = (food, serving, unit, servings = 1) => {
  const count = Number(servings) || 1;
  const grams = Math.round(servingToGrams(serving, unit, baseGramsOf(food)) * count) || 0;
  let macros, micros;
  // Custom foods define macros/micros per *their own serving*, scaled by the number
  // of servings (serving size/unit only affects the displayed grams). Other foods scale
  // by grams. This mirrors how FoodLog logs each type so a meal matches its parts.
  if (food.isCustom) {
    macros = {
      calories: Math.round((Number(food.calories) || 0) * count),
      protein: Math.round((Number(food.protein) || 0) * count),
      carbs: Math.round((Number(food.carbs) || 0) * count),
      fats: Math.round((Number(food.fats) || 0) * count),
    };
    micros = food.micros
      ? CUSTOM_MICRO_FIELDS
          .map(m => ({ name: m.label, value: Math.round((Number(food.micros[m.key]) || 0) * count * 10) / 10, unit: m.unit }))
          .filter(n => n.value > 0)
      : [];
  } else {
    macros = computeMacros(food, serving, unit, count);
    micros = parseMicros(food, scaleOf(food, serving, unit) * count).map(n => ({ name: n.name, value: n.value, unit: n.unit }));
  }
  return {
    food: { name: food.name, brandOwner: food.brandOwner || null },
    serving: Number(serving) || 0, unit,
    grams,
    calories: macros.calories, protein: macros.protein, carbs: macros.carbs, fats: macros.fats,
    micros,
  };
};

// Sum a meal's components into whole-meal totals (grams, macros, and merged micros).
export const sumMealComponents = (components = []) => {
  const totals = { grams: 0, calories: 0, protein: 0, carbs: 0, fats: 0 };
  const microMap = {}; // name → { name, value, unit }
  for (const c of components) {
    totals.grams += Number(c.grams) || 0;
    totals.calories += Number(c.calories) || 0;
    totals.protein += Number(c.protein) || 0;
    totals.carbs += Number(c.carbs) || 0;
    totals.fats += Number(c.fats) || 0;
    for (const m of (c.micros || [])) {
      const key = m.name;
      if (!microMap[key]) microMap[key] = { name: m.name, value: 0, unit: m.unit };
      microMap[key].value += Number(m.value) || 0;
    }
  }
  const micros = Object.values(microMap).map(m => ({ ...m, value: Math.round(m.value * 10) / 10 }));
  return {
    grams: Math.round(totals.grams),
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fats: Math.round(totals.fats),
    micros,
  };
};

// Turn a saved meal row into a "food" object the detail screen can log. The meal's
// per-serving values become the food's base (servingSize = grams per serving), so
// logging 1 serving reproduces them and changing servings scales like any food.
export const mealAsFood = (meal) => {
  const servings = Number(meal.servings) > 0 ? Number(meal.servings) : 1;
  const perServingGrams = Math.max(1, Math.round((Number(meal.total_grams) || 0) / servings)) || 1;
  const per = (v) => Math.round(((Number(v) || 0) / servings));
  const microsPer = (meal.micros || []).map(m => ({
    name: m.name, unit: m.unit, value: Math.round(((Number(m.value) || 0) / servings) * 10) / 10,
  }));
  return {
    name: meal.name,
    isMeal: true,
    mealId: meal.id,
    calories: per(meal.calories),
    protein: per(meal.protein),
    carbs: per(meal.carbs),
    fats: per(meal.fats),
    servingSize: perServingGrams,   // base = one serving's weight in grams
    servingSizeUnit: 'g',
    nutrients: microsPer,           // per-serving micros, already scaled
  };
};
