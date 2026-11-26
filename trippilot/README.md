# TripPilot ✈️

**Your personal AI travel agent.** Explore freely. Plan intelligently.

TripPilot is an AI-powered travel planning SaaS. Travelers describe a trip in plain language and get a day-by-day itinerary with restaurants, timings, estimated costs and a map. They can edit it freely, store bookings, track a budget, and ask a concierge that knows the whole trip.

It runs end to end **with no credentials at all** in a clearly labelled demo mode. Add Supabase for real accounts and storage, and an Anthropic key for live AI.

---

## Features (Phase 1 MVP)

| Area | What works |
|---|---|
| Public site | Landing page (hero, interactive itinerary preview, features, how it works, UI previews, clearly-labelled placeholder testimonials, pricing, FAQ, CTA), Features, How it works, Pricing. SEO metadata, `robots.txt` and `sitemap.xml` |
| Auth | Sign up, log in, log out, password recovery and reset, protected routes (`proxy.ts`), profile. Supabase Auth |
| Onboarding | 4-step travel-preference setup (style, party, budget, stays, food, activities, pace, dream destinations, accessibility), saved to the DB and editable in Settings |
| Dashboard | Featured next trip, upcoming and past trips, saved places, recent activity, quick concierge access, empty state for new users |
| Create trip | Natural-language description with instant on-device extraction ("Fill in the details") plus a full validated form |
| AI planning | Structured itinerary from Claude, validated with Zod and **streamed day by day** (each day appears as soon as it's planned), plus regeneration of the whole itinerary, a single day, a single activity, or a restaurant. Traveler edits are always preserved |
| Itinerary | Day-by-day, chronological, drag-and-drop reordering (mouse, touch, keyboard), add, edit, delete, move to another day, mark done, notes, transport tips, source badges (AI / demo / added by you / edited) |
| Map | Leaflet map, markers coloured by day, restaurants in gold, dashed route per day, day filter, marker to details card, list item to marker, directions link. Provider-agnostic. Addresses are geocoded automatically when you add or edit a stop, and "Locate missing stops" places any AI suggestions that came without coordinates |
| AI usage limits | Per-traveler credits (rolling 24 h) and a 10-minute burst limit, enforced atomically in Postgres, with token usage recorded per request. Credits used are shown in Settings |
| Bookings | Flights, hotels, restaurants, activities, transport, car rental and other bookings, with confirmation numbers, dates, address, URL, cost, notes and private document uploads |
| Budget | Total, spent, planned, remaining, category breakdown bar, planned vs actual table, expense CRUD, AI itinerary estimate |
| AI Concierge | Chat that sees the trip, preferences, itinerary (with IDs), bookings, budget, saved places and history. Change requests come back as **proposals you approve or dismiss**; nothing changes without confirmation |
| Settings | Profile, travel preferences, notification preferences, account (password reset, sign out, demo reset) |
| Demo mode | Seeded 6-day Rome trip (luxury and food, couple) plus a past Lisbon trip, with itinerary, restaurants, bookings, budget and saved places. Scripted demo AI, labelled on every response |

Honesty rules are built in: AI costs are labelled as estimates, prompts forbid inventing availability, prices or hours, booking URLs are only kept when they are valid http(s) links, and demo content is never presented as live AI.

---

## Architecture

```
trippilot/
├─ supabase/migrations/        SQL schema, RLS policies, storage bucket
├─ src/
│  ├─ proxy.ts                 Session refresh + route protection (Next 16 "proxy", formerly middleware)
│  ├─ app/
│  │  ├─ (marketing)/          Public pages: /, /features, /how-it-works, /pricing
│  │  ├─ login, signup, forgot-password, reset-password, auth/callback
│  │  ├─ demo/route.ts         Sets the demo cookie and opens /app
│  │  ├─ onboarding/           Preference wizard
│  │  ├─ app/                  Authenticated app: dashboard, trips/new, trips/[id], settings
│  │  └─ api/
│  │     ├─ ai/plan            Full itinerary generation (streams NDJSON: start → day… → done)
│  │     ├─ ai/regenerate      Day / activity regeneration
│  │     ├─ ai/chat            Concierge
│  │     ├─ ai/usage           Today's AI credit usage for the signed-in traveler
│  │     ├─ geocode            Address → coordinates (Mapbox or Nominatim)
│  │     └─ status             Which integrations are live (no secrets)
│  ├─ components/
│  │  ├─ ui/                   Design-system primitives (Button, Field, Modal, Badge…)
│  │  ├─ marketing/ auth/ app/ forms/
│  │  ├─ trip/                 Trip dashboard + 6 tabs + TripProvider (state & actions)
│  │  └─ map/                  Provider-agnostic map contract + Leaflet implementation
│  └─ lib/
│     ├─ types.ts schemas.ts   Domain types, Zod schemas (AI output, API input, forms)
│     ├─ data/                 DataRepository interface, Local (demo) + Supabase implementations
│     ├─ ai/                   Claude client (server-only), prompts/context, guard, convert/merge
│     ├─ demo/                 Seed trips + scripted demo AI
│     ├─ eval/score.ts         Deterministic itinerary quality checks (benchmark)
│     ├─ geocode.ts            Geocoding request/response helpers (server/geocoder.ts does the calls)
│     └─ parse-prompt.ts       Deterministic NL → form extraction
├─ evals/itinerary/cases.json  15 benchmark trips for the itinerary quality eval
├─ scripts/eval-itinerary.ts   Runs the benchmark (demo or live)
├─ src/lib/__tests__/          Vitest unit tests
└─ tests/e2e.cjs               Playwright smoke test of all core flows
```

**Key decisions**

- **One data contract, two backends.** The UI talks to `DataRepository`. `SupabaseRepository` uses supabase-js in the browser, protected by Row Level Security. `LocalRepository` keeps demo data in `localStorage`. Records use client-generated UUIDs, so both behave the same.
- **Stateless AI routes.** The client sends the trip snapshot. The server calls Claude, validates the output with Zod and returns it. The client converts, merges and persists it under RLS. API keys never reach the browser.
- **Live AI only for signed-in users, metered.** When Supabase is configured, `/api/ai/*` serves live Claude only to authenticated users. Each request first calls the `consume_ai_quota()` Postgres function, which checks the traveler's credits and burst limit and records the request in `ai_usage` atomically. Travelers can't write to that table directly, so they can't reset their quota. If metering is unavailable (e.g. the migration hasn't been run), AI fails closed with a clear message. Anonymous demo visitors get labelled demo responses at no cost. Without Supabase (local dev), the same limits apply in memory per IP.
- **Streaming generation.** `/api/ai/plan` streams Claude's structured output. A small incremental parser (`lib/ai/stream-parser.ts`) emits each day as soon as its JSON object closes, the client renders it immediately, and the final fully-validated itinerary is what gets saved. Pings every 10 s keep proxies from closing the connection while the model thinks.
- **Edits are sacred.** Activities added, edited or completed by the traveler are flagged (`user_modified`, `source = "user"`) and preserved by every regeneration, both in the prompt and in a deterministic server-independent merge.
- **Confirm before change.** Concierge change requests return typed operations (`remove_activity`, `replace_activity`, `add_activity`). They are validated against real activity IDs, then shown as a proposal with Apply / Dismiss.
- **Swappable maps.** `components/map/types.ts` defines `TripMapProps`. The Leaflet implementation supports OSM/CARTO tiles (no key) or Mapbox tiles. Adding Google Maps means one new component that implements the same props.

**Stack:** Next.js 16 (App Router, Cache Components, Turbopack), React 19, TypeScript, Tailwind CSS 4, Supabase (`@supabase/ssr`), Anthropic TypeScript SDK, Zod 4, React Hook Form, Leaflet, dnd-kit, Sonner, Lucide.

**AI model:** `claude-opus-5-5` by default (override with `ANTHROPIC_MODEL`), with adaptive thinking, structured outputs via `betaZodOutputFormat`, streaming (`finalMessage()`), and the server-side refusal fallback (`fallbacks: "default"`).

### Design system

| Token | Value |
|---|---|
| Midnight Navy | `#101C33` (`navy`) |
| Warm Ivory | `#F5F3EE` (`ivory`) |
| Pilot Blue | `#456CFF` (`pilot`) |
| Travel Gold | `#DDA96C` (`gold`) |
| Display font | Fraunces (editorial serif) |
| Body font | Plus Jakarta Sans |

Tokens live in `src/app/globals.css` (`@theme`). Shared patterns: rounded `card` utility, pill buttons, bottom-sheet modals on mobile, a bottom tab bar on mobile, and reduced-motion support.

### Database

Tables (all with UUID PKs, `created_at`/`updated_at`, ownership and RLS):

`profiles`, `trips`, `trip_members` (sharing, P2), `trip_preferences`, `itinerary_days`, `activities`, `bookings`, `expenses`, `saved_places`, `chat_messages`, `ai_usage`, plus a private `booking-documents` storage bucket.

- `trip_preferences` with `trip_id IS NULL` holds the traveler's default preferences. Rows with a `trip_id` are reserved for per-trip overrides.
- Access helpers `can_read_trip()` / `can_write_trip()` grant owners full access and trip members read (viewer) or write (editor) access. Chat stays private per user even on shared trips.
- A trigger creates a `profiles` row on sign-up.

---

## Go live in one command

On your own computer (Node 22+):

```bash
git clone -b claude/trippilot-mvp-build-j5gott https://github.com/nathandddd/agency-agents.git
cd agency-agents/trippilot
npm install
npm run go-live
```

`go-live` walks you through everything and is safe to re-run:

1. Asks for your Supabase URL and anon key and your Anthropic key, then writes `.env.local` (git-ignored, readable only by you).
2. Checks both keys with free API calls.
3. Applies both migrations with the Supabase CLI (from your database connection string, used once and not saved), or guides you through the SQL Editor. It then confirms the tables and the AI quota function exist.
4. Runs lint, typecheck, unit tests and a production build.
5. Starts the app locally and confirms live mode, so you can sign up and plan a real trip.
6. Deploys to Vercel: login, link, copy the environment variables, deploy, then set `NEXT_PUBLIC_SITE_URL` and redeploy.
7. Offers the live quality benchmark (default **no**; about $4–6 for a full run).

It can't do one step for you: in Supabase, under Authentication → URL Configuration, set the Site URL and add `<your-url>/**` to Redirect URLs. The script prints the exact values.

Before you start, create accounts on [Supabase](https://supabase.com) (new project), [Anthropic](https://console.anthropic.com) (API key, with billing set up) and [Vercel](https://vercel.com) (free Hobby plan is fine).

## Getting started

Requirements: Node.js 20.9+ (22 recommended) and npm.

```bash
cd trippilot
npm install
cp .env.example .env.local   # optional, the app runs in demo mode without it
npm run dev                  # http://localhost:3000
```

Open http://localhost:3000 and click **Explore the demo**.

### Environment variables

| Variable | Required | Where it's used |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Recommended in production | Metadata, sitemap |
| `NEXT_PUBLIC_SUPABASE_URL` | For real accounts | Browser + server Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For real accounts | Browser + server Supabase clients (safe to expose; RLS enforces access) |
| `ANTHROPIC_API_KEY` | For live AI | **Server only** (`src/lib/ai/claude.ts`) |
| `ANTHROPIC_MODEL` | No | Model override (default `claude-opus-5-5`) |
| `NEXT_PUBLIC_MAP_PROVIDER` | No | `osm` (default) or `mapbox` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Only with Mapbox | Mapbox tiles (use a URL-restricted public token) |
| `AI_DAILY_CREDIT_LIMIT` | No | Credits per traveler per 24 h (default 60) |
| `AI_BURST_LIMIT` | No | AI requests per 10 minutes (default 20) |
| `MAPBOX_TOKEN` | No | Server-side Mapbox geocoding (otherwise Nominatim) |
| `GEOCODER_CONTACT_EMAIL` | Recommended with Nominatim | Your contact in the Nominatim User-Agent, per its usage policy |

What each combination gives you:

| Supabase | Anthropic | Result |
|---|---|---|
| ✗ | ✗ | Full demo: local data, scripted AI (labelled) |
| ✗ | ✓ | Local data + live AI (good for local development) |
| ✓ | ✗ | Real accounts and data; AI features use labelled demo responses |
| ✓ | ✓ | Production: real accounts, live AI for signed-in users |

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run both migrations in order, either:
   - **SQL editor:** paste and run `supabase/migrations/20261125000000_initial_schema.sql`, then `20261126000000_ai_usage_quota.sql`, or
   - **CLI:** `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. **Authentication → URL configuration:** set the Site URL to your domain, and add `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback` to Redirect URLs.
4. Copy the project URL and anon key into `.env.local`.
5. Optional: under **Authentication → Providers → Email**, disable "Confirm email" for faster testing. Sign-up then logs you straight in.

### Anthropic setup

Create a key at [console.anthropic.com](https://console.anthropic.com) and set `ANTHROPIC_API_KEY`. Generating a 6-day itinerary typically takes 20–60 seconds. Routes allow up to 300 s (`maxDuration`).

---

## Scripts

```bash
npm run dev         # development server
npm run build       # production build
npm start           # serve the production build
npm run lint        # ESLint
npm run typecheck   # route type generation + tsc --noEmit
npm test            # Vitest unit tests
npm run test:e2e    # Playwright smoke test against BASE_URL (default http://localhost:3000)
npm run eval:itinerary -- --demo   # itinerary quality benchmark (see below)
```

**CI:** `.github/workflows/trippilot-ci.yml` (repo root) runs lint, typecheck, unit tests, build and the end-to-end suite on every push or PR that touches `trippilot/`.

### Itinerary quality benchmark

`evals/itinerary/cases.json` holds 15 realistic trips, including multi-city, family, vegetarian, accessibility, budget, business and one "keep my edits" case. `npm run eval:itinerary` generates each one and scores it with deterministic checks (`src/lib/eval/score.ts`):

| Check | What it catches |
|---|---|
| `day_count` | Wrong number of days |
| `lunch_and_dinner` | Full days missing a lunch or dinner pick |
| `pace` | Too many or too few sights for relaxed / balanced / packed |
| `budget` | Activity estimates exceeding the trip budget |
| `coords_in_area` / `coords_coverage` | Coordinates outside the destination, or missing |
| `no_duplicates` | The same place suggested twice |
| `valid_urls` | Malformed booking links |
| `timed_and_ordered` | Missing times, or out-of-order days |
| `all_destinations` | Multi-city trips that skip a city |
| `preserves_edits` | The model dropping activities the traveler edited |
| `places_verified` (`--verify-places`) | Places that can't be found by name near the AI's coordinates (a check for invented places; slow, 1 lookup/second) |

Modes: `--demo` (free, checks the wiring), live (needs `ANTHROPIC_API_KEY`; roughly $0.25–0.40 per trip on Opus 5.5, so about $4–6 per full run; the script prints actual token cost), `--only=<case-id>`, `--concurrency=N`. Results are saved to `evals/itinerary/results/` (git-ignored). Run it before and after any prompt or model change and compare the per-check scores.

`test:e2e` needs a running server (`npm run build && npm start`) and a Playwright Chromium (`npx playwright install chromium`). It covers: landing page, demo entry, dashboard, overview, itinerary edit/complete/add, day and activity regeneration (edits preserved), geocoding with a mocked lookup (unknown address → no pin → "Locate missing stops"), map markers and focus, bookings, budget, concierge Q&A and proposal apply, persistence across reloads, creating a trip from a natural-language prompt with streamed generation, settings, and mobile layout.

---

## Deployment (Vercel)

`npm run go-live` does all of this automatically. To do it by hand instead:

1. Import the repository in Vercel and set **Root Directory** to `trippilot`.
2. Framework preset: Next.js (auto-detected). Build command `npm run build`.
3. Add the environment variables above (Production and Preview).
4. Deploy, then add `https://<your-domain>/auth/callback` to Supabase Redirect URLs and set `NEXT_PUBLIC_SITE_URL`.
5. AI routes declare `maxDuration = 300`. On plans with lower limits, long itineraries may time out (see Known issues).

---

## Known issues & next steps

- **Live AI, Supabase metering and real geocoding haven't run against real services yet.** This environment has no keys and blocks the geocoding hosts. The Claude request path is verified up to authentication. The quota SQL and geocoding are covered by unit tests and mocked end-to-end tests. Do a real-key pass (and a first live benchmark run) before user testing.
- **Function time limits:** streaming fixes the long blank wait, but the whole generation must still finish within the platform's limit (`maxDuration = 300`).
- **Geocoding** uses in-memory caching and throttling per server instance. That's fine for a beta with Nominatim; switch to Mapbox (`MAPBOX_TOKEN`) or add a shared cache before larger traffic.
- **Weather** is a placeholder card (P1). Open-Meteo is a good keyless option.
- **Currency conversion** isn't implemented. Expenses in other currencies are flagged and excluded from totals.
- **Shared trips (P2)** are supported in the schema and RLS (`trip_members`), but have no invite UI yet.
- **Demo planner quality:** for cities outside the curated Rome/Florence library, demo itineraries reuse generic placeholders. This affects demo mode only.
- **Account deletion** is a support request for now.
- Photography is loaded from Unsplash. Every image falls back to a branded gradient if it fails.

### Roadmap

Phase 2 Intelligence (booking import, weather, smarter routes, live recommendations) → Phase 3 Monetization (Stripe, plans, limits) → Phase 4 Travel ecosystem (flights, hotels, affiliates, group trips) → Phase 5 Mobile (native app, push, offline wallet).
