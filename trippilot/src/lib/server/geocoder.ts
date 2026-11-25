import "server-only";
import { buildQuery, mapboxUrl, nominatimUrl, parseMapbox, parseNominatim, type GeocodeResult } from "../geocode";

const cache = new Map<string, GeocodeResult | null>();
let nominatimQueue: Promise<unknown> = Promise.resolve();
let lastNominatim = 0;

function userAgent() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const contact = process.env.GEOCODER_CONTACT_EMAIL;
  return `TripPilot/0.1 (+${site}${contact ? `; ${contact}` : ""})`;
}

/** Nominatim allows at most 1 request per second per application. */
function throttledNominatim(q: string): Promise<GeocodeResult | null> {
  const run = async () => {
    const wait = Math.max(0, lastNominatim + 1100 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastNominatim = Date.now();
    const res = await fetch(nominatimUrl(q), {
      headers: { "User-Agent": userAgent(), "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Geocoder returned ${res.status}`);
    return parseNominatim(await res.json());
  };
  const p = nominatimQueue.then(run, run);
  nominatimQueue = p.catch(() => undefined);
  return p;
}

export async function geocode(address: string, city?: string | null): Promise<GeocodeResult | null> {
  const q = buildQuery(address, city).slice(0, 300);
  if (!q) return null;
  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;

  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  let result: GeocodeResult | null;
  if (token) {
    const res = await fetch(mapboxUrl(q, token), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Geocoder returned ${res.status}`);
    result = parseMapbox(await res.json());
  } else {
    result = await throttledNominatim(q);
  }
  if (cache.size > 5000) cache.clear();
  cache.set(key, result);
  return result;
}
