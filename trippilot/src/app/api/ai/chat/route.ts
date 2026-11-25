import { NextResponse } from "next/server";
import { chatRequestSchema } from "@/lib/schemas";
import { badRequest, resolveAIMode } from "@/lib/ai/guard";
import { readBundle, readPreferences } from "@/lib/ai/bundle";
import { AIError, conciergeReply } from "@/lib/ai/claude";
import { demoConcierge } from "@/lib/demo/ai";

export const maxDuration = 120;

export async function POST(request: Request) {
  const body = chatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("Invalid request");
  const bundle = readBundle(body.data.bundle);
  if (!bundle) return badRequest("Invalid trip data");
  const prefs = readPreferences(body.data.preferences);

  const resolved = await resolveAIMode(request);
  if ("error" in resolved) return resolved.error;

  if (resolved.mode === "demo") {
    return NextResponse.json({ mode: "demo", response: demoConcierge(bundle, body.data.message) });
  }
  try {
    const response = await conciergeReply(bundle, prefs, bundle.messages, body.data.message);
    return NextResponse.json({ mode: "live", response });
  } catch (err) {
    const e = err instanceof AIError ? err : new AIError("Unexpected error");
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
