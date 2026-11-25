import { planRequestSchema } from "@/lib/schemas";
import { authorizeAI, badRequest } from "@/lib/ai/guard";
import { readBundle, readPreferences } from "@/lib/ai/bundle";
import { AIError, generateItinerary } from "@/lib/ai/claude";
import { demoItinerary } from "@/lib/demo/ai";
import type { PlanStreamEvent } from "@/lib/ai/stream-parser";
import { tripLength } from "@/lib/utils";

export const maxDuration = 300;

const DEMO_DAY_DELAY_MS = 350;

/**
 * Streams itinerary generation as newline-delimited JSON (PlanStreamEvent):
 * start → day… → done | error, with periodic pings while the model thinks.
 */
export async function POST(request: Request) {
  const body = planRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("Invalid request");
  const bundle = readBundle(body.data.bundle);
  if (!bundle) return badRequest("Invalid trip data");
  const totalDays = tripLength(bundle.trip.start_date, bundle.trip.end_date);
  if (totalDays > 31) return badRequest("Trips are limited to 31 days");
  const prefs = readPreferences(body.data.preferences);

  const auth = await authorizeAI(request, "plan");
  if ("error" in auth) return auth.error;

  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: PlanStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };
      const ping = setInterval(() => send({ type: "ping" }), 10_000);
      send({ type: "start", mode: auth.mode, total_days: totalDays });
      try {
        if (auth.mode === "demo") {
          const itinerary = demoItinerary(bundle);
          for (const day of itinerary.days) {
            if (abort.signal.aborted) break;
            await new Promise((r) => setTimeout(r, DEMO_DAY_DELAY_MS));
            send({ type: "day", day });
          }
          send({ type: "done", mode: "demo", itinerary });
        } else {
          try {
            const result = await generateItinerary(bundle, prefs, {
              signal: abort.signal,
              onDay: (day) => send({ type: "day", day }),
            });
            await auth.finish("succeeded", result.usage);
            send({ type: "done", mode: "live", itinerary: result.data });
          } catch (err) {
            await auth.finish("failed");
            throw err;
          }
        }
      } catch (err) {
        const e = err instanceof AIError ? err : new AIError("Unexpected error");
        send({ type: "error", error: e.message, status: e.status });
      } finally {
        clearInterval(ping);
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
