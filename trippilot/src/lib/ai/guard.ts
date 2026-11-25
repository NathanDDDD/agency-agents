import "server-only";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "../config";
import { getServerUser } from "../supabase/server";
import { isAIConfigured } from "./claude";

export type AIMode = "live" | "demo";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 30;
const hits = new Map<string, number[]>();

/** Best-effort in-memory rate limit (per server instance). */
function rateLimited(key: string) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > MAX_REQUESTS;
}

/**
 * Decide whether a request gets live AI or demo responses.
 * - No ANTHROPIC_API_KEY: demo.
 * - Supabase configured: live AI only for signed-in users; demo visitors get demo responses.
 * - Supabase not configured (local development): live AI.
 */
export async function resolveAIMode(request: Request): Promise<{ mode: AIMode } | { error: NextResponse }> {
  if (!isAIConfigured()) return { mode: "demo" };
  let key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isSupabaseConfigured) {
    const user = await getServerUser();
    if (!user) return { mode: "demo" };
    key = user.id;
  }
  if (rateLimited(key)) {
    return {
      error: NextResponse.json(
        { error: "You're sending requests quickly. Please wait a few minutes and try again." },
        { status: 429 },
      ),
    };
  }
  return { mode: "live" };
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
