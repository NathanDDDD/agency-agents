// Lightweight, deterministic extraction of trip details from a natural-language
// description. It pre-fills the trip form instantly (no API call needed); the
// full description is still sent to the AI planner for nuance.
import { CITY_CENTERS } from "./geo";
import type { Pace, TravelParty } from "./types";

export interface ParsedPrompt {
  days?: number;
  destinations?: string[];
  budget?: number;
  currency?: string;
  excludesFlights?: boolean;
  party?: TravelParty;
  travelers?: number;
  pace?: Pace;
  interests: string[];
  name?: string;
}

const COUNTRY_HINTS: Record<string, string> = {
  italy: "Italy",
  japan: "Japan",
  france: "France",
  spain: "Spain",
  portugal: "Portugal",
  greece: "Greece",
  iceland: "Iceland",
  thailand: "Thailand",
  mexico: "Mexico",
  morocco: "Morocco",
};

const INTEREST_RULES: [RegExp, string][] = [
  [/histor|ancient|ruins/i, "History"],
  [/museum|gallery|art\b/i, "Art & museums"],
  [/architect/i, "Architecture"],
  [/nightlife|bars?\b|clubs?|cocktail/i, "Nightlife"],
  [/fine dining|michelin|amazing restaurants|gourmet/i, "Fine dining"],
  [/restaurant|food|eat|culinary|cuisine/i, "Local cuisine"],
  [/wine/i, "Wine bars"],
  [/beach|island|coast/i, "Beaches"],
  [/hik|nature|outdoor|mountain|national park/i, "Nature & hiking"],
  [/shop/i, "Shopping"],
  [/spa|wellness|relax/i, "Wellness & spa"],
  [/photo/i, "Photography"],
  [/music|concert|jazz/i, "Live music"],
  [/local|authentic/i, "Local experiences"],
];

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function parseTripPrompt(text: string): ParsedPrompt {
  const out: ParsedPrompt = { interests: [] };
  if (!text.trim()) return out;
  const lower = text.toLowerCase();

  const dayMatch = lower.match(/(\d{1,2})\s*-?\s*(day|days|night|nights)\b/);
  if (dayMatch) {
    const n = Number(dayMatch[1]);
    out.days = dayMatch[2].startsWith("night") ? n + 1 : n;
  } else if (/\b(a|one) week\b/.test(lower)) out.days = 7;
  else if (/\bweekend\b/.test(lower)) out.days = 3;
  else if (/\btwo weeks\b/.test(lower)) out.days = 14;

  // Destinations: known cities in order of appearance, else countries.
  const found: { name: string; at: number }[] = [];
  for (const city of Object.keys(CITY_CENTERS)) {
    const at = lower.search(new RegExp(`\\b${city}\\b`));
    if (at >= 0) found.push({ name: titleCase(city), at });
  }
  if (!found.length) {
    for (const [k, v] of Object.entries(COUNTRY_HINTS)) {
      const at = lower.indexOf(k);
      if (at >= 0) found.push({ name: v, at });
    }
  }
  if (found.length) out.destinations = found.sort((a, b) => a.at - b.at).map((f) => f.name);

  const money =
    text.match(/([$€£])\s?(\d[\d,.]*)\s?(k)?/i) ?? text.match(/(\d[\d,.]*)\s?(k)?\s?(usd|eur|gbp|dollars|euros|pounds)/i);
  if (money) {
    const symbolFirst = /[$€£]/.test(money[1]);
    const rawNum = symbolFirst ? money[2] : money[1];
    const k = symbolFirst ? money[3] : money[2];
    const unit = (symbolFirst ? money[1] : money[3]).toLowerCase();
    const n = Number(rawNum.replace(/,/g, "")) * (k ? 1000 : 1);
    if (Number.isFinite(n) && n > 0) out.budget = Math.round(n);
    out.currency = unit === "€" || unit.startsWith("eur") ? "EUR" : unit === "£" || unit.startsWith("gbp") || unit.startsWith("pound") ? "GBP" : "USD";
  }
  if (/excl\w*\.?\s+flights?|not including flights?|without flights?|before flights?/.test(lower)) out.excludesFlights = true;
  else if (/includ\w* flights?/.test(lower)) out.excludesFlights = false;

  if (/couple|romantic|honeymoon|anniversary|my (wife|husband|partner|girlfriend|boyfriend)/.test(lower)) {
    out.party = "couple";
    out.travelers = 2;
  } else if (/famil|kids|children/.test(lower)) out.party = "family";
  else if (/friends|group|bachelor/.test(lower)) out.party = "friends";
  else if (/solo|by myself|alone/.test(lower)) {
    out.party = "solo";
    out.travelers = 1;
  } else if (/business|work trip|conference/.test(lower)) out.party = "business";
  const people = lower.match(/(\d{1,2})\s*(people|travell?ers|adults|of us)/);
  if (people) out.travelers = Number(people[1]);

  if (/no packed|not packed|don'?t (want to )?rush|relax|slow|laid.?back|unhurried|easy pace/.test(lower)) out.pace = "relaxed";
  else if (/packed|as much as possible|action.?packed|busy/.test(lower)) out.pace = "packed";

  for (const [re, label] of INTEREST_RULES) if (re.test(text) && !out.interests.includes(label)) out.interests.push(label);

  if (out.destinations?.length) {
    const romantic = out.party === "couple";
    out.name = `${out.destinations.join(" & ")} ${romantic ? "getaway" : "trip"}`;
  }
  return out;
}
