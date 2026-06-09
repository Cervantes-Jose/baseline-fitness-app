# Baseline Fitness

**A full-stack fitness tracking PWA built from scratch — food logging, workout tracking, body measurements, and nutrition analytics in one place.**

**Live Demo:** [fitness-app-ebon-six.vercel.app](https://fitness-app-ebon-six.vercel.app)  
**Stack:** React · Supabase · PostgreSQL · Supabase Edge Functions · Vercel

---

## About This Project

Baseline Fitness was built to solve a real personal problem: no existing fitness app combined food logging, workout tracking, and body measurements in a single clean interface without a bloated feature set or a steep monthly fee.

This project was developed independently from scratch with no prior coding experience, using modern AI-assisted development tools as part of the workflow — the same way many professional developers now build software. Every product decision, architecture choice, and feature was driven by genuine personal need and hands-on learning. The result is a production-ready application with real users, real security, and real infrastructure.

---

## Features

### Food Log
- USDA FoodData Central food search via secure backend proxy
- Barcode scanner using ZXing + Open Food Facts API
- Full food detail screen with serving size adjustment and real-time macro recalculation
- Micronutrient tracking (fiber, sodium, vitamins, minerals)
- Custom food creation with saved serving sizes
- Favorites, Meals (saved meal combinations), and Recent foods
- Hourly food timeline with macro summary per hour
- Multi-select, copy, and move food entries across hours and dates

### Workout Tracker
- Custom routines with drag-to-reorder exercises
- Active workout logging modal with live timer, volume tracking, and set completion
- Rest timers between sets with configurable intervals
- Superset grouping with automatic exercise advancement
- Exercise database with 200+ exercises across muscle groups
- Custom exercise creation
- Full workout history with calendar view

### Measurements
- Custom measurement tracking (Weight, Body Fat, Arms, Waist, and more)
- Trend charts with 7-day and 14-day views
- Color-coded sparklines per measurement
- Entry history with edit and delete

### Nutrition Analytics
- Micronutrient trend tracking over 14 days
- Per-nutrient detail view with history
- Food log mini-view to investigate nutrient dips — see exactly what you ate on any given day

### Dashboard
- Daily calorie and protein progress rings
- Macro progress bars (Protein, Fats, Carbs)
- Weight and Body Fat trend charts
- Weekly workout stats (volume, duration, count)
- Day streak tracking (food + workout activity)

### Authentication & Security
- Email/password authentication via Supabase Auth
- Row Level Security (RLS) on all 12 database tables — users can only access their own data
- Password reset flow with email verification
- Session persistence with automatic token refresh

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Create React App) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Backend Functions | Supabase Edge Functions (Deno) |
| Hosting | Vercel |
| Version Control | Git + GitHub |

### Key Libraries
- `@zxing/library` — barcode scanning from camera
- `@dnd-kit` — drag-to-reorder with touch sensor support
- Open Food Facts API — packaged food barcode lookup
- USDA FoodData Central API — nutrition data for whole foods

---

## Architecture Highlights

### Secure API Proxy (Edge Functions)
The USDA FoodData Central API requires an API key. Rather than exposing it in the client bundle, all food search requests are proxied through a Supabase Edge Function running server-side on Deno. The API key is stored as a Supabase secret and never touches the frontend.

```
React App → Supabase Edge Function → USDA API
```

### Row Level Security
Every one of the 12 database tables has RLS enabled with policies that restrict all reads and writes to the authenticated user's own rows. No user can access another user's data — enforced at the database level, not just the application layer.

### PWA
The app is configured as a Progressive Web App — installable on Android home screen, runs fullscreen without a browser address bar, and includes a service worker for update notifications.

---

## Database Schema

12 tables with full RLS:

- `food_entries` — daily food log with macro and micronutrient snapshots
- `routines` — user workout routines
- `exercises` — exercises within routines, with position ordering and rest timer config
- `workout_sessions` — completed workout history
- `session_exercises` — per-exercise sets/reps/weight for each session
- `measurements` — custom measurement types
- `measurement_entries` — logged measurement values over time
- `custom_exercises` — user-created exercises
- `custom_foods` — user-created foods with saved serving sizes and micronutrients
- `favorite_foods` — favorited food snapshots for quick logging
- `meals` — saved meal combinations with component foods
- `user_goals` — calorie and macro targets

---

## Running Locally

```bash
git clone https://github.com/Cervantes-Jose/fitness-app
cd fitness-app
npm install
npm start
```

The app connects to a live Supabase backend. Food search requires the Supabase Edge Function to be deployed with a valid USDA API key.

---

## Development Approach

This project was built using AI-assisted development tools — specifically Claude — as a core part of the workflow. This reflects how modern software development increasingly works: AI tools handle implementation details and boilerplate while the developer drives product decisions, architecture, security design, and quality control.

Every feature in this app was independently scoped and decided. Every security decision — RLS design, API key handling, auth flow — was deliberately chosen and understood. The AI accelerated the build; the product thinking, problem definition, and technical judgment were entirely human.

This is the same workflow used at many professional software teams today. Knowing how to effectively direct AI tools to produce production-quality, secure, maintainable code is itself a modern engineering skill.

---

## Roadmap

- [ ] Google Play Store release via TWA
- [ ] Samsung Health / Apple Health integration
- [ ] Community food database (user-submitted foods shared across accounts)
- [ ] Subscription tier with Stripe
- [ ] Rest timer countdown in active workouts

---

## Author

**Jose Cervantes** — Data Operations & Reporting Specialist  
Atlanta, GA · [LinkedIn](https://linkedin.com/in/jose-cervantes-)  

Built by Baseline Studios
