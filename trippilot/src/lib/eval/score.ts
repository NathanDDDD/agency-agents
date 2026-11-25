// Deterministic quality checks for a generated itinerary. Used by
// scripts/eval-itinerary.ts. Each check returns a 0..1 score plus details.
import type { AIItinerary } from "../schemas";
import { findCityCenter } from "../geo";
import { distanceKm } from "../geocode";

export interface EvalCase {
  id: string;
  destinations: string[];
  days: number;
  travelers: number;
  party: string;
  budget: number;
  currency: string;
  pace: "relaxed" | "balanced" | "packed";
  interests: string[];
  description: string;
  accessibility?: string;
  edited?: {
    day: number;
    name: string;
    slot: "morning" | "afternoon" | "evening";
    time: string;
    is_restaurant: boolean;
    category: string;
    address: string;
    lat: number;
    lng: number;
  }[];
}

export interface CheckResult {
  name: string;
  score: number; // 0..1
  detail: string;
}

/** Non-restaurant activities per full day allowed for each pace. */
export const PACE_BOUNDS = { relaxed: [1, 4], balanced: [2, 5], packed: [3, 8] } as const;

/** Radius around a destination's center that counts as "in the area". */
const AREA_KM = 120;

const ratio = (ok: number, total: number) => (total === 0 ? 1 : ok / total);

export function scoreItinerary(c: EvalCase, it: AIItinerary): CheckResult[] {
  const results: CheckResult[] = [];
  const days = it.days;
  const acts = days.flatMap((d) => d.activities.map((a) => ({ a, d })));
  const fullDays = days.filter((d) => d.day_number !== 1 && d.day_number !== c.days);

  results.push({
    name: "day_count",
    score: days.length === c.days && days.every((d, i) => d.day_number === i + 1) ? 1 : 0,
    detail: `${days.length}/${c.days} days`,
  });

  const mealDays = fullDays.filter(
    (d) =>
      d.activities.some((a) => a.is_restaurant && a.slot === "afternoon") &&
      d.activities.some((a) => a.is_restaurant && a.slot === "evening"),
  ).length;
  results.push({ name: "lunch_and_dinner", score: ratio(mealDays, fullDays.length), detail: `${mealDays}/${fullDays.length} full days` });

  const [lo, hi] = PACE_BOUNDS[c.pace];
  const paceOk = fullDays.filter((d) => {
    const n = d.activities.filter((a) => !a.is_restaurant).length;
    return n >= lo && n <= hi;
  }).length;
  results.push({ name: "pace", score: ratio(paceOk, fullDays.length), detail: `${paceOk}/${fullDays.length} days within ${lo}-${hi} sights (${c.pace})` });

  const total = acts.reduce((s, { a }) => s + (a.estimated_cost ?? 0), 0);
  results.push({
    name: "budget",
    score: total <= c.budget * 1.05 ? 1 : Math.max(0, 1 - (total - c.budget) / c.budget),
    detail: `activities ~${Math.round(total)} vs budget ${c.budget} ${c.currency}`,
  });

  const centers = c.destinations.map(findCityCenter).filter((x): x is [number, number] => Boolean(x));
  const withCoords = acts.filter(({ a }) => a.latitude !== null && a.longitude !== null);
  const inArea = centers.length
    ? withCoords.filter(({ a }) => centers.some((ctr) => distanceKm(ctr, [a.latitude!, a.longitude!]) <= AREA_KM)).length
    : withCoords.length;
  results.push({ name: "coords_in_area", score: ratio(inArea, withCoords.length), detail: `${inArea}/${withCoords.length} within ${AREA_KM} km` });
  results.push({ name: "coords_coverage", score: Math.min(1, ratio(withCoords.length, acts.length) / 0.8), detail: `${withCoords.length}/${acts.length} have coordinates` });

  const names = acts.map(({ a }) => a.name.trim().toLowerCase());
  const dupes = names.length - new Set(names).size;
  results.push({ name: "no_duplicates", score: dupes === 0 ? 1 : Math.max(0, 1 - dupes / names.length), detail: `${dupes} repeated` });

  const urls = acts.filter(({ a }) => a.booking_url);
  const goodUrls = urls.filter(({ a }) => /^https:\/\/[^\s/]+\.[^\s]+$/.test(a.booking_url!)).length;
  results.push({ name: "valid_urls", score: ratio(goodUrls, urls.length), detail: `${goodUrls}/${urls.length} https URLs` });

  const timed = acts.filter(({ a }) => a.suggested_time && /^\d{2}:\d{2}$/.test(a.suggested_time)).length;
  const ordered = days.filter((d) => {
    const t = d.activities.map((a) => a.suggested_time).filter(Boolean) as string[];
    return t.every((x, i) => i === 0 || x >= t[i - 1]);
  }).length;
  results.push({ name: "timed_and_ordered", score: (ratio(timed, acts.length) + ratio(ordered, days.length)) / 2, detail: `${timed}/${acts.length} timed, ${ordered}/${days.length} days in order` });

  if (c.destinations.length > 1) {
    const cities = days.map((d) => d.city.toLowerCase());
    const covered = c.destinations.filter((dest) => cities.some((city) => city.includes(dest.toLowerCase().split(",")[0]))).length;
    results.push({ name: "all_destinations", score: ratio(covered, c.destinations.length), detail: `${covered}/${c.destinations.length} destinations used` });
  }

  if (c.edited?.length) {
    const kept = c.edited.filter((e) =>
      days.find((d) => d.day_number === e.day)?.activities.some((a) => a.name.trim().toLowerCase() === e.name.toLowerCase()),
    ).length;
    results.push({ name: "preserves_edits", score: ratio(kept, c.edited.length), detail: `${kept}/${c.edited.length} kept on the same day` });
  }

  return results;
}

export function overall(results: CheckResult[]) {
  return results.reduce((s, r) => s + r.score, 0) / Math.max(results.length, 1);
}
