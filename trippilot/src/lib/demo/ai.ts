// Scripted "demo mode" AI used when no Anthropic API key is configured.
// It produces the same validated shapes as the live planner, built from a
// curated place library, and every response is labelled as demo content.
import type { AIActivity, AIChatResponse, AIDay, AIItinerary } from "../schemas";
import type { Activity, ActivityCategory, DaySlot, ItineraryDay, TripBundle } from "../types";
import { romeLibrary, type SeedActivity } from "./rome";
import { findCityCenter, jitter } from "../geo";
import { addDays, formatMoney, parseDate, todayString, tripLength } from "../utils";
import { budgetSnapshot } from "../ai/context";

type Place = SeedActivity;

const FLORENCE: Place[] = [
  { name: "Uffizi Gallery", description: "Botticelli's Birth of Venus and the greatest Renaissance collection anywhere.", category: "museum", slot: "morning", time: "09:00", duration: 150, cost: 60, address: "Piazzale degli Uffizi 6, Florence", lat: 43.7678, lng: 11.2553, url: "https://www.uffizi.it", notes: "Timed tickets strongly recommended." },
  { name: "Duomo & Brunelleschi's Dome", description: "Climb the dome for the definitive view over Florence's terracotta rooftops.", category: "sightseeing", slot: "morning", time: "09:30", duration: 120, cost: 70, address: "Piazza del Duomo, Florence", lat: 43.7731, lng: 11.256, url: "https://duomo.firenze.it", notes: "Dome climbs require a reserved slot." },
  { name: "Galleria dell'Accademia", description: "See Michelangelo's David up close.", category: "museum", slot: "afternoon", time: "15:00", duration: 75, cost: 40, address: "Via Ricasoli 58/60, Florence", lat: 43.7768, lng: 11.2586 },
  { name: "Ponte Vecchio & Oltrarno artisans", description: "Cross the medieval bridge into the workshop-filled Oltrarno.", category: "sightseeing", slot: "afternoon", time: "16:00", duration: 90, cost: 0, address: "Ponte Vecchio, Florence", lat: 43.768, lng: 11.2531 },
  { name: "Boboli Gardens", description: "Terraced Renaissance gardens behind Palazzo Pitti — shady and serene.", category: "outdoors", slot: "afternoon", time: "15:00", duration: 105, cost: 25, address: "Piazza de' Pitti 1, Florence", lat: 43.7625, lng: 11.2486 },
  { name: "Sunset at Piazzale Michelangelo", description: "The classic Florence panorama as the light turns gold.", category: "outdoors", slot: "evening", time: "18:30", duration: 60, cost: 0, address: "Piazzale Michelangelo, Florence", lat: 43.7629, lng: 11.265 },
  { name: "Mercato Centrale", description: "Upstairs food hall with Tuscan specialities; downstairs the working market.", category: "food", restaurant: true, slot: "afternoon", time: "13:00", duration: 60, cost: 45, address: "Via dell'Ariento, Florence", lat: 43.7764, lng: 11.2534 },
  { name: "Trattoria Mario", description: "Lunch-only, communal tables, legendary ribollita and bistecca.", category: "restaurant", restaurant: true, slot: "afternoon", time: "12:30", duration: 75, cost: 60, address: "Via Rosina 2r, Florence", lat: 43.7761, lng: 11.2538, notes: "No reservations; cash recommended." },
  { name: "Dinner at Buca Mario", description: "Historic cellar restaurant serving Florentine classics since 1886.", category: "restaurant", restaurant: true, slot: "evening", time: "20:00", duration: 120, cost: 180, address: "Piazza degli Ottaviani 16r, Florence", lat: 43.7718, lng: 11.2486 },
  { name: "Dinner at Il Santo Bevitore", description: "Warm Oltrarno favourite with seasonal Tuscan cooking and a great wine list.", category: "restaurant", restaurant: true, slot: "evening", time: "20:00", duration: 105, cost: 130, address: "Via di Santo Spirito 64/66r, Florence", lat: 43.7686, lng: 11.2468 },
  { name: "Enoteca Pinchiorri", description: "Florence's grand temple of fine dining and one of Italy's great wine cellars.", category: "restaurant", restaurant: true, slot: "evening", time: "20:00", duration: 180, cost: 900, address: "Via Ghibellina 87, Florence", lat: 43.7697, lng: 11.2592, notes: "Splurge; reserve far ahead." },
  { name: "Aperitivo in Piazza Santo Spirito", description: "The Oltrarno's liveliest square after dark.", category: "nightlife", slot: "evening", time: "22:00", duration: 90, cost: 40, address: "Piazza Santo Spirito, Florence", lat: 43.7664, lng: 11.2478 },
  { name: "Chianti wine-country drive", description: "Half-day among vineyards and hill towns with a winery tasting.", category: "outdoors", slot: "morning", time: "09:30", duration: 240, cost: 260, address: "Greve in Chianti", lat: 43.5843, lng: 11.3164, notes: "Book a driver or tour if you plan to taste." },
];

const ROME_EXTRA: Place[] = [
  { name: "Orange Garden at sunset", description: "Romantic hilltop garden on the Aventine with views to St. Peter's.", category: "outdoors", slot: "evening", time: "18:00", duration: 45, cost: 0, address: "Piazza Pietro d'Illiria, Rome", lat: 41.8848, lng: 12.4796 },
  { name: "Villa Doria Pamphilj picnic", description: "Rome's largest landscaped park — pick up supplies and picnic under the pines.", category: "outdoors", slot: "afternoon", time: "14:00", duration: 120, cost: 30, address: "Via di San Pancrazio, Rome", lat: 41.8853, lng: 12.4544 },
  { name: "Aventine Keyhole", description: "Peek through the famous keyhole for a perfectly framed dome.", category: "sightseeing", slot: "evening", time: "17:30", duration: 30, cost: 0, address: "Piazza dei Cavalieri di Malta, Rome", lat: 41.8833, lng: 12.4789 },
  { name: "Aventine & Rose Garden morning walk", description: "A peaceful hilltop stroll past the Rose Garden and the Orange Garden terrace.", category: "outdoors", slot: "morning", time: "10:00", duration: 90, cost: 0, address: "Via di Valle Murcia 6, Rome", lat: 41.8846, lng: 12.4825, notes: "The Rose Garden opens seasonally — check dates." },
  { name: "Capitoline Museums", description: "The world's oldest public museum, with a terrace over the Forum.", category: "museum", slot: "afternoon", time: "15:00", duration: 120, cost: 40, address: "Piazza del Campidoglio 1, Rome", lat: 41.8933, lng: 12.4828 },
];

function libraryFor(city: string): Place[] | null {
  if (/rome|roma/i.test(city)) return [...romeLibrary(), ...ROME_EXTRA];
  if (/florence|firenze/i.test(city)) return FLORENCE;
  return null;
}

function genericLibrary(city: string): Place[] {
  const c = findCityCenter(city);
  const label = city.split(",")[0].trim();
  const at = (i: number) => (c ? jitter(c, i) : [null, null]) as [number | null, number | null];
  const mk = (
    i: number,
    name: string,
    description: string,
    category: ActivityCategory,
    slot: DaySlot,
    time: string,
    duration: number,
    cost: number,
    restaurant = false,
  ): Place => {
    const [lat, lng] = at(i);
    return {
      name,
      description,
      category,
      slot,
      time,
      duration,
      cost,
      restaurant,
      address: `${label} (demo placeholder)`,
      lat: lat ?? NaN,
      lng: lng ?? NaN,
      notes: "Demo suggestion — connect the AI planner to get specific, named places.",
    };
  };
  return [
    mk(0, `${label} old town walking tour`, "Get your bearings with a guided walk through the historic core.", "sightseeing", "morning", "09:30", 150, 40),
    mk(1, `${label}'s signature museum`, "The city's must-see collection — a rainy-day favourite.", "museum", "morning", "10:00", 120, 30),
    mk(2, `${label} central food market`, "Graze local specialities where residents shop.", "food", "afternoon", "12:30", 60, 25, true),
    mk(3, `Neighborhood lunch spot in ${label}`, "A well-reviewed local favourite for a relaxed lunch.", "restaurant", "afternoon", "13:00", 75, 50, true),
    mk(4, `${label} park or waterfront stroll`, "Fresh air and people-watching between sights.", "outdoors", "afternoon", "15:30", 90, 0),
    mk(5, `Sunset viewpoint over ${label}`, "The best panorama in town at golden hour.", "outdoors", "evening", "18:00", 60, 0),
    mk(6, `Dinner featuring ${label} cuisine`, "A highly rated restaurant for regional dishes.", "restaurant", "evening", "20:00", 105, 120, true),
    mk(7, `Cocktail bar in ${label}`, "A stylish spot for a nightcap.", "nightlife", "evening", "22:00", 75, 40),
    mk(8, `Local cooking or craft class in ${label}`, "Hands-on experience with a local host.", "experience", "afternoon", "15:00", 150, 90),
    mk(9, `${label} historic landmark`, "An iconic site worth the visit.", "sightseeing", "afternoon", "15:00", 90, 20),
  ];
}

function toAI(p: Place): AIActivity {
  return {
    name: p.name,
    description: p.description,
    category: p.category,
    is_restaurant: Boolean(p.restaurant),
    slot: p.slot,
    suggested_time: p.time,
    duration_minutes: p.duration,
    estimated_cost: p.cost,
    address: p.address,
    latitude: Number.isFinite(p.lat) ? p.lat : null,
    longitude: Number.isFinite(p.lng) ? p.lng : null,
    booking_url: p.url ?? null,
    notes: p.notes ?? "",
  };
}

function splitCities(destinations: string[], days: number): string[] {
  const list = destinations.length ? destinations : ["Your destination"];
  const per = Math.max(1, Math.floor(days / list.length));
  return Array.from({ length: days }, (_, i) => list[Math.min(list.length - 1, Math.floor(i / per))]);
}

function pickDay(pool: Place[], used: Set<string>, pace: string, opts: { light?: boolean; preferOutdoor?: boolean } = {}) {
  const avail = pool.filter((p) => !used.has(p.name));
  const take = (pred: (p: Place) => boolean) => {
    const found = avail.find((p) => pred(p) && !used.has(p.name));
    if (found) used.add(found.name);
    return found;
  };
  const sights = (slot: DaySlot) => (p: Place) =>
    !p.restaurant && p.slot === slot && p.category !== "nightlife" && (!opts.preferOutdoor || p.category === "outdoors");
  const fallbackSight = (slot: DaySlot) => (p: Place) => !p.restaurant && p.slot === slot && p.category !== "nightlife";

  const out: (Place | undefined)[] = [];
  out.push(take(sights("morning")) ?? take(fallbackSight("morning")));
  out.push(take((p) => Boolean(p.restaurant) && p.slot === "afternoon"));
  if (!opts.light && pace !== "relaxed") out.push(take(sights("afternoon")) ?? take(fallbackSight("afternoon")));
  if (pace === "packed") out.push(take(fallbackSight("afternoon")));
  if (!opts.light) out.push(take((p) => !p.restaurant && p.slot === "evening" && p.category !== "nightlife"));
  out.push(take((p) => Boolean(p.restaurant) && p.slot === "evening"));
  if (pace !== "relaxed" || !opts.light) out.push(take((p) => p.category === "nightlife"));
  return out.filter((p): p is Place => Boolean(p));
}

export function demoItinerary(bundle: TripBundle): AIItinerary {
  const t = bundle.trip;
  const n = tripLength(t.start_date, t.end_date);
  const cities = splitCities(t.destinations, n);
  const usedByCity = new Map<string, Set<string>>();
  const days: AIDay[] = cities.map((city, i) => {
    const pool = libraryFor(city) ?? genericLibrary(city);
    const used = usedByCity.get(city) ?? new Set<string>();
    usedByCity.set(city, used);
    const isEdge = i === 0 || i === n - 1;
    let picks = pickDay(pool, used, t.pace, { light: isEdge });
    if (picks.length < 2) {
      used.clear();
      picks = pickDay(pool, used, t.pace, { light: isEdge });
    }
    const label = city.split(",")[0];
    const moved = i > 0 && cities[i - 1] !== city;
    const acts = picks.map(toAI);
    return {
      day_number: i + 1,
      date: addDays(t.start_date, i),
      city: label,
      title: i === 0 ? `Arrival in ${label}` : i === n - 1 ? `Last day in ${label}` : `Exploring ${label}`,
      summary: `A ${t.pace} day in ${label} built around your interests.`,
      morning_summary: acts.find((a) => a.slot === "morning")?.name ?? "Slow start.",
      afternoon_summary: acts.filter((a) => a.slot === "afternoon").map((a) => a.name).join(", ") || "Free time.",
      evening_summary: acts.filter((a) => a.slot === "evening").map((a) => a.name).join(", ") || "Free evening.",
      transport_notes: moved
        ? `Travel day: transfer from ${cities[i - 1].split(",")[0]} to ${label} (train is usually easiest — check timetables).`
        : "Mostly walkable; use taxis or public transit for longer hops.",
      notes: "Demo itinerary: sample suggestions, not generated by AI. Costs are rough estimates.",
      estimated_cost: acts.reduce((s, a) => s + (a.estimated_cost ?? 0), 0),
      activities: acts,
    };
  });
  return {
    overview: `Demo plan for ${t.destinations.join(" & ")}: ${n} ${t.pace} days mixing highlights, great food and downtime.`,
    days,
  };
}

function usedNames(bundle: TripBundle) {
  return new Set(bundle.days.flatMap((d) => d.activities.map((a) => a.name)));
}

export function demoRegenerateDay(bundle: TripBundle, day: ItineraryDay, instructions: string): AIDay {
  const pool = libraryFor(day.city) ?? genericLibrary(day.city);
  const used = usedNames(bundle);
  for (const a of day.activities) used.delete(a.name);
  // Don't immediately re-suggest the same things for this day.
  const current = new Set(day.activities.filter((a) => !a.user_modified).map((a) => a.name));
  const light = /relax|less busy|lighter|slow|easy|rest/i.test(instructions);
  const preferOutdoor = /outdoor|outside|nature|park|garden|fresh air/i.test(instructions);
  const filtered = pool.filter((p) => !current.has(p.name));
  let picks = pickDay(filtered.length >= 4 ? filtered : pool, used, bundle.trip.pace, { light, preferOutdoor });
  if (!picks.length) picks = pickDay(pool, new Set(), bundle.trip.pace, { light, preferOutdoor });
  const acts = picks.map(toAI);
  return {
    day_number: day.day_number,
    date: day.date,
    city: day.city,
    title: preferOutdoor ? `${day.city} in the open air` : light ? `An easy day in ${day.city}` : `A fresh take on ${day.city}`,
    summary: `Re-planned ${light ? "lighter " : ""}day${preferOutdoor ? " with more time outdoors" : ""}. (Demo content.)`,
    morning_summary: acts.find((a) => a.slot === "morning")?.name ?? "Slow start.",
    afternoon_summary: acts.filter((a) => a.slot === "afternoon").map((a) => a.name).join(", ") || "Free time.",
    evening_summary: acts.filter((a) => a.slot === "evening").map((a) => a.name).join(", ") || "Free evening.",
    transport_notes: day.transport_notes,
    notes: "Demo regeneration: sample suggestions, not generated by AI.",
    estimated_cost: acts.reduce((s, a) => s + (a.estimated_cost ?? 0), 0),
    activities: acts,
  };
}

function alternativeFor(bundle: TripBundle, day: ItineraryDay, target: Activity, instructions: string): Place | null {
  const pool = libraryFor(day.city) ?? genericLibrary(day.city);
  const used = usedNames(bundle);
  const wantOutdoor = /outdoor|outside|nature|park|garden/i.test(instructions);
  const candidates = pool.filter((p) => !used.has(p.name) && Boolean(p.restaurant) === target.is_restaurant);
  const ranked = candidates.sort((a, b) => {
    const score = (p: Place) =>
      (wantOutdoor && p.category === "outdoors" ? -10 : 0) +
      (p.slot === target.slot ? -5 : 0) +
      (p.category === target.category ? -4 : 0) +
      (/sunset/i.test(p.name) && target.slot !== "evening" ? 6 : 0);
    return score(a) - score(b);
  });
  return ranked[0] ?? null;
}

export function demoRegenerateActivity(
  bundle: TripBundle,
  day: ItineraryDay,
  target: Activity,
  instructions: string,
): AIActivity {
  const alt = alternativeFor(bundle, day, target, instructions);
  if (alt) return { ...toAI(alt), slot: target.slot, suggested_time: target.suggested_time ?? alt.time };
  const g = genericLibrary(day.city).find((p) => Boolean(p.restaurant) === target.is_restaurant) ?? genericLibrary(day.city)[0];
  return { ...toAI(g), slot: target.slot, suggested_time: target.suggested_time };
}

// ---------------- Concierge ----------------

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function resolveDay(bundle: TripBundle, text: string): { day: ItineraryDay | null; note: string } {
  const days = bundle.days;
  if (!days.length) return { day: null, note: "" };
  const lower = text.toLowerCase();
  const m = lower.match(/day\s*(\d+)/);
  if (m) return { day: days.find((d) => d.day_number === Number(m[1])) ?? null, note: "" };
  const wd = WEEKDAYS.findIndex((w) => lower.includes(w));
  if (wd >= 0) {
    const d = days.find((x) => parseDate(x.date).getDay() === wd);
    return { day: d ?? null, note: d ? "" : `Your trip doesn't include a ${WEEKDAYS[wd]}.` };
  }
  const today = todayString();
  const active = days.find((d) => d.date === today);
  if (/tomorrow/.test(lower)) {
    if (active) return { day: days.find((d) => d.day_number === active.day_number + 1) ?? null, note: "" };
    return { day: days[1] ?? days[0], note: "Your trip hasn't started yet, so I've treated “tomorrow” as Day 2." };
  }
  if (/today|tonight/.test(lower)) {
    if (active) return { day: active, note: "" };
    return { day: days[0], note: "Your trip hasn't started yet, so I've used Day 1." };
  }
  return { day: null, note: "" };
}

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function hotelLocation(bundle: TripBundle): { name: string; coords: [number, number] | null } | null {
  const stay = bundle.days.flatMap((d) => d.activities).find((a) => a.category === "accommodation");
  if (stay) return { name: stay.name.replace(/^check in at /i, ""), coords: stay.latitude !== null && stay.longitude !== null ? [stay.latitude, stay.longitude] : null };
  const hotel = bundle.bookings.find((b) => b.type === "hotel");
  if (hotel) return { name: hotel.name, coords: null };
  return null;
}

const DEMO_PREFIX = "";

export function demoConcierge(bundle: TripBundle, message: string): AIChatResponse {
  const text = message.toLowerCase();
  const c = bundle.trip.currency;
  const { day, note } = resolveDay(bundle, message);
  const prefix = note ? `${note}\n\n` : DEMO_PREFIX;

  // Budget
  if (/spent|spend|budget|how much|cost so far|remaining/.test(text)) {
    const s = budgetSnapshot(bundle);
    return {
      reply: `${prefix}Here's where your budget stands:\n- Spent so far: ${formatMoney(s.spent, c)}\n- Planned (not yet paid): ${formatMoney(s.planned, c)}\n- Remaining after planned costs: ${formatMoney(s.remaining, c)} of ${formatMoney(bundle.trip.budget, c)}\n\nThe activities in your itinerary are estimated at about ${formatMoney(s.itineraryEstimate, c)} in total. You can log new expenses in the Budget tab.`,
      proposal: null,
    };
  }

  // Rain plan
  if (/rain|wet|storm|bad weather/.test(text)) {
    const indoor = bundle.days
      .flatMap((d) => d.activities.map((a) => ({ a, d })))
      .filter(({ a }) => ["museum", "experience", "wellness", "food"].includes(a.category))
      .slice(0, 4);
    const city = day?.city ?? bundle.days[0]?.city ?? bundle.trip.destinations[0] ?? "the city";
    const lib = (libraryFor(city) ?? genericLibrary(city)).filter((p) => p.category === "museum").slice(0, 2);
    return {
      reply: `${prefix}If it rains, lean into the indoor highlights:\n${indoor.map(({ a, d }) => `- ${a.name} (Day ${d.day_number})`).join("\n") || "- A long lunch and a museum afternoon"}\n${lib.length ? `\nOther good indoor options in ${city}:\n${lib.map((p) => `- ${p.name}`).join("\n")}` : ""}\n\nI can't see live weather yet, so check the forecast the evening before. Want me to swap an outdoor stop for one of these?`,
      proposal: null,
    };
  }

  // Restaurants near the hotel
  if (/restaurant|eat|dinner|lunch/.test(text) && /near|close|around|walking/.test(text) && /hotel|stay/.test(text)) {
    const hotel = hotelLocation(bundle);
    const restaurants = bundle.days.flatMap((d) => d.activities.filter((a) => a.is_restaurant && a.latitude !== null && a.longitude !== null));
    if (hotel?.coords) {
      const sorted = restaurants
        .map((r) => ({ r, km: haversineKm(hotel.coords!, [r.latitude!, r.longitude!]) }))
        .sort((x, y) => x.km - y.km)
        .slice(0, 4);
      return {
        reply: `${prefix}Closest restaurants to ${hotel.name} from your plan:\n${sorted.map(({ r, km }) => `- ${r.name} — about ${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}`).join("\n")}\n\nDistances are straight-line estimates. Always check opening hours and reserve ahead for dinner.`,
        proposal: null,
      };
    }
    return {
      reply: `${prefix}Add your hotel (with its address) in the Bookings tab and I'll rank restaurants by distance from it.`,
      proposal: null,
    };
  }

  // Romantic tonight
  if (/romantic|date night|special evening/.test(text)) {
    const city = day?.city ?? bundle.days[0]?.city ?? bundle.trip.destinations[0] ?? "";
    const pool = libraryFor(city) ?? genericLibrary(city);
    const used = usedNames(bundle);
    const spot = pool.find((p) => p.category === "outdoors" && p.slot === "evening" && !used.has(p.name)) ?? pool.find((p) => p.category === "outdoors" && !used.has(p.name));
    const dinner = pool.find((p) => p.restaurant && p.slot === "evening" && !used.has(p.name));
    if (day && spot) {
      return {
        reply: `${prefix}For a romantic evening on Day ${day.day_number}, I'd start with ${spot.name} — ${spot.description.toLowerCase()}${dinner ? ` Then dinner at ${dinner.name.replace(/^dinner at /i, "")}.` : ""}\n\nWant me to add it to your plan?`,
        proposal: {
          summary: `Add ${spot.name} to Day ${day.day_number}`,
          operations: [{ type: "add_activity", activity_id: null, day_number: day.day_number, reason: "Romantic sunset stop", activity: { ...toAI(spot), slot: "evening" } }],
        },
      };
    }
  }

  // Make a day lighter
  if (/less busy|lighter|too much|slow down|more relaxed|fewer/.test(text)) {
    const target = day ?? bundle.days[1] ?? bundle.days[0];
    if (target) {
      const removable = target.activities
        .filter((a) => !a.is_restaurant && !a.user_modified && a.category !== "accommodation" && !a.completed)
        .sort((a, b) => (b.duration_minutes ?? 0) - (a.duration_minutes ?? 0));
      if (removable.length > 1 || (removable.length === 1 && target.activities.length > 2)) {
        const victim = removable[0];
        return {
          reply: `${prefix}Day ${target.day_number} has ${target.activities.length} stops. To give you more breathing room I'd drop ${victim.name} (${Math.round((victim.duration_minutes ?? 60) / 60)}h). Your meals and anything you edited stay as they are.`,
          proposal: {
            summary: `Remove ${victim.name} from Day ${target.day_number}`,
            operations: [{ type: "remove_activity", activity_id: victim.id, day_number: null, reason: "Lighten the day", activity: null }],
          },
        };
      }
      return { reply: `${prefix}Day ${target.day_number} is already pretty light — just meals and one or two highlights.`, proposal: null };
    }
  }

  // Replace / remove something (outdoors, museum…)
  if (/replace|swap|instead|remove|skip|cancel|outdoor|outside/.test(text)) {
    const target = day ?? bundle.days[1] ?? bundle.days[0];
    if (target) {
      const wantOutdoor = /outdoor|outside|nature|park|garden/.test(text);
      const slotHint = (["morning", "afternoon", "evening"] as DaySlot[]).find((s) => text.includes(s));
      const catHint: ActivityCategory | undefined = /museum|gallery/.test(text) ? "museum" : /restaurant|dinner|lunch/.test(text) ? "restaurant" : undefined;
      const candidates = target.activities.filter(
        (a) =>
          !a.user_modified &&
          a.category !== "accommodation" &&
          (!slotHint || a.slot === slotHint) &&
          (!catHint || a.category === catHint || (catHint === "restaurant" && a.is_restaurant)) &&
          (!wantOutdoor || a.category !== "outdoors"),
      );
      const victim = candidates.find((a) => !a.is_restaurant) ?? candidates[0];
      if (victim) {
        const isRemoval = /remove|skip|cancel/.test(text) && !wantOutdoor && !/replace|swap|instead/.test(text);
        if (isRemoval) {
          return {
            reply: `${prefix}I can remove ${victim.name} from Day ${target.day_number}. Want me to?`,
            proposal: {
              summary: `Remove ${victim.name} from Day ${target.day_number}`,
              operations: [{ type: "remove_activity", activity_id: victim.id, day_number: null, reason: "Requested by traveler", activity: null }],
            },
          };
        }
        const alt = alternativeFor(bundle, target, victim, wantOutdoor ? "outdoor" : text);
        if (alt) {
          return {
            reply: `${prefix}Here's my suggestion for Day ${target.day_number}: swap ${victim.name} for ${alt.name}. ${alt.description}`,
            proposal: {
              summary: `Replace ${victim.name} with ${alt.name}`,
              operations: [{ type: "replace_activity", activity_id: victim.id, day_number: null, reason: wantOutdoor ? "Something outdoors" : "Requested change", activity: { ...toAI(alt), slot: victim.slot, suggested_time: victim.suggested_time } }],
            },
          };
        }
      }
      return { reply: `${prefix}I couldn't find a good match to change on Day ${target.day_number}. Try naming the activity you'd like to swap.`, proposal: null };
    }
  }

  // Getting around
  if (/get from|how do (we|i) get|best way to get|directions|taxi|metro|walk to/.test(text)) {
    return {
      reply: `${prefix}In ${bundle.days[0]?.city ?? "the city"}, most central stops in your plan are walkable within 15–25 minutes. For anything over ~2 km, a licensed taxi or ride-hailing app is easiest; public transit is cheapest. Each day's transport notes in the Itinerary tab have specifics. Open the Map tab to see how stops cluster.`,
      proposal: null,
    };
  }

  // Default: summarize next day
  const next = day ?? bundle.days[0];
  return {
    reply: next
      ? `${prefix}Day ${next.day_number} (${next.city}) — ${next.title}:\n${next.activities.map((a) => `- ${a.suggested_time ?? a.slot}: ${a.name}`).join("\n")}\n\nI can make a day lighter, swap something for an outdoor option, suggest a rainy-day plan, find restaurants near your hotel, or check your budget.`
      : "Your trip doesn't have an itinerary yet. Generate one from the Itinerary tab and I'll help you refine it.",
    proposal: null,
  };
}
