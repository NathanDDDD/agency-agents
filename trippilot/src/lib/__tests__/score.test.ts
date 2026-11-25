import { describe, expect, it } from "vitest";
import { overall, scoreItinerary, type EvalCase } from "../eval/score";
import { demoItinerary } from "../demo/ai";
import { buildRomeDemo } from "../demo/rome";
import type { AIItinerary } from "../schemas";

const romeCase: EvalCase = {
  id: "t",
  destinations: ["Rome"],
  days: 6,
  travelers: 2,
  party: "couple",
  budget: 8500,
  currency: "USD",
  pace: "relaxed",
  interests: [],
  description: "",
};

describe("scoreItinerary", () => {
  const good = demoItinerary({ ...buildRomeDemo(), days: [] });

  it("scores a well-formed Rome plan highly", () => {
    const r = scoreItinerary(romeCase, good);
    expect(r.find((x) => x.name === "day_count")?.score).toBe(1);
    expect(r.find((x) => x.name === "coords_in_area")?.score).toBe(1);
    expect(overall(r)).toBeGreaterThan(0.85);
  });

  it("penalizes wrong day counts, far-away coordinates, duplicates and missing edits", () => {
    const bad: AIItinerary = {
      overview: "",
      days: good.days.slice(0, 3).map((d) => ({
        ...d,
        activities: d.activities.map((a) => ({ ...a, name: "Same place", latitude: 48.85, longitude: 2.35 })),
      })),
    };
    const r = scoreItinerary(
      { ...romeCase, edited: [{ day: 1, name: "Kept thing", slot: "evening", time: "20:00", is_restaurant: true, category: "restaurant", address: "", lat: 0, lng: 0 }] },
      bad,
    );
    const by = Object.fromEntries(r.map((x) => [x.name, x.score]));
    expect(by.day_count).toBe(0);
    expect(by.coords_in_area).toBe(0);
    expect(by.no_duplicates).toBeLessThan(0.2);
    expect(by.preserves_edits).toBe(0);
  });
});
