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
| AI planning | Structured itinerary from Claude, validated with Zod, plus regeneration of the whole itinerary, a single day, a single activity, or a restaurant. Traveler edits are always preserved |
| Itinerary | Day-by-day, chronological, drag-and-drop reordering (mouse, touch, keyboard), add, edit, delete, move to another day, mark done, notes, transport tips, source badges (AI / demo / added by you / edited) |
| Map | Leaflet map, markers coloured by day, restaurants in gold, dashed route per day, day filter, marker to details card, list item to marker, directions link. Provider-agnostic |
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
│  │     ├─ ai/plan            Full itinerary generation
│  │     ├─ ai/regenerate      Day / activity regeneration
│  │     ├─ ai/chat            Concierge
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
│     └─ parse-prompt.ts       Deterministic NL → form extraction
└─ tests/e2e.cjs               Playwright smoke test of all core flows
```

**Key decisions**

- **One data contract, two backends.** The UI talks to `DataRepository`. `SupabaseRepository` uses supabase-js in the browser, protected by Row Level Security. `LocalRepository` keeps demo data in `localStorage`. Records use client-generated UUIDs, so both behave the same.
- **Stateless AI routes.** The client sends the trip snapshot. The server calls Claude, validates the output with Zod and returns it. The client converts, merges and persists it under RLS. API keys never reach the browser.
- **Live AI only for signed-in users.** When Supabase is configured, `/api/ai/*` serves live Claude only to authenticated users (rate-limited per user). Anonymous demo visitors get labelled demo responses.
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

`profiles`, `trips`, `trip_members` (sharing, P2), `trip_preferences`, `itinerary_days`, `activities`, `bookings`, `expenses`, `saved_places`, `chat_messages`, plus a private `booking-documents` storage bucket.

- `trip_preferences` with `trip_id IS NULL` holds the traveler's default preferences. Rows with a `trip_id` are reserved for per-trip overrides.
- Access helpers `can_read_trip()` / `can_write_trip()` grant owners full access and trip members read (viewer) or write (editor) access. Chat stays private per user even on shared trips.
- A trigger creates a `profiles` row on sign-up.

---

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

What each combination gives you:

| Supabase | Anthropic | Result |
|---|---|---|
| ✗ | ✗ | Full demo: local data, scripted AI (labelled) |
| ✗ | ✓ | Local data + live AI (good for local development) |
| ✓ | ✗ | Real accounts and data; AI features use labelled demo responses |
| ✓ | ✓ | Production: real accounts, live AI for signed-in users |

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migration, either:
   - **SQL editor:** paste `supabase/migrations/20261125000000_initial_schema.sql` and run it, or
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
npm run test:e2e    # Playwright smoke test against BASE_URL (default http://localhost:3000)
```

`test:e2e` needs a running server (`npm run build && npm start`) and a Playwright Chromium (`npx playwright install chromium`). It covers: landing page, demo entry, dashboard, overview, itinerary edit/complete/add, day and activity regeneration (edits preserved), map markers and focus, bookings, budget, concierge Q&A and proposal apply, persistence across reloads, creating a trip from a natural-language prompt and generating it, settings, and mobile layout.

---

## Deployment (Vercel)

1. Import the repository in Vercel and set **Root Directory** to `trippilot`.
2. Framework preset: Next.js (auto-detected). Build command `npm run build`.
3. Add the environment variables above (Production and Preview).
4. Deploy, then add `https://<your-domain>/auth/callback` to Supabase Redirect URLs and set `NEXT_PUBLIC_SITE_URL`.
5. AI routes declare `maxDuration = 300`. On plans with lower limits, long itineraries may time out (see Known issues).

---

## Known issues & next steps

- **Live AI not yet exercised end to end in CI.** The Claude request path is verified up to authentication (an invalid key returns a clean 401 → 500 error). A real-key run should be done before user testing. It is the first item on the checklist.
- **Rate limiting is in-memory per instance.** Replace with Upstash/Redis or a Supabase table before public launch.
- **Function timeouts:** full-itinerary generation for long trips can approach serverless limits. Streaming progress to the client is a natural next step.
- **Weather** is a placeholder card (P1). Open-Meteo is a good keyless option.
- **Currency conversion** isn't implemented. Expenses in other currencies are flagged and excluded from totals.
- **Shared trips (P2)** are supported in the schema and RLS (`trip_members`), but have no invite UI yet.
- **Geocoding:** activities only appear on the map when the AI (or demo data) provides coordinates. Manually edited addresses clear stale coordinates. A geocoding step would fill these in.
- **Account deletion** is a support request for now.
- Photography is loaded from Unsplash. Every image falls back to a branded gradient if it fails.

### Roadmap

Phase 2 Intelligence (booking import, weather, smarter routes, live recommendations) → Phase 3 Monetization (Stripe, plans, limits) → Phase 4 Travel ecosystem (flights, hotels, affiliates, group trips) → Phase 5 Mobile (native app, push, offline wallet).
