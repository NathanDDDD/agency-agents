import { describe, expect, it } from "vitest";
import { AI_UNITS, MemoryQuota, quotaLimits } from "../ai/quota";
import { buildQuery, distanceKm, parseMapbox, parseNominatim } from "../geocode";

describe("quota", () => {
  it("reads limits from env with safe fallbacks", () => {
    expect(quotaLimits({})).toEqual({ daily: 60, burst: 20 });
    expect(quotaLimits({ AI_DAILY_CREDIT_LIMIT: "100", AI_BURST_LIMIT: "nope" })).toEqual({ daily: 100, burst: 20 });
  });

  it("enforces daily credits and burst counts", () => {
    const q = new MemoryQuota();
    const limits = { daily: 10, burst: 2 };
    const t = 1_000_000_000;
    expect(q.consume("u", AI_UNITS.plan, limits, t).allowed).toBe(true); // 5
    expect(q.consume("u", AI_UNITS.plan, limits, t + 1).allowed).toBe(true); // 10
    const third = q.consume("u", 1, limits, t + 2);
    expect(third).toMatchObject({ allowed: false, reason: "burst" });
    // After the burst window, the daily limit still applies.
    expect(q.consume("u", 1, limits, t + 11 * 60_000)).toMatchObject({ allowed: false, reason: "daily" });
    // A day later, credits are back.
    expect(q.consume("u", 1, limits, t + 25 * 3_600_000).allowed).toBe(true);
    // Other users are unaffected.
    expect(q.consume("v", 1, limits, t).allowed).toBe(true);
  });
});

describe("geocode helpers", () => {
  it("adds the city only when missing", () => {
    expect(buildQuery("Via del Babuino 9", "Rome")).toBe("Via del Babuino 9, Rome");
    expect(buildQuery("Via del Babuino 9, Rome", "Rome")).toBe("Via del Babuino 9, Rome");
  });

  it("parses provider responses and rejects junk", () => {
    expect(parseNominatim([{ lat: "41.9", lon: "12.47", display_name: "Rome" }])).toMatchObject({ latitude: 41.9, longitude: 12.47 });
    expect(parseNominatim([])).toBeNull();
    expect(parseNominatim([{ lat: "abc", lon: "1" }])).toBeNull();
    expect(parseMapbox({ features: [{ geometry: { coordinates: [12.47, 41.9] }, properties: { name: "X" } }] })).toMatchObject({
      latitude: 41.9,
      longitude: 12.47,
    });
    expect(parseMapbox({ features: [] })).toBeNull();
  });

  it("computes distances", () => {
    expect(distanceKm([41.9028, 12.4964], [43.7696, 11.2558])).toBeGreaterThan(220);
    expect(distanceKm([41.9028, 12.4964], [43.7696, 11.2558])).toBeLessThan(240);
  });
});
