import { NextResponse, connection } from "next/server";
import { isAIConfigured } from "@/lib/ai/claude";
import { isSupabaseConfigured } from "@/lib/config";

/** Tells the client which integrations are live (never exposes secrets). */
export async function GET() {
  await connection(); // evaluate per request, so env changes apply without a rebuild
  return NextResponse.json({ ai: isAIConfigured(), supabase: isSupabaseConfigured });
}
