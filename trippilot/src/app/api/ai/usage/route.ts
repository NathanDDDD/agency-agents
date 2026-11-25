import { NextResponse, connection } from "next/server";
import { isAIConfigured } from "@/lib/ai/claude";
import { quotaLimits } from "@/lib/ai/quota";
import { getServerUser, getSupabaseServer } from "@/lib/supabase/server";

/** Today's AI credit usage for the signed-in traveler. */
export async function GET() {
  await connection();
  const limits = quotaLimits();
  if (!isAIConfigured()) return NextResponse.json({ live: false, used: 0, limit: limits.daily });
  const user = await getServerUser();
  const supabase = await getSupabaseServer();
  if (!user || !supabase) return NextResponse.json({ live: false, used: 0, limit: limits.daily });
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("ai_usage").select("units").eq("user_id", user.id).gte("created_at", since);
  if (error) return NextResponse.json({ error: "Usage unavailable" }, { status: 503 });
  const used = (data ?? []).reduce((s, r) => s + Number(r.units), 0);
  return NextResponse.json({ live: true, used, limit: limits.daily });
}
