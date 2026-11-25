import { NextResponse } from "next/server";
import { regenerateRequestSchema } from "@/lib/schemas";
import { authorizeAI, badRequest } from "@/lib/ai/guard";
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

  const auth = await authorizeAI(request, scope === "day" ? "regenerate_day" : "regenerate_activity");
  if ("error" in auth) return auth.error;

  if (auth.mode === "demo") {
    return scope === "day"
      ? NextResponse.json({ mode: "demo", day: demoRegenerateDay(bundle, day, instructions) })
      : NextResponse.json({ mode: "demo", activity: demoRegenerateActivity(bundle, day, activity!, instructions) });
  }

  try {
    if (scope === "day") {
      const result = await regenerateDay(bundle, prefs, day.day_number, instructions);
      await auth.finish("succeeded", result.usage);
      return NextResponse.json({ mode: "live", day: result.data });
    }
    const result = await regenerateActivity(bundle, prefs, day.day_number, activity!.name, activity!.is_restaurant, instructions);
    await auth.finish("succeeded", result.usage);
    return NextResponse.json({ mode: "live", activity: result.data });
  } catch (err) {
    await auth.finish("failed");
    const e = err instanceof AIError ? err : new AIError("Unexpected error");
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
