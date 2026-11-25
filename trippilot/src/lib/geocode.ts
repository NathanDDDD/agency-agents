// Geocoding helpers (pure: request building + response parsing).
// Providers: Mapbox Geocoding v6 when a token is set, otherwise OpenStreetMap
// Nominatim (free; max 1 request/second, must identify the app).

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
  provider: "mapbox" | "nominatim";
}

export function buildQuery(address: string, city?: string | null): string {
  const a = address.trim();
  const c = (city ?? "").trim();
  if (!c || a.toLowerCase().includes(c.toLowerCase())) return a;
  return `${a}, ${c}`;
}

export function nominatimUrl(q: string) {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "1");
  u.searchParams.set("q", q);
  return u.toString();
}

export function mapboxUrl(q: string, token: string) {
  const u = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  u.searchParams.set("q", q);
  u.searchParams.set("limit", "1");
  u.searchParams.set("access_token", token);
  return u.toString();
}

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export function parseNominatim(json: unknown): GeocodeResult | null {
  if (!Array.isArray(json) || !json.length) return null;
  const r = json[0] as { lat?: string; lon?: string; display_name?: string };
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!valid(lat, lng)) return null;
  return { latitude: lat, longitude: lng, label: String(r.display_name ?? ""), provider: "nominatim" };
}

export function parseMapbox(json: unknown): GeocodeResult | null {
  const f = (json as { features?: { geometry?: { coordinates?: number[] }; properties?: { full_address?: string; name?: string } }[] })
    ?.features?.[0];
  const coords = f?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!valid(lat, lng)) return null;
  return { latitude: lat, longitude: lng, label: f?.properties?.full_address ?? f?.properties?.name ?? "", provider: "mapbox" };
}

/** Great-circle distance in km. */
export function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
