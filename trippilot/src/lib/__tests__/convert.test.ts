import { describe, expect, it } from "vitest";
import { mergeDay, mergeItinerary, orderActivities, sanitizeActivity, toDay } from "../ai/convert";
import type { AIActivity, AIDay } from "../schemas";
import type { Activity, Trip } from "../types";

const trip = { id: "trip-1", start_date: "2026-06-01", end_date: "2026-06-03" } as Trip;

const act = (over: Partial<AIActivity> = {}): AIActivity => ({
  name: "Colosseum",
  description: "Ancient arena",
  category: "sightseeing",
  is_restaurant: false,
  slot: "morning",
  suggested_time: "09:00",
  duration_minutes: 120,
  estimated_cost: 50,
  address: "Piazza del Colosseo",
  latitude: 41.89,
  longitude: 12.49,
  booking_url: "https://colosseo.it",
  notes: "",
  ...over,
});

const aiDay = (n: number, acts: AIActivity[]): AIDay => ({
  day_number: n,
  date: "1999-01-01",
  city: "Rome",
  title: `Day ${n}`,
  summary: "",
  morning_summary: "",
  afternoon_summary: "",
  evening_summary: "",
  transport_notes: "",
  notes: "",
  estimated_cost: null,
  activities: acts,
});

describe("sanitizeActivity", () => {
  it("drops invalid URLs, coordinates and times", () => {
    const s = sanitizeActivity(act({ booking_url: "javascript:alert(1)", latitude: 123, longitude: 500, suggested_time: "25:99" }));
    expect(s.booking_url).toBeNull();
    expect(s.latitude).toBeNull();
    expect(s.longitude).toBeNull();
    expect(s.suggested_time).toBeNull();
  });

  it("pads times, rounds costs, forces restaurants flag", () => {
    const s = sanitizeActivity(act({ suggested_time: "9:30", estimated_cost: 12.6, category: "restaurant", is_restaurant: false }));
    expect(s.suggested_time).toBe("09:30");
    expect(s.estimated_cost).toBe(13);
    expect(s.is_restaurant).toBe(true);
  });
});

describe("toDay", () => {
  it("uses trip dates, not the model's dates, and orders by slot/time", () => {
    const d = toDay(
      aiDay(2, [act({ name: "Dinner", slot: "evening", suggested_time: "20:00" }), act({ name: "Breakfast", slot: "morning", suggested_time: "08:00" })]),
      { trip, index: 1, source: "ai" },
    );
    expect(d.date).toBe("2026-06-02");
    expect(d.day_number).toBe(2);
    expect(d.activities.map((a) => a.name)).toEqual(["Breakfast", "Dinner"]);
    expect(d.activities.map((a) => a.sort_order)).toEqual([0, 1]);
    expect(d.estimated_cost).toBe(100);
  });
});

describe("mergeDay", () => {
  const existing = toDay(aiDay(1, [act({ name: "Old AI pick" }), act({ name: "Mine", slot: "afternoon", suggested_time: "14:00" })]), {
    trip,
    index: 0,
    source: "ai",
  });
  existing.activities[1] = { ...existing.activities[1], user_modified: true } as Activity;
  existing.activities.push({ ...existing.activities[0], id: "done-1", name: "Completed thing", completed: true });
  existing.activities.push({ ...existing.activities[0], id: "user-1", name: "Added by me", source: "user" });

  const fresh = toDay(aiDay(1, [act({ name: "New AI pick" }), act({ name: "Mine" })]), { trip, index: 0, source: "ai" });

  it("keeps edited, completed and user-added activities and replaces the rest", () => {
    const merged = mergeDay(existing, fresh);
    const names = merged.activities.map((a) => a.name);
    expect(names).toContain("Mine");
    expect(names).toContain("Completed thing");
    expect(names).toContain("Added by me");
    expect(names).toContain("New AI pick");
    expect(names).not.toContain("Old AI pick");
    expect(names.filter((n) => n === "Mine")).toHaveLength(1); // no duplicate of a kept item
    expect(merged.id).toBe(existing.id);
    expect(merged.activities.every((a) => a.day_id === existing.id)).toBe(true);
  });

  it("mergeItinerary only touches matching days and adds new ones", () => {
    const day2 = toDay(aiDay(2, [act({ name: "Day two" })]), { trip, index: 1, source: "ai" });
    const out = mergeItinerary([existing], [fresh, day2]);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe(existing.id);
    expect(out[1].activities[0].name).toBe("Day two");
  });
});

describe("orderActivities", () => {
  it("puts untimed items at the end of their slot", () => {
    const base = toDay(aiDay(1, [act({ name: "B", suggested_time: null }), act({ name: "A", suggested_time: "10:00" })]), {
      trip,
      index: 0,
      source: "ai",
    });
    expect(orderActivities(base.activities).map((a) => a.name)).toEqual(["A", "B"]);
  });
});
