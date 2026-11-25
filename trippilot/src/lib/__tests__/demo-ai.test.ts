import { describe, expect, it } from "vitest";
import { demoConcierge, demoItinerary, demoRegenerateDay } from "../demo/ai";
import { buildRomeDemo } from "../demo/rome";
import { aiChatResponseSchema, aiDaySchema, aiItinerarySchema } from "../schemas";
import { budgetSnapshot } from "../ai/context";

describe("demo AI", () => {
  const rome = buildRomeDemo();

  it("produces a schema-valid itinerary with one day per trip day", () => {
    const it2 = demoItinerary({ ...rome, days: [], trip: { ...rome.trip, destinations: ["Rome", "Florence"] } });
    expect(aiItinerarySchema.safeParse(it2).success).toBe(true);
    expect(it2.days).toHaveLength(6);
    expect(new Set(it2.days.map((d) => d.city))).toEqual(new Set(["Rome", "Florence"]));
    // No place is repeated within the same city.
    const names = it2.days.flatMap((d) => d.activities.map((a) => a.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it("works for cities outside the curated library", () => {
    const out = demoItinerary({ ...rome, days: [], trip: { ...rome.trip, destinations: ["Reykjavik"] } });
    expect(out.days.every((d) => d.activities.length > 0)).toBe(true);
  });

  it("regenerated day is schema-valid", () => {
    const d = demoRegenerateDay(rome, rome.days[1], "something outdoors");
    expect(aiDaySchema.safeParse(d).success).toBe(true);
  });

  it("answers budget questions with the real numbers", () => {
    const res = demoConcierge(rome, "How much have we spent so far?");
    const s = budgetSnapshot(rome);
    expect(res.reply).toContain(`$${s.spent.toLocaleString("en-US")}`);
    expect(res.proposal).toBeNull();
  });

  it("proposes changes that reference real activity ids", () => {
    const res = demoConcierge(rome, "Remove the museum on day 5. I want something outdoors.");
    expect(aiChatResponseSchema.safeParse(res).success).toBe(true);
    const ids = new Set(rome.days.flatMap((d) => d.activities.map((a) => a.id)));
    const op = res.proposal!.operations[0];
    expect(op.type).toBe("replace_activity");
    expect(ids.has(op.activity_id!)).toBe(true);
    expect(op.activity?.category).toBe("outdoors");
  });
});
