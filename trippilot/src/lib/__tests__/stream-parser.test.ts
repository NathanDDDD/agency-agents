import { describe, expect, it } from "vitest";
import { DayStreamParser, readNdjson } from "../ai/stream-parser";

const doc = JSON.stringify({
  overview: "A trip with {braces} and \"quotes\" in the overview",
  days: [
    { day_number: 1, title: "Arrive {early}", notes: 'He said "hi" \\ then left', activities: [{ name: "A" }] },
    { day_number: 2, title: "Second", activities: [{ name: "B", tags: ["x", "]"] }] },
  ],
});

describe("DayStreamParser", () => {
  it("emits each day as soon as it is complete, across arbitrary chunk boundaries", () => {
    for (const size of [1, 3, 7, 50, doc.length]) {
      const p = new DayStreamParser();
      const out: unknown[] = [];
      for (let i = 0; i < doc.length; i += size) out.push(...p.push(doc.slice(i, i + size)));
      expect(out).toEqual(JSON.parse(doc).days);
    }
  });

  it("does not emit a day until its closing brace arrives", () => {
    const p = new DayStreamParser();
    const cut = doc.indexOf('"day_number":2');
    expect(p.push(doc.slice(0, cut))).toHaveLength(1);
    expect(p.push(doc.slice(cut))).toHaveLength(1);
  });

  it("ignores text before the days array and stops after it", () => {
    const p = new DayStreamParser();
    expect(p.push('{"overview":"x","days":[]')).toEqual([]);
    expect(p.push(',"extra":[{"a":1}]}')).toEqual([]);
  });
});

describe("readNdjson", () => {
  it("parses events split across chunks", async () => {
    const enc = new TextEncoder();
    const chunks = ['{"type":"start"}\n{"ty', 'pe":"day","day":{"n":1}}\n', '{"type":"done"}'];
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        chunks.forEach((x) => c.enqueue(enc.encode(x)));
        c.close();
      },
    });
    const events: unknown[] = [];
    for await (const e of readNdjson(body)) events.push(e);
    expect(events).toEqual([{ type: "start" }, { type: "day", day: { n: 1 } }, { type: "done" }]);
  });
});
