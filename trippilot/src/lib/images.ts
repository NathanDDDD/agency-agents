// Destination photography (Unsplash). Every image is rendered through
// <SafeImage>, which falls back to a branded gradient if a photo fails to load.

const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;

export const PHOTOS = {
  heroCoast: u("photo-1476514525535-07fb3b4ae5f1", 2000),
  heroRoad: u("photo-1469854523086-cc02fe5d8800", 2000),
  planning: u("photo-1488646953014-85cb44e25828", 1400),
  rome: u("photo-1552832230-c0197dd311b5"),
  romeStreet: u("photo-1515542622106-78bda8ba0e5b"),
  trevi: u("photo-1525874684015-58379d421a52"),
  vatican: u("photo-1531572753322-ad063cecc140"),
  pasta: u("photo-1551183053-bf91a1d81141", 1200),
  paris: u("photo-1502602898657-3e91760cbb34"),
  tokyo: u("photo-1540959733332-eab4deabeeaf"),
  kyoto: u("photo-1493976040374-85c8e12f0c0e"),
  santorini: u("photo-1570077188670-e3a8d69ac5ff"),
  bali: u("photo-1537996194471-e657df975ab4"),
  newYork: u("photo-1496442226666-8d4d0e62e6e9"),
  lisbon: u("photo-1555881400-74d7acaacd8b"),
};

const DESTINATION_PHOTOS: [RegExp, string][] = [
  [/rome|roma|italy|vatican/i, PHOTOS.rome],
  [/florence|firenze|tuscany/i, PHOTOS.romeStreet],
  [/paris|france/i, PHOTOS.paris],
  [/tokyo|osaka/i, PHOTOS.tokyo],
  [/kyoto|japan/i, PHOTOS.kyoto],
  [/santorini|greece|athens|mykonos/i, PHOTOS.santorini],
  [/bali|indonesia/i, PHOTOS.bali],
  [/new york|nyc|manhattan/i, PHOTOS.newYork],
  [/lisbon|porto|portugal/i, PHOTOS.lisbon],
];

export function photoForDestination(destinations: string[] | string): string {
  const text = Array.isArray(destinations) ? destinations.join(" ") : destinations;
  for (const [re, url] of DESTINATION_PHOTOS) {
    if (re.test(text)) return url;
  }
  return PHOTOS.heroCoast;
}

/** Deterministic gradient used when a photo is missing or fails. */
export function gradientFor(seed: string) {
  const palettes = [
    ["#101C33", "#456CFF"],
    ["#26375A", "#DDA96C"],
    ["#101C33", "#3BA7A0"],
    ["#1A2944", "#B0469A"],
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [a, b] = palettes[h % palettes.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}
