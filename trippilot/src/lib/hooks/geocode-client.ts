"use client";

import type { GeocodeResult } from "../geocode";

/** Returns coordinates, null when nothing was found; throws on service errors. */
export async function lookupLocation(address: string, city?: string | null): Promise<GeocodeResult | null> {
  const res = await fetch("/api/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, city: city ?? null }),
  });
  const data = (await res.json().catch(() => ({}))) as { result?: GeocodeResult | null; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Location lookup failed");
  return data.result ?? null;
}
