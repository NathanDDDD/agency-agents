import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_COOKIE, isSupabaseConfigured } from "@/lib/config";
import { getServerUser } from "@/lib/supabase/server";
import { geocode } from "@/lib/server/geocoder";
import { MemoryQuota } from "@/lib/ai/quota";

const schema = z.object({
  address: z.string().min(2).max(300),
  city: z.string().max(120).nullable().optional(),
});

const limiter = new MemoryQuota();

/** Look up coordinates for an address (used for activities without a location). */
export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  let key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isSupabaseConfigured) {
    const user = await getServerUser();
    const demo = request.headers.get("cookie")?.includes(`${DEMO_COOKIE}=1`);
    if (!user && !demo) return NextResponse.json({ error: "Sign in to look up locations" }, { status: 401 });
    if (user) key = user.id;
  }
  // 1 unit per lookup: up to 300/day and 60 per 10 minutes per user or IP.
  const decision = limiter.consume(`geo:${key}`, 1, { daily: 300, burst: 60 });
  if (!decision.allowed) return NextResponse.json({ error: "Too many location lookups. Try again later." }, { status: 429 });

  try {
    const result = await geocode(body.data.address, body.data.city);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("[geocode]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Location lookup is unavailable right now." }, { status: 502 });
  }
}
