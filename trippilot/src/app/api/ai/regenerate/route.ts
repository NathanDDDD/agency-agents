import { NextResponse } from "next/server";
import { regenerateRequestSchema } from "@/lib/schemas";
import { badRequest, resolveAIMode } from "@/lib/ai/guard";
import { readBundle, readPreferences } from "@/lib/ai/bundle";
import { AIError, regenerateActivity, regenerateDay } from "@/lib/ai/claude";
import { demoRegenerateActivity, demoRegenerateDay } from "@/lib/demo/ai";

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = regenerateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("Invalid request");
  const bundle = readBundle(body.data.bundle);
  if (!bundle) return badRequest("Invalid trip data");
  const prefs = readPreferences(body.data.preferences);
  const { scope, day_id, activity_id, instructions } = body.data;

  const day = bundle.days.find((d) => d.id === day_id);
  if (!day) return badRequest("Day not found");
  const activity = activity_id ? day.activities.find((a) => a.id === activity_id) : undefined;
  if (scope === "activity" && !activity) return badRequest("Activity not found");

  const resolved = await resolveAIMode(request);
  if ("error" in resolved) return resolved.error;

  try {
    if (scope === "day") {
      const result =
        resolved.mode === "demo"
          ? demoRegenerateDay(bundle, day, instructions)
          : await regenerateDay(bundle, prefs, day.day_number, instructions);
      return NextResponse.json({ mode: resolved.mode, day: result });
    }
    const result =
      resolved.mode === "demo"
        ? demoRegenerateActivity(bundle, day, activity!, instructions)
        : await regenerateActivity(bundle, prefs, day.day_number, activity!.name, activity!.is_restaurant, instructions);
    return NextResponse.json({ mode: resolved.mode, activity: result });
  } catch (err) {
    const e = err instanceof AIError ? err : new AIError("Unexpected error");
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
