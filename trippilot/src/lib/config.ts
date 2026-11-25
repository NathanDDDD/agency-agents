// Public configuration (safe for the browser). Server-only secrets live in
// src/lib/ai/server-config.ts and are never imported by client code.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Cookie set when a visitor chooses "Explore the demo". */
export const DEMO_COOKIE = "tp_demo";

export const MAP_PROVIDER = (process.env.NEXT_PUBLIC_MAP_PROVIDER ?? "osm") as "osm" | "mapbox";
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
