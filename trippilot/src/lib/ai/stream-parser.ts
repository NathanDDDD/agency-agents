/**
 * Incrementally extracts complete objects from the `days` array of a JSON
 * document that is still being streamed, e.g. `{"overview":"…","days":[{…},{…`.
 *
 * Feed text deltas with `push()`; it returns each day object as soon as its
 * closing brace arrives. String contents (including escaped quotes and
 * braces) are handled, so braces inside descriptions don't confuse it.
 */
export class DayStreamParser {
  private buf = "";
  private pos = 0;
  private arrayStart = -1; // index just after the `[` of "days"
  private depth = 0; // nesting depth inside the days array (0 = between items)
  private inString = false;
  private escaped = false;
  private itemStart = -1;
  private done = false;

  push(delta: string): unknown[] {
    this.buf += delta;
    const out: unknown[] = [];
    if (this.done) return out;

    if (this.arrayStart < 0) {
      const m = /"days"\s*:\s*\[/.exec(this.buf);
      if (!m) return out;
      this.arrayStart = m.index + m[0].length;
      this.pos = this.arrayStart;
    }

    for (; this.pos < this.buf.length; this.pos++) {
      const ch = this.buf[this.pos];
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (ch === "\\") this.escaped = true;
        else if (ch === '"') this.inString = false;
        continue;
      }
      if (ch === '"') {
        this.inString = true;
      } else if (ch === "{" || ch === "[") {
        if (this.depth === 0 && ch === "{") this.itemStart = this.pos;
        this.depth++;
      } else if (ch === "}" || ch === "]") {
        if (this.depth === 0 && ch === "]") {
          this.done = true; // end of the days array
          this.pos++;
          break;
        }
        this.depth--;
        if (this.depth === 0 && ch === "}" && this.itemStart >= 0) {
          try {
            out.push(JSON.parse(this.buf.slice(this.itemStart, this.pos + 1)));
          } catch {
            // Malformed fragment: skip it; the final validated result is authoritative.
          }
          this.itemStart = -1;
        }
      }
    }
    return out;
  }
}

/** Events sent from /api/ai/plan as newline-delimited JSON. */
export type PlanStreamEvent =
  | { type: "start"; mode: "live" | "demo"; total_days: number }
  | { type: "ping" }
  | { type: "day"; day: unknown }
  | { type: "done"; mode: "live" | "demo"; itinerary: unknown }
  | { type: "error"; error: string; status: number };

/** Split an NDJSON byte stream into parsed events. */
export async function* readNdjson<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) yield JSON.parse(line) as T;
    }
    if (done) break;
  }
  const rest = buf.trim();
  if (rest) yield JSON.parse(rest) as T;
}
