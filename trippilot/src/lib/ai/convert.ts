// Converts validated AI output into domain records, and merges regenerated
// content while preserving anything the traveler edited by hand.
import type { AIActivity, AIDay } from "../schemas";
import type { Activity, ContentSource, ItineraryDay, ProposedActivity, Trip } from "../types";
import { addDays, nowIso, slotForTime, uid } from "../utils";

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

function cleanUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function cleanCoord(v: number | null, max: number): number | null {
  if (v === null || !Number.isFinite(v) || Math.abs(v) > max) return null;
  return v;
}

export function sanitizeActivity(a: AIActivity | ProposedActivity): ProposedActivity {
  const time = a.suggested_time && TIME_RE.test(a.suggested_time) ? a.suggested_time.padStart(5, "0") : null;
  return {
    name: a.name.trim().slice(0, 140) || "Untitled activity",
    description: a.description.trim().slice(0, 800),
    category: a.category,
    is_restaurant: a.is_restaurant || a.category === "restaurant",
    slot: a.slot ?? slotForTime(time),
    suggested_time: time,
    duration_minutes:
      a.duration_minutes && a.duration_minutes > 0 ? Math.min(Math.round(a.duration_minutes), 1440) : null,
    estimated_cost: a.estimated_cost !== null && a.estimated_cost >= 0 ? Math.round(a.estimated_cost) : null,
    address: a.address?.trim() || null,
    latitude: cleanCoord(a.latitude, 90),
    longitude: cleanCoord(a.longitude, 180),
    booking_url: cleanUrl(a.booking_url),
    notes: (a.notes ?? "").trim().slice(0, 1000),
  };
}

export function toActivity(
  a: AIActivity | ProposedActivity,
  ctx: { tripId: string; dayId: string; sortOrder: number; source: ContentSource },
): Activity {
  const ts = nowIso();
  return {
    ...sanitizeActivity(a),
    id: uid(),
    trip_id: ctx.tripId,
    day_id: ctx.dayId,
    sort_order: ctx.sortOrder,
    completed: false,
    source: ctx.source,
    user_modified: false,
    created_at: ts,
    updated_at: ts,
  };
}

const slotRank = { morning: 0, afternoon: 1, evening: 2 } as const;

export function orderActivities(list: Activity[]): Activity[] {
  return [...list]
    .sort((a, b) => {
      const s = slotRank[a.slot] - slotRank[b.slot];
      if (s !== 0) return s;
      return (a.suggested_time ?? "99:99").localeCompare(b.suggested_time ?? "99:99");
    })
    .map((a, i) => ({ ...a, sort_order: i }));
}

export function toDay(
  d: AIDay,
  ctx: { trip: Trip; index: number; source: ContentSource; dayId?: string },
): ItineraryDay {
  const ts = nowIso();
  const dayId = ctx.dayId ?? uid();
  const activities = orderActivities(
    d.activities.map((a, i) =>
      toActivity(a, { tripId: ctx.trip.id, dayId, sortOrder: i, source: ctx.source }),
    ),
  );
  return {
    id: dayId,
    trip_id: ctx.trip.id,
    day_number: ctx.index + 1,
    // Dates always follow the trip dates, whatever the model returned.
    date: addDays(ctx.trip.start_date, ctx.index),
    title: d.title.slice(0, 120),
    summary: d.summary,
    city: d.city,
    morning_summary: d.morning_summary,
    afternoon_summary: d.afternoon_summary,
    evening_summary: d.evening_summary,
    transport_notes: d.transport_notes,
    notes: d.notes,
    estimated_cost:
      d.estimated_cost ?? activities.reduce((s, a) => s + (a.estimated_cost ?? 0), 0),
    source: ctx.source,
    created_at: ts,
    updated_at: ts,
    activities,
  };
}

/**
 * Merge a regenerated day into an existing one. Activities the traveler edited,
 * added or completed are kept; the rest are replaced by the new suggestions.
 */
export function mergeDay(existing: ItineraryDay, regenerated: ItineraryDay): ItineraryDay {
  const keep = existing.activities.filter((a) => a.user_modified || a.source === "user" || a.completed);
  const keepNames = new Set(keep.map((a) => a.name.toLowerCase()));
  const fresh = regenerated.activities
    .filter((a) => !keepNames.has(a.name.toLowerCase()))
    .map((a) => ({ ...a, day_id: existing.id }));
  return {
    ...regenerated,
    id: existing.id,
    day_number: existing.day_number,
    date: existing.date,
    notes: existing.notes || regenerated.notes,
    created_at: existing.created_at,
    activities: orderActivities([...keep, ...fresh]),
  };
}

/**
 * Merge a freshly generated full itinerary, preserving traveler edits on days
 * that already exist (matched by day number).
 */
export function mergeItinerary(existing: ItineraryDay[], generated: ItineraryDay[]): ItineraryDay[] {
  return generated.map((g) => {
    const prev = existing.find((d) => d.day_number === g.day_number);
    return prev ? mergeDay(prev, g) : g;
  });
}
