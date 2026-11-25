import { describe, expect, it } from "vitest";
import { parseTripPrompt } from "../parse-prompt";

describe("parseTripPrompt", () => {
  it("extracts the flagship example", () => {
    const p = parseTripPrompt(
      "Plan 6 days in Italy for a couple. Rome and Florence. Luxury hotels, amazing restaurants, historical places, nightlife, but no packed schedule. Budget $4,000 excluding flights.",
    );
    expect(p.days).toBe(6);
    expect(p.destinations).toEqual(["Rome", "Florence"]);
    expect(p.budget).toBe(4000);
    expect(p.currency).toBe("USD");
    expect(p.excludesFlights).toBe(true);
    expect(p.party).toBe("couple");
    expect(p.travelers).toBe(2);
    expect(p.pace).toBe("relaxed");
    expect(p.interests).toEqual(expect.arrayContaining(["History", "Nightlife", "Fine dining"]));
    expect(p.name).toBe("Rome & Florence getaway");
  });

  it("handles nights, euros, k-suffix and families", () => {
    const p = parseTripPrompt("4 nights in Paris with the kids, around €3k, as much as possible");
    expect(p.days).toBe(5);
    expect(p.currency).toBe("EUR");
    expect(p.budget).toBe(3000);
    expect(p.party).toBe("family");
    expect(p.pace).toBe("packed");
  });

  it("falls back to countries and handles empty input", () => {
    expect(parseTripPrompt("A week in Japan").destinations).toEqual(["Japan"]);
    expect(parseTripPrompt("A week in Japan").days).toBe(7);
    expect(parseTripPrompt("   ")).toEqual({ interests: [] });
  });
});
