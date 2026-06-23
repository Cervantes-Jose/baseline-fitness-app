"""
baseline-fitness-analytics — Synthetic Data Generator
=======================================================
Generates 6 months of realistic fitness data for a single user persona ("Alex")
and inserts it directly into Supabase.

Causal model encoded in the data:
  sleep_score  ──┐
                  ├──► session_volume (sets × reps × weight)
  protein_met ───┘
  consistency ────────► measurement trend (weight, body fat decrease over time)
  Bad weeks injected every 3-4 weeks to create realistic noise.
  Target correlations: r = 0.55–0.70 (realistic, not perfect)

Tables written to:
  - food_entries
  - workout_sessions
  - session_exercises
  - measurement_entries
  - daily_habits (sleep stored here)

Setup:
  1. Copy .env.example to .env and fill in your values
  2. pip install supabase numpy python-dotenv
  3. python generate_synthetic_data.py
"""

import os
import random
import uuid
from datetime import date, timedelta, datetime
from dotenv import load_dotenv

# ── LOAD CREDENTIALS FROM .env ────────────────────────────────────────────────
# Never hardcode keys here. All credentials live in .env which is gitignored.
load_dotenv()

SUPABASE_URL         = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
USER_ID              = os.getenv("USER_ID")

# Fail immediately if any credential is missing — better than a cryptic error later
if not all([SUPABASE_URL, SUPABASE_SERVICE_KEY, USER_ID]):
    raise EnvironmentError(
        "Missing credentials. Copy .env.example to .env and fill in all three values."
    )

# ── PERSONA CONFIG ────────────────────────────────────────────────────────────
START_DATE = date(2026, 1, 1)
END_DATE   = date(2026, 6, 30)

# Alex: 28yo male lifter, PPL split, cutting over 6 months
STARTING_WEIGHT_LBS  = 180.0
STARTING_BODYFAT_PCT = 18.0
CALORIE_TARGET       = 2400
PROTEIN_TARGET_G     = 150

# Routine IDs — fetched dynamically from your routines table at runtime
# These are populated automatically in main() — do not hardcode UUIDs here
ROUTINE_IDS = {}  # filled in at runtime: {"Push": uuid, "Pull": uuid, "Legs": uuid}

# Exercise definitions: (name, routine_name, baseline_weight_lbs, sets)
# routine_name matches the name column in your routines table
EXERCISES = [
    # Push
    ("Bench Press",       "Push", 185, 4),
    ("Overhead Press",    "Push", 115, 3),
    ("Incline Dumbbell",  "Push",  70, 3),
    ("Tricep Pushdown",   "Push",  55, 3),
    # Pull
    ("Barbell Row",       "Pull", 165, 4),
    ("Pull-Up",           "Pull",   0, 4),   # bodyweight
    ("Face Pull",         "Pull",  45, 3),
    ("Dumbbell Curl",     "Pull",  35, 3),
    # Legs
    ("Squat",             "Legs", 225, 4),
    ("Romanian Deadlift", "Legs", 185, 3),
    ("Leg Press",         "Legs", 270, 3),
    ("Calf Raise",        "Legs", 135, 4),
]

# Measurement names — must match exactly what's in your measurements table
MEAS_WEIGHT  = "Weight"
MEAS_BODYFAT = "Body Fat"
MEAS_WAIST   = "Waist"

# ── HELPERS ───────────────────────────────────────────────────────────────────

def clamp(val, lo, hi):
    return max(lo, min(hi, val))

def jitter(val, pct=0.05):
    """Add small random noise so numbers don't look artificially round."""
    return val * (1 + random.uniform(-pct, pct))

def is_bad_week(week_num):
    """
    Inject a realistic 'life happens' bad week every 3-4 weeks.
    Bad weeks have poor sleep and low nutrition — this creates the noise
    that makes correlations look real rather than perfect.
    """
    # Use a seeded choice so bad weeks are deterministic per week number
    return week_num % random.choice([3, 4]) == 0

# ── DAILY PLAN ────────────────────────────────────────────────────────────────

def generate_daily_plan(start: date, end: date):
    """
    Generates one dict per day covering the full 6-month window.
    Each day pre-computes: sleep quality, nutrition, whether a workout
    is scheduled, and whether it's a measurement day.

    This is the foundation everything else builds on — workout volume,
    food entries, and measurements all reference this day-level context.
    """
    days = []
    current = start
    week = 0

    # PPL rotation: Push Mon+Thu, Pull Tue+Fri, Legs Wed+Sat, rest Sun
    ppl_schedule = {
        0: "Push",   # Monday
        1: "Pull",   # Tuesday
        2: "Legs",   # Wednesday
        3: "Push",   # Thursday
        4: "Pull",   # Friday
        5: "Legs",   # Saturday
        6: None,     # Sunday — rest
    }

    while current <= end:
        if current.weekday() == 0:  # Monday = start of new week
            week += 1
            bad = is_bad_week(week)
        else:
            bad = days[-1]["bad_week"] if days else False

        # Sleep quality — bad weeks have shorter, lower quality sleep
        if bad:
            sleep_hours = round(random.uniform(5.0, 6.5), 1)
            sleep_score = random.randint(45, 62)
        else:
            sleep_hours = round(random.uniform(6.5, 8.5), 1)
            sleep_score = random.randint(68, 90)

        # Nutrition — bad weeks have lower calories and protein
        if bad:
            calories  = random.randint(1700, 2100)
            protein_g = random.randint(90, 120)
            carbs_g   = random.randint(150, 200)
            fat_g     = random.randint(40, 65)
        else:
            calories  = random.randint(2200, 2650)
            protein_g = random.randint(135, 175)
            carbs_g   = random.randint(220, 300)
            fat_g     = random.randint(55, 85)

        days.append({
            "date":            current,
            "week":            week,
            "bad_week":        bad,
            "sleep_hours":     sleep_hours,
            "sleep_score":     sleep_score,
            "calories":        calories,
            "protein_g":       protein_g,
            "carbs_g":         carbs_g,
            "fat_g":           fat_g,
            "routine_name":    ppl_schedule[current.weekday()],
            "log_measurement": current.weekday() == 0,  # weekly weigh-in on Mondays
        })
        current += timedelta(days=1)

    return days

# ── CAUSAL ENGINE ─────────────────────────────────────────────────────────────

def compute_volume_multiplier(day_idx, days):
    """
    THE KEY FUNCTION — this is what makes the correlations real.

    Calculates a multiplier (0.70 to 1.30) that scales workout volume
    based on two inputs:
      1. Sleep score from the night before (recovery)
      2. Average protein from the prior 2 days (fuel)

    High sleep + high protein → multiplier above 1.0 → more reps logged
    Poor sleep + low protein  → multiplier below 1.0 → fewer reps logged

    This creates the signal that SQL and Power BI will later detect as
    correlation. Without this function, the data is just noise.
    """
    multiplier = 1.0

    # Sleep effect: last night's score
    sleep_score = days[day_idx]["sleep_score"]
    if sleep_score >= 75:
        multiplier *= random.uniform(1.05, 1.15)   # good sleep = better output
    elif sleep_score < 60:
        multiplier *= random.uniform(0.82, 0.93)   # poor sleep = worse output

    # Nutrition effect: average protein over prior 2 days
    prior_protein = []
    for offset in [1, 2]:
        idx = day_idx - offset
        if idx >= 0:
            prior_protein.append(days[idx]["protein_g"])

    if prior_protein:
        avg_protein = sum(prior_protein) / len(prior_protein)
        if avg_protein >= 145:
            multiplier *= random.uniform(1.04, 1.12)   # on-target protein = more output
        elif avg_protein < 110:
            multiplier *= random.uniform(0.85, 0.95)   # low protein = less output

    return clamp(multiplier, 0.70, 1.30)

# ── ROW BUILDERS ─────────────────────────────────────────────────────────────

def build_food_entries(day, user_id):
    """
    Splits the day's total nutrition across 3 meals (30/40/30).
    Each meal becomes one row in food_entries.
    """
    splits     = [0.30, 0.40, 0.30]
    meal_names = ["Breakfast", "Lunch", "Dinner"]
    meal_hours = [8, 13, 19]
    entries = []

    for split, name, hour in zip(splits, meal_names, meal_hours):
        logged_at = datetime.combine(day["date"], datetime.min.time()).replace(
            hour=hour, minute=random.randint(0, 30)
        ).isoformat()

        entries.append({
            "id":        str(uuid.uuid4()),
            "user_id":   user_id,
            "name":      name,
            "calories":  round(day["calories"]  * split),
            "protein":   round(day["protein_g"] * split),
            "carbs":     round(day["carbs_g"]   * split),
            "fat":       round(day["fat_g"]     * split),
            "logged_at": logged_at,
        })

    return entries


def build_workout_session(day, day_idx, days, user_id):
    """
    Builds a workout_sessions row and matching session_exercises rows.
    Returns (None, []) on rest days or randomly skipped sessions (~15%).

    The volume multiplier from compute_volume_multiplier() is applied to
    reps here — this is where the causal relationship becomes data.
    """
    routine_name = day["routine_name"]
    if routine_name is None:
        return None, []

    routine_id = ROUTINE_IDS.get(routine_name)
    if not routine_id:
        return None, []   # routine not found in DB — skip silently

    # Realistic missed sessions: ~15% of scheduled workouts skipped
    if random.random() < 0.15:
        return None, []

    multiplier = compute_volume_multiplier(day_idx, days)
    session_id = str(uuid.uuid4())

    started_at = datetime.combine(day["date"], datetime.min.time()).replace(
        hour=random.randint(6, 19), minute=random.randint(0, 45)
    ).isoformat()

    session = {
        "id":               session_id,
        "user_id":          user_id,
        "routine_id":       routine_id,
        "started_at":       started_at,
        "duration_seconds": random.randint(2700, 4500),  # 45–75 min
        "notes":            None,
    }

    # Build sets for each exercise in this routine
    routine_exercises = [e for e in EXERCISES if e[1] == routine_name]
    exercise_rows = []

    for order_idx, (ex_name, _, base_weight, num_sets) in enumerate(routine_exercises):
        # Progressive overload: ~0.5% weight increase per week
        week_factor = 1 + (day["week"] * 0.005)
        weight = round(base_weight * week_factor * jitter(1.0, 0.03))
        if base_weight == 0:
            weight = 0   # bodyweight exercises (pull-ups)

        sets_data = []
        for set_num in range(num_sets):
            reps = random.randint(6, 12)

            # Last set fatigue: drop 1-2 reps
            if set_num == num_sets - 1:
                reps = max(4, reps - random.randint(1, 2))

            # Apply the causal multiplier — this is the signal SQL will find
            reps = clamp(round(reps * multiplier), 3, 15)

            sets_data.append({
                "set_number": set_num + 1,
                "weight":     weight,
                "reps":       reps,
                "completed":  True,
            })

        exercise_rows.append({
            "id":            str(uuid.uuid4()),
            "user_id":       user_id,
            "session_id":    session_id,
            "exercise_name": ex_name,
            "sets":          sets_data,
            "order_index":   order_idx,
        })

    return session, exercise_rows


def build_measurement_entries(day, day_idx, total_days, measurement_ids, user_id):
    """
    Weekly weigh-in on Mondays. Weight and body fat drift down realistically
    over 6 months — ~8 lbs lost, ~2% body fat reduced — with noise added
    so the trend isn't a perfect straight line.
    """
    if not day["log_measurement"]:
        return []

    progress = day_idx / total_days   # 0.0 at Jan 1, 1.0 at Jun 30

    weight  = STARTING_WEIGHT_LBS  - (8.0 * progress) + random.uniform(-1.2, 1.2)
    bodyfat = STARTING_BODYFAT_PCT - (2.0 * progress) + random.uniform(-0.4, 0.4)

    logged_at = datetime.combine(day["date"], datetime.min.time()).replace(
        hour=7, minute=random.randint(0, 15)
    ).isoformat()

    entries = []

    if measurement_ids.get(MEAS_WEIGHT):
        entries.append({
            "id":             str(uuid.uuid4()),
            "user_id":        user_id,
            "measurement_id": measurement_ids[MEAS_WEIGHT],
            "value":          round(weight, 1),
            "unit":           "lbs",
            "logged_at":      logged_at,
        })

    if measurement_ids.get(MEAS_BODYFAT):
        entries.append({
            "id":             str(uuid.uuid4()),
            "user_id":        user_id,
            "measurement_id": measurement_ids[MEAS_BODYFAT],
            "value":          round(bodyfat, 1),
            "unit":           "%",
            "logged_at":      logged_at,
        })

    # Waist measured only on the first Monday of each month
    if day["date"].day <= 7 and measurement_ids.get(MEAS_WAIST):
        waist = 34.0 - (1.5 * progress) + random.uniform(-0.3, 0.3)
        entries.append({
            "id":             str(uuid.uuid4()),
            "user_id":        user_id,
            "measurement_id": measurement_ids[MEAS_WAIST],
            "value":          round(waist, 1),
            "unit":           "in",
            "logged_at":      logged_at,
        })

    return entries


def build_daily_habit(day, user_id):
    """
    One row per day in daily_habits capturing sleep and steps.
    Sleep data here is what the SQL analysis will join against workout volume.
    """
    steps = random.randint(4000, 9000) if not day["bad_week"] else random.randint(2000, 5000)

    return {
        "id":          str(uuid.uuid4()),
        "user_id":     user_id,
        "date":        day["date"].isoformat(),
        "sleep_hours": day["sleep_hours"],
        "sleep_score": day["sleep_score"],
        "steps":       steps,
        "notes":       None,
    }

# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    from supabase import create_client

    print("Connecting to Supabase...")
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # ── Fetch routine IDs from your actual routines table ──────────────────
    # The script looks up "Push", "Pull", "Legs" by name so you don't need
    # to hardcode UUIDs. Your routines must exist in the app before running.
    print("Fetching routine IDs...")
    routines_result = sb.table("routines").select("id, name").eq("user_id", USER_ID).execute()
    for row in routines_result.data:
        ROUTINE_IDS[row["name"]] = row["id"]
    print(f"  Found: {list(ROUTINE_IDS.keys())}")

    missing_routines = [r for r in ["Push", "Pull", "Legs"] if r not in ROUTINE_IDS]
    if missing_routines:
        print(f"\n  ERROR: Routines not found in DB: {missing_routines}")
        print("  Create routines named exactly 'Push', 'Pull', 'Legs' in the app first.")
        return

    # ── Fetch measurement IDs ──────────────────────────────────────────────
    print("Fetching measurement IDs...")
    meas_result = sb.table("measurements").select("id, name").eq("user_id", USER_ID).execute()
    measurement_ids = {row["name"]: row["id"] for row in meas_result.data}
    print(f"  Found: {list(measurement_ids.keys())}")

    missing_meas = [m for m in [MEAS_WEIGHT, MEAS_BODYFAT, MEAS_WAIST] if m not in measurement_ids]
    if missing_meas:
        print(f"\n  WARNING: Measurements not found: {missing_meas}")
        print("  Create them in the app first. Continuing — they will be skipped.\n")

    # ── Generate daily plan ────────────────────────────────────────────────
    print(f"Generating daily plan ({START_DATE} → {END_DATE})...")
    days = generate_daily_plan(START_DATE, END_DATE)
    total_days = len(days)
    print(f"  {total_days} days generated")

    # ── Build all rows ────────────────────────────────────────────────────
    food_rows        = []
    session_rows     = []
    exercise_rows    = []
    measurement_rows = []
    habit_rows       = []

    for i, day in enumerate(days):
        food_rows.extend(build_food_entries(day, USER_ID))

        session, exs = build_workout_session(day, i, days, USER_ID)
        if session:
            session_rows.append(session)
            exercise_rows.extend(exs)

        measurement_rows.extend(
            build_measurement_entries(day, i, total_days, measurement_ids, USER_ID)
        )

        habit_rows.append(build_daily_habit(day, USER_ID))

    print(f"\nRows to insert:")
    print(f"  food_entries:        {len(food_rows)}")
    print(f"  workout_sessions:    {len(session_rows)}")
    print(f"  session_exercises:   {len(exercise_rows)}")
    print(f"  measurement_entries: {len(measurement_rows)}")
    print(f"  daily_habits:        {len(habit_rows)}")

    # ── Insert in batches of 100 ──────────────────────────────────────────
    # Supabase has request size limits — batching avoids hitting them
    def batch_insert(table, rows, batch_size=100):
        inserted = 0
        for start in range(0, len(rows), batch_size):
            chunk = rows[start:start + batch_size]
            sb.table(table).insert(chunk).execute()
            inserted += len(chunk)
        print(f"  Inserted {inserted} rows → {table}")

    print("\nInserting...")
    batch_insert("food_entries",        food_rows)
    batch_insert("workout_sessions",    session_rows)
    batch_insert("session_exercises",   exercise_rows)
    batch_insert("measurement_entries", measurement_rows)
    batch_insert("daily_habits",        habit_rows)

    print("\nDone. Verify row counts in Supabase Table Editor before writing SQL.")


if __name__ == "__main__":
    main()
