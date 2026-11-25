import { NextResponse } from "next/server";
import { planRequestSchema } from "@/lib/schemas";
import { badRequest, resolveAIMode } from "@/lib/ai/guard";
import { readBundle, readPreferences } from "@/lib/ai/bundle";
import { AIError, generateItinerary } from "@/lib/ai/claude";
import { demoItinerary } from "@/lib/demo/ai";
import { tripLength } from "@/lib/utils";

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = planRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("Invalid request");
  const bundle = readBundle(body.data.bundle);
  if (!bundle) return badRequest("Invalid trip data");
  if (tripLength(bundle.trip.start_date, bundle.trip.end_date) > 31) return badRequest("Trips are limited to 31 days");
  const prefs = readPreferences(body.data.preferences);

  const resolved = await resolveAIMode(request);
  if ("error" in resolved) return resolved.error;

  if (resolved.mode === "demo") {
    return NextResponse.json({ mode: "demo", itinerary: demoItinerary(bundle) });
  }
  try {
    const itinerary = await generateItinerary(bundle, prefs);
    return NextResponse.json({ mode: "live", itinerary });
  } catch (err) {
    const e = err instanceof AIError ? err : new AIError("Unexpected error");
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
