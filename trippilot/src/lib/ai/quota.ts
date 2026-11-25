// Quota rules shared by the server guard (and unit tests). Pure, no I/O.

export type AIKind = "plan" | "regenerate_day" | "regenerate_activity" | "chat";

/** Credits each request type costs, roughly proportional to model spend. */
export const AI_UNITS: Record<AIKind, number> = {
  plan: 5,
  regenerate_day: 2,
  regenerate_activity: 1,
  chat: 1,
};

function intFromEnv(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function quotaLimits(env: Record<string, string | undefined> = process.env) {
  return {
    /** Credits per rolling 24 hours. */
    daily: intFromEnv(env.AI_DAILY_CREDIT_LIMIT, 60),
    /** Requests per rolling 10 minutes. */
    burst: intFromEnv(env.AI_BURST_LIMIT, 20),
  };
}

export type QuotaDecision =
  | { allowed: true; usedToday: number }
  | { allowed: false; reason: "daily" | "burst"; usedToday: number };

export function quotaMessage(reason: "daily" | "burst", daily: number) {
  return reason === "daily"
    ? `You've used today's ${daily} AI credits. They refill over the next 24 hours.`
    : "You're sending AI requests very quickly. Please wait a few minutes and try again.";
}

/**
 * In-memory implementation of the same rules, used when Supabase isn't
 * configured (local development). Per server instance only.
 */
export class MemoryQuota {
  private entries = new Map<string, { at: number; units: number }[]>();

  consume(key: string, units: number, limits: { daily: number; burst: number }, now = Date.now()): QuotaDecision {
    const day = 24 * 60 * 60 * 1000;
    const list = (this.entries.get(key) ?? []).filter((e) => now - e.at < day);
    const usedToday = list.reduce((s, e) => s + e.units, 0);
    const recent = list.filter((e) => now - e.at < 10 * 60 * 1000).length;
    if (recent >= limits.burst) return { allowed: false, reason: "burst", usedToday };
    if (usedToday + units > limits.daily) return { allowed: false, reason: "daily", usedToday };
    list.push({ at: now, units });
    this.entries.set(key, list);
    if (this.entries.size > 10_000) this.entries.clear();
    return { allowed: true, usedToday: usedToday + units };
  }
}
