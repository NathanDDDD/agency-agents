import "server-only";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "../config";
import { getServerUser, getSupabaseServer } from "../supabase/server";
import { AI_MODEL, isAIConfigured } from "./claude";
import { AI_UNITS, MemoryQuota, quotaLimits, quotaMessage, type AIKind } from "./quota";

export type AIMode = "live" | "demo";

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

export type AIAuthorization =
  | { mode: "demo" }
  | {
      mode: "live";
      /** Record outcome + token usage. Never throws. */
      finish: (status: "succeeded" | "failed", usage?: TokenUsage | null) => Promise<void>;
    }
  | { error: NextResponse };

const memory = new MemoryQuota();

const noop = async () => undefined;

/**
 * Decide whether a request gets live AI or demo responses, and charge quota.
 * - No ANTHROPIC_API_KEY: demo.
 * - Supabase configured: live AI only for signed-in users, metered by the
 *   consume_ai_quota() database function. Anonymous demo visitors get demo responses.
 * - Supabase not configured (local development): live AI, metered in memory per IP.
 */
export async function authorizeAI(request: Request, kind: AIKind): Promise<AIAuthorization> {
  if (!isAIConfigured()) return { mode: "demo" };
  const limits = quotaLimits();
  const units = AI_UNITS[kind];

  if (!isSupabaseConfigured) {
    const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const decision = memory.consume(key, units, limits);
    if (!decision.allowed) return { error: tooMany(quotaMessage(decision.reason, limits.daily)) };
    return { mode: "live", finish: noop };
  }

  const user = await getServerUser();
  if (!user) return { mode: "demo" };
  const supabase = await getSupabaseServer();
  if (!supabase) return { mode: "demo" };

  const { data, error } = await supabase.rpc("consume_ai_quota", {
    p_kind: kind,
    p_units: units,
    p_daily_limit: limits.daily,
    p_burst_limit: limits.burst,
    p_model: AI_MODEL,
  });
  if (error) {
    // Fail closed: without metering we can't protect the AI budget.
    console.error("[ai] quota check failed", error.message);
    return {
      error: NextResponse.json(
        { error: "AI is temporarily unavailable (usage tracking isn't set up). Please try again later." },
        { status: 503 },
      ),
    };
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed: boolean; usage_id: string | null; used_today: number; reason: string | null }
    | undefined;
  if (!row?.allowed || !row.usage_id) {
    const reason = row?.reason === "burst" ? "burst" : "daily";
    return { error: tooMany(quotaMessage(reason, limits.daily)) };
  }

  const usageId = row.usage_id;
  return {
    mode: "live",
    finish: async (status, usage) => {
      const { error: finishError } = await supabase.rpc("finish_ai_usage", {
        p_usage_id: usageId,
        p_status: status,
        p_input_tokens: usage?.input_tokens ?? null,
        p_output_tokens: usage?.output_tokens ?? null,
      });
      if (finishError) console.error("[ai] could not record usage", finishError.message);
    },
  };
}

function tooMany(message: string) {
  return NextResponse.json({ error: message }, { status: 429 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
