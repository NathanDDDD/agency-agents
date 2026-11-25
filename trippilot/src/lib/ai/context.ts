// Builds a compact, model-friendly description of a trip. Used in prompts so
// the planner and concierge always reason over the traveler's real data.
import type { TravelPreferences, TripBundle } from "../types";
import { formatMoney, tripLength } from "../utils";

export function describePreferences(p: TravelPreferences | null): string {
  if (!p) return "No saved traveler preferences.";
  return [
    `Travel style: ${p.travel_style}`,
    `Typical budget range: ${p.budget_range}`,
    `Accommodation: ${p.accommodation}`,
    `Food: ${p.food_preferences.join(", ") || "no preference"}`,
    `Loves: ${p.activities.join(", ") || "open to anything"}`,
    `Pace: ${p.pace}`,
    `Usually travels as: ${p.travel_party}`,
    p.accessibility_needs ? `Accessibility needs: ${p.accessibility_needs}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function describeTrip(bundle: TripBundle): string {
  const t = bundle.trip;
  return [
    `Trip name: ${t.name}`,
    `Destinations: ${t.destinations.join(" → ")}`,
    `Dates: ${t.start_date} to ${t.end_date} (${tripLength(t.start_date, t.end_date)} days)`,
    `Travelers: ${t.travelers} (${t.travel_party})`,
    `Budget: ${formatMoney(t.budget, t.currency)} ${t.currency}${t.budget_excludes_flights ? " excluding flights" : ""}`,
    `Pace: ${t.pace}`,
    t.interests.length ? `Interests: ${t.interests.join(", ")}` : "",
    t.description ? `Traveler's description: ${t.description}` : "",
    t.special_requests ? `Special requests: ${t.special_requests}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function describeItinerary(bundle: TripBundle): string {
  if (!bundle.days.length) return "No itinerary yet.";
  return bundle.days
    .map((d) => {
      const acts = d.activities
        .map(
          (a) =>
            `  - [id:${a.id}] ${a.suggested_time ?? a.slot} ${a.name} (${a.category}${a.is_restaurant ? ", restaurant" : ""}${
              a.estimated_cost ? `, ~${a.estimated_cost} ${bundle.trip.currency}` : ""
            }${a.user_modified ? ", EDITED BY TRAVELER — keep" : ""}${a.completed ? ", done" : ""})${
              a.address ? ` @ ${a.address}` : ""
            }`,
        )
        .join("\n");
      return `Day ${d.day_number} — ${d.date} — ${d.city}: ${d.title}\n${acts || "  (no activities)"}`;
    })
    .join("\n");
}

export function describeBookings(bundle: TripBundle): string {
  if (!bundle.bookings.length) return "No bookings recorded.";
  return bundle.bookings
    .map(
      (b) =>
        `- ${b.type}: ${b.name}${b.date ? ` on ${b.date}` : ""}${b.time ? ` at ${b.time}` : ""}${
          b.address ? ` (${b.address})` : ""
        }${b.confirmation_number ? ` conf ${b.confirmation_number}` : ""}`,
    )
    .join("\n");
}

export function budgetSnapshot(bundle: TripBundle) {
  const spent = bundle.expenses.filter((e) => !e.is_planned).reduce((s, e) => s + e.amount, 0);
  const planned = bundle.expenses.filter((e) => e.is_planned).reduce((s, e) => s + e.amount, 0);
  const itineraryEstimate = bundle.days.reduce(
    (s, d) => s + d.activities.reduce((x, a) => x + (a.estimated_cost ?? 0), 0),
    0,
  );
  return {
    spent,
    planned,
    itineraryEstimate,
    remaining: bundle.trip.budget - spent - planned,
  };
}

export function describeBudget(bundle: TripBundle): string {
  const s = budgetSnapshot(bundle);
  const c = bundle.trip.currency;
  const byCat = new Map<string, number>();
  for (const e of bundle.expenses.filter((x) => !x.is_planned)) {
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  }
  return [
    `Total budget: ${formatMoney(bundle.trip.budget, c)}`,
    `Spent so far (actual): ${formatMoney(s.spent, c)}`,
    `Planned but not yet spent: ${formatMoney(s.planned, c)}`,
    `Remaining after planned: ${formatMoney(s.remaining, c)}`,
    `Itinerary activity estimates total: ${formatMoney(s.itineraryEstimate, c)}`,
    byCat.size
      ? `Actual spend by category: ${[...byCat].map(([k, v]) => `${k} ${formatMoney(v, c)}`).join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function describeSavedPlaces(bundle: TripBundle): string {
  if (!bundle.savedPlaces.length) return "No saved places.";
  return bundle.savedPlaces.map((p) => `- ${p.name} (${p.city}, ${p.category}) ${p.notes}`).join("\n");
}
