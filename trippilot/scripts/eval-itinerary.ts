/**
 * Itinerary quality benchmark.
 *
 *   npm run eval:itinerary -- --demo                # free: scores the demo planner (wiring check)
 *   npm run eval:itinerary                          # live Claude (needs ANTHROPIC_API_KEY, costs money)
 *   npm run eval:itinerary -- --only=paris-family   # one case
 *   npm run eval:itinerary -- --verify-places       # also geocode each place to check it exists (slow: 1 req/s)
 *
 * Results are written to evals/itinerary/results/<timestamp>-<mode>.json.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateItinerary, AI_MODEL, isAIConfigured } from "../src/lib/ai/claude";
import { demoItinerary } from "../src/lib/demo/ai";
import { toDay } from "../src/lib/ai/convert";
import { aiItinerarySchema, type AIItinerary } from "../src/lib/schemas";
import { overall, scoreItinerary, type CheckResult, type EvalCase } from "../src/lib/eval/score";
import { geocode } from "../src/lib/server/geocoder";
import { distanceKm } from "../src/lib/geocode";
import { addDays, nowIso } from "../src/lib/utils";
import type { Activity, ItineraryDay, Trip, TripBundle, TravelPreferences } from "../src/lib/types";

// Claude Opus 5.5 list prices per million tokens (for the cost estimate only).
const PRICE = { input: 4, output: 20 };

const args = process.argv.slice(2);
const demo = args.includes("--demo");
const verifyPlaces = args.includes("--verify-places");
const only = args.find((a) => a.startsWith("--only="))?.slice(7);
const concurrency = Number(args.find((a) => a.startsWith("--concurrency="))?.slice(14) ?? 3);

const root = path.resolve(__dirname, "..");
const cases = (JSON.parse(readFileSync(path.join(root, "evals/itinerary/cases.json"), "utf8")) as EvalCase[]).filter(
  (c) => !only || c.id === only,
);

function bundleFor(c: EvalCase): TripBundle {
  const start = "2027-05-10";
  const ts = nowIso();
  const trip: Trip = {
    id: `eval-${c.id}`,
    user_id: "eval",
    name: c.id,
    destinations: c.destinations,
    start_date: start,
    end_date: addDays(start, c.days - 1),
    travelers: c.travelers,
    travel_party: c.party as Trip["travel_party"],
    budget: c.budget,
    currency: c.currency,
    budget_excludes_flights: true,
    pace: c.pace,
    interests: c.interests,
    description: c.description,
    special_requests: c.accessibility ?? "",
    cover_image: null,
    itinerary_source: c.edited ? "ai" : "manual",
    created_at: ts,
    updated_at: ts,
  };
  // Pre-existing itinerary containing traveler-edited activities.
  const days: ItineraryDay[] = [];
  for (const e of c.edited ?? []) {
    let day = days.find((d) => d.day_number === e.day);
    if (!day) {
      day = toDay(
        { day_number: e.day, date: "", city: c.destinations[0], title: "", summary: "", morning_summary: "", afternoon_summary: "", evening_summary: "", transport_notes: "", notes: "", estimated_cost: null, activities: [] },
        { trip, index: e.day - 1, source: "ai" },
      );
      days.push(day);
    }
    const a: Activity = {
      id: `edited-${e.day}-${day.activities.length}`,
      day_id: day.id,
      trip_id: trip.id,
      name: e.name,
      description: "",
      category: e.category as Activity["category"],
      is_restaurant: e.is_restaurant,
      slot: e.slot,
      suggested_time: e.time,
      duration_minutes: 90,
      estimated_cost: null,
      address: e.address,
      latitude: e.lat,
      longitude: e.lng,
      booking_url: null,
      notes: "",
      completed: false,
      sort_order: day.activities.length,
      source: "user",
      user_modified: true,
      created_at: ts,
      updated_at: ts,
    };
    day.activities.push(a);
  }
  return { trip, days: days.sort((a, b) => a.day_number - b.day_number), bookings: [], expenses: [], messages: [], savedPlaces: [] };
}

function prefsFor(c: EvalCase): TravelPreferences {
  return {
    travel_style: c.budget / c.days / Math.max(c.travelers, 1) > 300 ? "luxury" : "balanced",
    budget_range: "3k-6k",
    accommodation: "boutique-hotel",
    food_preferences: /vegetarian/i.test(c.description) ? ["Vegetarian", "Local cuisine"] : ["Local cuisine"],
    activities: c.interests,
    pace: c.pace,
    travel_party: c.party as TravelPreferences["travel_party"],
    preferred_destinations: [],
    accessibility_needs: c.accessibility ?? "",
  };
}

async function placeCheck(it: AIItinerary): Promise<CheckResult> {
  const acts = it.days.flatMap((d) => d.activities.filter((a) => a.latitude !== null && a.longitude !== null).map((a) => ({ a, d })));
  let found = 0;
  let near = 0;
  for (const { a, d } of acts) {
    const hit = await geocode(a.name.replace(/^(dinner|lunch|drinks|cocktails|aperitivo) at /i, ""), d.city).catch(() => null);
    if (!hit) continue;
    found++;
    if (distanceKm([hit.latitude, hit.longitude], [a.latitude!, a.longitude!]) <= 2) near++;
  }
  return {
    name: "places_verified",
    score: acts.length ? near / acts.length : 1,
    detail: `${found}/${acts.length} found by name, ${near} within 2 km of the AI's coordinates`,
  };
}

interface CaseResult {
  id: string;
  ok: boolean;
  error?: string;
  score: number;
  checks: CheckResult[];
  seconds: number;
  usage?: { input_tokens: number; output_tokens: number } | null;
  itinerary?: AIItinerary;
}

async function runCase(c: EvalCase): Promise<CaseResult> {
  const started = Date.now();
  try {
    const bundle = bundleFor(c);
    let itinerary: AIItinerary;
    let usage: CaseResult["usage"] = null;
    if (demo) {
      itinerary = demoItinerary(bundle);
    } else {
      const res = await generateItinerary(bundle, prefsFor(c));
      itinerary = res.data;
      usage = res.usage;
    }
    if (!aiItinerarySchema.safeParse(itinerary).success) throw new Error("Output failed schema validation");
    const checks = scoreItinerary(c, itinerary);
    if (verifyPlaces) checks.push(await placeCheck(itinerary));
    return { id: c.id, ok: true, score: overall(checks), checks, seconds: (Date.now() - started) / 1000, usage, itinerary };
  } catch (err) {
    return { id: c.id, ok: false, error: err instanceof Error ? err.message : String(err), score: 0, checks: [], seconds: (Date.now() - started) / 1000 };
  }
}

async function main() {
  if (!demo && !isAIConfigured()) {
    console.error("ANTHROPIC_API_KEY is not set. Use --demo for a free wiring check, or set the key to run live.");
    process.exit(1);
  }
  const mode = demo ? "demo" : AI_MODEL;
  console.log(`Running ${cases.length} case(s) against ${mode}${verifyPlaces ? " with place verification" : ""}…\n`);

  const results: CaseResult[] = [];
  const queue = [...cases];
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        const r = await runCase(c);
        results.push(r);
        const weakest = r.checks.filter((x) => x.score < 1).map((x) => `${x.name} ${(x.score * 100).toFixed(0)}%`).join(", ");
        console.log(`${r.ok ? "✓" : "✗"} ${r.id.padEnd(26)} ${(r.score * 100).toFixed(0).padStart(3)}%  ${r.seconds.toFixed(0)}s  ${r.error ?? weakest}`);
      }
    }),
  );

  results.sort((a, b) => cases.findIndex((c) => c.id === a.id) - cases.findIndex((c) => c.id === b.id));
  const mean = results.reduce((s, r) => s + r.score, 0) / Math.max(results.length, 1);
  const byCheck = new Map<string, number[]>();
  for (const r of results) for (const ch of r.checks) byCheck.set(ch.name, [...(byCheck.get(ch.name) ?? []), ch.score]);
  const tokens = results.reduce(
    (s, r) => ({ input: s.input + (r.usage?.input_tokens ?? 0), output: s.output + (r.usage?.output_tokens ?? 0) }),
    { input: 0, output: 0 },
  );
  const cost = (tokens.input * PRICE.input + tokens.output * PRICE.output) / 1_000_000;

  console.log(`\nOverall: ${(mean * 100).toFixed(1)}%  (${results.filter((r) => r.ok).length}/${results.length} succeeded)`);
  for (const [name, scores] of byCheck) {
    console.log(`  ${name.padEnd(20)} ${((scores.reduce((a, b) => a + b, 0) / scores.length) * 100).toFixed(0).padStart(3)}%`);
  }
  if (!demo) console.log(`\nTokens: ${tokens.input} in / ${tokens.output} out, about $${cost.toFixed(2)} at Opus 5.5 list prices.`);

  const outDir = path.join(root, "evals/itinerary/results");
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${demo ? "demo" : "live"}.json`);
  writeFileSync(file, JSON.stringify({ model: mode, mean, tokens, cost_usd: demo ? 0 : cost, results }, null, 2));
  console.log(`\nSaved ${path.relative(root, file)}`);
}

void main();
