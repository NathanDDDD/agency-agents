import type { TravelPreferences, TripBundle } from "../types";

/**
 * Light structural check on the trip bundle sent by the client. The bundle is
 * only used as prompt context (the client persists results under RLS), so we
 * just make sure the fields we read exist and cap its size.
 */
export function readBundle(raw: Record<string, unknown>): TripBundle | null {
  const trip = raw.trip as TripBundle["trip"] | undefined;
  if (!trip || typeof trip !== "object" || typeof trip.start_date !== "string" || typeof trip.end_date !== "string") {
    return null;
  }
  if (JSON.stringify(raw).length > 400_000) return null;
  return {
    trip: {
      ...trip,
      destinations: Array.isArray(trip.destinations) ? trip.destinations.map(String) : [],
      interests: Array.isArray(trip.interests) ? trip.interests.map(String) : [],
      budget: Number(trip.budget) || 0,
      travelers: Number(trip.travelers) || 1,
    },
    days: Array.isArray(raw.days) ? (raw.days as TripBundle["days"]) : [],
    bookings: Array.isArray(raw.bookings) ? (raw.bookings as TripBundle["bookings"]) : [],
    expenses: Array.isArray(raw.expenses) ? (raw.expenses as TripBundle["expenses"]) : [],
    messages: Array.isArray(raw.messages) ? (raw.messages as TripBundle["messages"]) : [],
    savedPlaces: Array.isArray(raw.savedPlaces) ? (raw.savedPlaces as TripBundle["savedPlaces"]) : [],
  };
}

export function readPreferences(raw: Record<string, unknown> | null): TravelPreferences | null {
  if (!raw) return null;
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  return {
    travel_style: String(raw.travel_style ?? "balanced") as TravelPreferences["travel_style"],
    budget_range: String(raw.budget_range ?? "") as TravelPreferences["budget_range"],
    accommodation: String(raw.accommodation ?? "") as TravelPreferences["accommodation"],
    food_preferences: arr(raw.food_preferences),
    activities: arr(raw.activities),
    pace: String(raw.pace ?? "balanced") as TravelPreferences["pace"],
    travel_party: String(raw.travel_party ?? "couple") as TravelPreferences["travel_party"],
    preferred_destinations: arr(raw.preferred_destinations),
    accessibility_needs: String(raw.accessibility_needs ?? "").slice(0, 500),
  };
}
