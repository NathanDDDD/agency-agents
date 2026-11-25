import { NextResponse } from "next/server";
import { chatRequestSchema } from "@/lib/schemas";
import { authorizeAI, badRequest } from "@/lib/ai/guard";
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

  const auth = await authorizeAI(request, "chat");
  if ("error" in auth) return auth.error;

  if (auth.mode === "demo") {
    return NextResponse.json({ mode: "demo", response: demoConcierge(bundle, body.data.message) });
  }
  try {
    const result = await conciergeReply(bundle, prefs, bundle.messages, body.data.message);
    await auth.finish("succeeded", result.usage);
    return NextResponse.json({ mode: "live", response: result.data });
  } catch (err) {
    await auth.finish("failed");
    const e = err instanceof AIError ? err : new AIError("Unexpected error");
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
