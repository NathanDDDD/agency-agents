// Approximate city centers, used to frame the map and to place demo content.
export const CITY_CENTERS: Record<string, [number, number]> = {
  rome: [41.8986, 12.4769],
  florence: [43.7696, 11.2558],
  venice: [45.4408, 12.3155],
  milan: [45.4642, 9.19],
  naples: [40.8518, 14.2681],
  amalfi: [40.634, 14.6027],
  paris: [48.8566, 2.3522],
  london: [51.5072, -0.1276],
  barcelona: [41.3874, 2.1686],
  madrid: [40.4168, -3.7038],
  lisbon: [38.7223, -9.1393],
  porto: [41.1579, -8.6291],
  amsterdam: [52.3676, 4.9041],
  berlin: [52.52, 13.405],
  prague: [50.0755, 14.4378],
  vienna: [48.2082, 16.3738],
  athens: [37.9838, 23.7275],
  santorini: [36.3932, 25.4615],
  istanbul: [41.0082, 28.9784],
  tokyo: [35.6762, 139.6503],
  kyoto: [35.0116, 135.7681],
  osaka: [34.6937, 135.5023],
  seoul: [37.5665, 126.978],
  bangkok: [13.7563, 100.5018],
  bali: [-8.4095, 115.1889],
  singapore: [1.3521, 103.8198],
  dubai: [25.2048, 55.2708],
  "tel aviv": [32.0853, 34.7818],
  jerusalem: [31.7683, 35.2137],
  marrakech: [31.6295, -7.9811],
  "cape town": [-33.9249, 18.4241],
  "new york": [40.7128, -74.006],
  "los angeles": [34.0522, -118.2437],
  "san francisco": [37.7749, -122.4194],
  miami: [25.7617, -80.1918],
  "mexico city": [19.4326, -99.1332],
  "buenos aires": [-34.6037, -58.3816],
  sydney: [-33.8688, 151.2093],
  reykjavik: [64.1466, -21.9426],
};

export function findCityCenter(name: string): [number, number] | null {
  const key = name.toLowerCase().trim();
  if (CITY_CENTERS[key]) return CITY_CENTERS[key];
  for (const [city, coords] of Object.entries(CITY_CENTERS)) {
    if (key.includes(city) || city.includes(key.split(",")[0])) return coords;
  }
  return null;
}

/** Deterministic small offset around a center so demo markers don't overlap. */
export function jitter(center: [number, number], i: number, spread = 0.012): [number, number] {
  const angle = (i * 137.508 * Math.PI) / 180;
  const r = spread * Math.sqrt((i % 9) + 1) * 0.45;
  return [center[0] + r * Math.cos(angle), center[1] + r * Math.sin(angle) * 1.3];
}
