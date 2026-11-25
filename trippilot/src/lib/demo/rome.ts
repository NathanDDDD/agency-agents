// Sample content for demo mode. Everything here is illustrative: places are
// real, but prices are rough estimates and confirmation numbers are fake.
import type {
  Activity,
  ActivityCategory,
  Booking,
  ChatMessage,
  DaySlot,
  Expense,
  ItineraryDay,
  SavedPlace,
  Trip,
  TripBundle,
} from "../types";
import { addDays, nowIso, todayString, uid } from "../utils";
import { PHOTOS } from "../images";

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

export type SeedActivity = {
  name: string;
  description: string;
  category: ActivityCategory;
  restaurant?: boolean;
  slot: DaySlot;
  time: string;
  duration: number;
  cost: number;
  address: string;
  lat: number;
  lng: number;
  url?: string;
  notes?: string;
};

type SeedDay = {
  title: string;
  city: string;
  summary: string;
  morning: string;
  afternoon: string;
  evening: string;
  transport: string;
  notes?: string;
  activities: SeedActivity[];
};

const ROME_DAYS: SeedDay[] = [
  {
    title: "Arrivederci jet lag",
    city: "Rome",
    summary: "Settle in near the Spanish Steps, an easy evening stroll and a classic Roman dinner.",
    morning: "Arrive and transfer to the hotel.",
    afternoon: "Check in, rest, and wander Via Condotti.",
    evening: "Aperitivo in a hotel garden, then cacio e pepe near the Pantheon.",
    transport: "Pre-booked private transfer from FCO (~50 min). Everything this evening is walkable.",
    activities: [
      {
        name: "Check in at Hotel de Russie",
        description: "Luxury hotel between Piazza del Popolo and the Spanish Steps with a terraced secret garden.",
        category: "accommodation",
        slot: "afternoon",
        time: "14:00",
        duration: 60,
        cost: 0,
        address: "Via del Babuino 9, Rome",
        lat: 41.91,
        lng: 12.4767,
        notes: "Request an early check-in when booking; not guaranteed.",
      },
      {
        name: "Spanish Steps & Via Condotti stroll",
        description: "Gentle first walk through Rome's most elegant shopping streets.",
        category: "sightseeing",
        slot: "afternoon",
        time: "16:30",
        duration: 75,
        cost: 0,
        address: "Piazza di Spagna, Rome",
        lat: 41.9058,
        lng: 12.4823,
        notes: "Sitting on the steps is not allowed.",
      },
      {
        name: "Aperitivo at Stravinskij Bar",
        description: "Spritz and olives in the hotel's courtyard garden — the perfect soft landing.",
        category: "nightlife",
        restaurant: true,
        slot: "evening",
        time: "18:30",
        duration: 60,
        cost: 70,
        address: "Via del Babuino 9, Rome",
        lat: 41.9101,
        lng: 12.4765,
      },
      {
        name: "Dinner at Armando al Pantheon",
        description: "Family-run trattoria since 1961, famous for cacio e pepe and carbonara.",
        category: "restaurant",
        restaurant: true,
        slot: "evening",
        time: "20:00",
        duration: 105,
        cost: 140,
        address: "Salita de' Crescenzi 31, Rome",
        lat: 41.899,
        lng: 12.4757,
        notes: "Small dining room — reserve well ahead.",
      },
      {
        name: "Pantheon by night",
        description: "The piazza glows after dark; grab a gelato and take it all in.",
        category: "sightseeing",
        slot: "evening",
        time: "22:00",
        duration: 30,
        cost: 0,
        address: "Piazza della Rotonda, Rome",
        lat: 41.8986,
        lng: 12.4769,
      },
    ],
  },
  {
    title: "Ancient Rome, unhurried",
    city: "Rome",
    summary: "The Colosseum and Forum with an expert guide, a legendary deli lunch and a slow afternoon.",
    morning: "Private guided tour of the Colosseum, then the Roman Forum and Palatine Hill.",
    afternoon: "Lunch at Roscioli, then downtime at the hotel spa.",
    evening: "Roman classics at Pierluigi and cocktails at a speakeasy.",
    transport: "Taxi to the Colosseum (~10 min). Walk to lunch through the Jewish Ghetto.",
    notes: "Wear comfortable shoes — the Forum is uneven underfoot.",
    activities: [
      {
        name: "Colosseum guided tour",
        description: "Small-group or private tour including the arena floor.",
        category: "sightseeing",
        slot: "morning",
        time: "09:00",
        duration: 120,
        cost: 180,
        address: "Piazza del Colosseo, Rome",
        lat: 41.8902,
        lng: 12.4922,
        url: "https://colosseo.it",
        notes: "Book timed tickets in advance on the official site.",
      },
      {
        name: "Roman Forum & Palatine Hill",
        description: "Walk the heart of ancient Rome; the Palatine views over the Forum are spectacular.",
        category: "sightseeing",
        slot: "morning",
        time: "11:15",
        duration: 90,
        cost: 0,
        address: "Via della Salara Vecchia 5/6, Rome",
        lat: 41.8925,
        lng: 12.4853,
        notes: "Usually included with the Colosseum ticket — check your ticket type.",
      },
      {
        name: "Lunch at Roscioli Salumeria",
        description: "Deli-restaurant with an extraordinary cheese, cured-meat and wine selection.",
        category: "restaurant",
        restaurant: true,
        slot: "afternoon",
        time: "13:30",
        duration: 90,
        cost: 120,
        address: "Via dei Giubbonari 21, Rome",
        lat: 41.8937,
        lng: 12.4734,
      },
      {
        name: "Spa & rest at the hotel",
        description: "Built-in downtime — you asked for no packed schedule.",
        category: "wellness",
        slot: "afternoon",
        time: "15:30",
        duration: 150,
        cost: 0,
        address: "Via del Babuino 9, Rome",
        lat: 41.9102,
        lng: 12.477,
      },
      {
        name: "Dinner at Pierluigi",
        description: "Elegant seafood-forward Roman restaurant on a quiet piazza.",
        category: "restaurant",
        restaurant: true,
        slot: "evening",
        time: "20:00",
        duration: 120,
        cost: 190,
        address: "Piazza de' Ricci 144, Rome",
        lat: 41.8968,
        lng: 12.4699,
      },
      {
        name: "Cocktails at Jerry Thomas Speakeasy",
        description: "One of Rome's best-known cocktail bars, hidden behind an unmarked door.",
        category: "nightlife",
        slot: "evening",
        time: "22:30",
        duration: 90,
        cost: 60,
        address: "Vicolo Cellini 30, Rome",
        lat: 41.899,
        lng: 12.4689,
        notes: "Reservation and membership card may be required — check ahead.",
      },
    ],
  },
  {
    title: "Vatican treasures",
    city: "Rome",
    summary: "Early entry to the Vatican Museums, St. Peter's, and a Michelin-starred evening above the city.",
    morning: "Vatican Museums and the Sistine Chapel before the crowds.",
    afternoon: "St. Peter's Basilica, a relaxed lunch in Prati, sunset at Castel Sant'Angelo.",
    evening: "Tasting menu at La Pergola.",
    transport: "Taxi to the Vatican (~15 min). Taxi up Monte Mario to La Pergola (~20 min).",
    notes: "Shoulders and knees must be covered in St. Peter's.",
    activities: [
      {
        name: "Vatican Museums & Sistine Chapel",
        description: "Raphael Rooms, the Gallery of Maps and Michelangelo's ceiling.",
        category: "museum",
        slot: "morning",
        time: "08:30",
        duration: 180,
        cost: 140,
        address: "Viale Vaticano, Vatican City",
        lat: 41.9065,
        lng: 12.4536,
        url: "https://www.museivaticani.va",
        notes: "Book on the official site; early-entry tours sell out.",
      },
      {
        name: "St. Peter's Basilica",
        description: "Michelangelo's Pietà and, if you have energy, the climb to the dome.",
        category: "sightseeing",
        slot: "afternoon",
        time: "12:00",
        duration: 75,
        cost: 0,
        address: "Piazza San Pietro, Vatican City",
        lat: 41.9022,
        lng: 12.4539,
      },
      {
        name: "Lunch at Il Sorpasso",
        description: "Buzzy Prati bistro with excellent cured meats and seasonal plates.",
        category: "restaurant",
        restaurant: true,
        slot: "afternoon",
        time: "13:45",
        duration: 75,
        cost: 80,
        address: "Via Properzio 31, Rome",
        lat: 41.9069,
        lng: 12.4639,
      },
      {
        name: "Castel Sant'Angelo at sunset",
        description: "Walk the Ponte Sant'Angelo and catch golden hour from the terrace.",
        category: "sightseeing",
        slot: "afternoon",
        time: "17:00",
        duration: 90,
        cost: 40,
        address: "Lungotevere Castello 50, Rome",
        lat: 41.9031,
        lng: 12.4663,
      },
      {
        name: "Dinner at La Pergola",
        description: "Heinz Beck's celebrated tasting menu with panoramic views over Rome.",
        category: "restaurant",
        restaurant: true,
        slot: "evening",
        time: "20:00",
        duration: 180,
        cost: 900,
        address: "Via Alberto Cadlolo 101, Rome",
        lat: 41.9195,
        lng: 12.4467,
        notes: "Splurge night. Jacket recommended. Reserve months in advance.",
      },
    ],
  },
  {
    title: "Trastevere tastes",
    city: "Rome",
    summary: "Markets, a food walk through cobbled Trastevere, a viewpoint, and the city's best carbonara.",
    morning: "Late start, then Campo de' Fiori market.",
    afternoon: "Guided Trastevere food walk and the Gianicolo terrace.",
    evening: "Da Enzo al 29, then aperitivo-hopping.",
    transport: "Walk across Ponte Sisto into Trastevere. Taxi back.",
    activities: [
      {
        name: "Campo de' Fiori market",
        description: "Colourful morning market — great for spices, fruit and people-watching.",
        category: "food",
        slot: "morning",
        time: "10:30",
        duration: 60,
        cost: 20,
        address: "Piazza Campo de' Fiori, Rome",
        lat: 41.8956,
        lng: 12.4722,
      },
      {
        name: "Trastevere food walk",
        description: "Supplì, porchetta, pizza al taglio and gelato with a local guide.",
        category: "experience",
        slot: "afternoon",
        time: "12:30",
        duration: 180,
        cost: 220,
        address: "Piazza di Santa Maria in Trastevere, Rome",
        lat: 41.8897,
        lng: 12.4697,
        notes: "Choose a small-group tour with good reviews; let them know about any dietary needs.",
      },
      {
        name: "Gianicolo Terrace",
        description: "Sweeping panorama of Rome's domes — a short uphill walk from Trastevere.",
        category: "outdoors",
        slot: "afternoon",
        time: "16:30",
        duration: 60,
        cost: 0,
        address: "Piazzale Giuseppe Garibaldi, Rome",
        lat: 41.8919,
        lng: 12.4615,
      },
      {
        name: "Dinner at Da Enzo al 29",
        description: "Tiny, beloved trattoria known for carbonara and carciofi.",
        category: "restaurant",
        restaurant: true,
        slot: "evening",
        time: "19:30",
        duration: 90,
        cost: 90,
        address: "Via dei Vascellari 29, Rome",
        lat: 41.8885,
        lng: 12.4774,
        notes: "Expect a queue; arrive early.",
      },
      {
        name: "Aperitivo at Freni e Frizioni",
        description: "Lively Trastevere bar in a former garage — very Roman night scene.",
        category: "nightlife",
        slot: "evening",
        time: "21:30",
        duration: 90,
        cost: 40,
        address: "Via del Politeama 4, Rome",
        lat: 41.8919,
        lng: 12.47,
      },
    ],
  },
  {
    title: "Gardens & Bernini",
    city: "Rome",
    summary: "Borghese masterpieces, a leisurely park afternoon, a hands-on pasta class and Trevi at dusk.",
    morning: "Galleria Borghese.",
    afternoon: "Villa Borghese gardens and the Pincio terrace, then a pasta-making class.",
    evening: "Trevi Fountain and dinner at Antico Arco.",
    transport: "Walk from the hotel through the park. Taxi to dinner.",
    activities: [
      {
        name: "Galleria Borghese",
        description: "Bernini sculptures and Caravaggio paintings in an intimate villa.",
        category: "museum",
        slot: "morning",
        time: "10:00",
        duration: 120,
        cost: 60,
        address: "Piazzale Scipione Borghese 5, Rome",
        lat: 41.9142,
        lng: 12.4922,
        url: "https://galleriaborghese.beniculturali.it",
        notes: "Timed entry only — must be pre-booked.",
      },
      {
        name: "Villa Borghese & Pincio Terrace",
        description: "Rent a rowboat on the lake or simply stroll to the Pincio viewpoint.",
        category: "outdoors",
        slot: "afternoon",
        time: "12:30",
        duration: 90,
        cost: 15,
        address: "Piazzale Napoleone I, Rome",
        lat: 41.9113,
        lng: 12.48,
      },
      {
        name: "Pasta-making class",
        description: "Learn fettuccine and ravioli from a Roman chef, then eat what you make.",
        category: "experience",
        slot: "afternoon",
        time: "15:00",
        duration: 150,
        cost: 200,
        address: "Centro Storico, Rome",
        lat: 41.8975,
        lng: 12.4745,
        notes: "Many options exist; pick one with small groups.",
      },
      {
        name: "Trevi Fountain at dusk",
        description: "Toss a coin to guarantee your return to Rome.",
        category: "sightseeing",
        slot: "evening",
        time: "18:45",
        duration: 30,
        cost: 0,
        address: "Piazza di Trevi, Rome",
        lat: 41.9009,
        lng: 12.4833,
      },
      {
        name: "Dinner at Antico Arco",
        description: "Refined modern Roman cooking and a deep wine list on the Gianicolo.",
        category: "restaurant",
        restaurant: true,
        slot: "evening",
        time: "20:30",
        duration: 120,
        cost: 200,
        address: "Piazzale Aurelio 7, Rome",
        lat: 41.8858,
        lng: 12.4627,
      },
    ],
  },
  {
    title: "Appian Way farewell",
    city: "Rome",
    summary: "An e-bike ride along the ancient Appian Way and a long farewell lunch in Testaccio.",
    morning: "E-bike tour of the Appia Antica park.",
    afternoon: "Testaccio market and a last Roman lunch, then airport transfer.",
    evening: "Departure.",
    transport: "Taxi to the Appia Antica (~20 min). Private transfer to FCO from Testaccio (~40 min).",
    activities: [
      {
        name: "Appian Way e-bike ride",
        description: "Glide past aqueducts, tombs and umbrella pines on Rome's oldest road.",
        category: "outdoors",
        slot: "morning",
        time: "09:00",
        duration: 180,
        cost: 120,
        address: "Via Appia Antica 58, Rome",
        lat: 41.858,
        lng: 12.515,
      },
      {
        name: "Testaccio Market",
        description: "Locals' food market — try a trapizzino or a fresh sandwich.",
        category: "food",
        slot: "afternoon",
        time: "12:30",
        duration: 45,
        cost: 25,
        address: "Via Aldo Manuzio 66b, Rome",
        lat: 41.8774,
        lng: 12.4741,
      },
      {
        name: "Farewell lunch at Checchino dal 1887",
        description: "Historic Testaccio institution for traditional Roman cuisine.",
        category: "restaurant",
        restaurant: true,
        slot: "afternoon",
        time: "13:30",
        duration: 105,
        cost: 130,
        address: "Via di Monte Testaccio 30, Rome",
        lat: 41.8763,
        lng: 12.4757,
      },
    ],
  },
];

/** Flat list of every curated Rome place, used by the demo AI. */
export function romeLibrary(): SeedActivity[] {
  return ROME_DAYS.flatMap((d) => d.activities).filter((a) => a.category !== "accommodation");
}

function buildDays(tripId: string, start: string, seeds: SeedDay[], source: "demo"): ItineraryDay[] {
  const ts = nowIso();
  return seeds.map((d, i) => {
    const dayId = uid();
    const activities: Activity[] = d.activities.map((a, j) => ({
      id: uid(),
      day_id: dayId,
      trip_id: tripId,
      name: a.name,
      description: a.description,
      category: a.category,
      is_restaurant: Boolean(a.restaurant),
      slot: a.slot,
      suggested_time: a.time,
      duration_minutes: a.duration,
      estimated_cost: a.cost,
      address: a.address,
      latitude: a.lat,
      longitude: a.lng,
      booking_url: a.url ?? null,
      notes: a.notes ?? "",
      completed: false,
      sort_order: j,
      source,
      user_modified: false,
      created_at: ts,
      updated_at: ts,
    }));
    return {
      id: dayId,
      trip_id: tripId,
      day_number: i + 1,
      date: addDays(start, i),
      title: d.title,
      summary: d.summary,
      city: d.city,
      morning_summary: d.morning,
      afternoon_summary: d.afternoon,
      evening_summary: d.evening,
      transport_notes: d.transport,
      notes: d.notes ?? "",
      estimated_cost: activities.reduce((s, a) => s + (a.estimated_cost ?? 0), 0),
      source,
      created_at: ts,
      updated_at: ts,
      activities,
    };
  });
}

export function buildRomeDemo(userId = DEMO_USER_ID): TripBundle {
  const tripId = uid();
  const ts = nowIso();
  const start = addDays(todayString(), 24);
  const end = addDays(start, 5);

  const trip: Trip = {
    id: tripId,
    user_id: userId,
    name: "Roman Holiday",
    destinations: ["Rome, Italy"],
    start_date: start,
    end_date: end,
    travelers: 2,
    travel_party: "couple",
    budget: 8500,
    currency: "USD",
    budget_excludes_flights: true,
    pace: "relaxed",
    interests: ["Fine dining", "History", "Nightlife", "Local experiences"],
    description:
      "Six romantic days in Rome for a couple. Luxury hotel, amazing restaurants, historical places and nightlife — but no packed schedule.",
    special_requests: "One special splurge dinner. Keep afternoons light.",
    cover_image: PHOTOS.rome,
    itinerary_source: "demo",
    created_at: ts,
    updated_at: ts,
  };

  const days = buildDays(tripId, start, ROME_DAYS, "demo");

  const booking = (b: Partial<Booking> & Pick<Booking, "type" | "name">): Booking => ({
    id: uid(),
    trip_id: tripId,
    confirmation_number: "",
    date: null,
    time: null,
    end_date: null,
    address: "",
    booking_url: "",
    cost: null,
    notes: "",
    documents: [],
    created_at: ts,
    updated_at: ts,
    ...b,
  });

  const bookings: Booking[] = [
    booking({
      type: "flight",
      name: "JFK → FCO (sample flight)",
      confirmation_number: "DEMO-7QX2LP",
      date: start,
      time: "07:45",
      notes: "Sample booking for demo purposes. Arrival time shown.",
    }),
    booking({
      type: "hotel",
      name: "Hotel de Russie",
      confirmation_number: "DEMO-RUS-4471",
      date: start,
      end_date: end,
      time: "14:00",
      address: "Via del Babuino 9, Rome",
      cost: 4200,
      notes: "Deluxe room, 5 nights. Sample rate — not a real quote.",
    }),
    booking({
      type: "activity",
      name: "Colosseum guided tour",
      confirmation_number: "DEMO-COL-0921",
      date: addDays(start, 1),
      time: "09:00",
      address: "Piazza del Colosseo, Rome",
      booking_url: "https://colosseo.it",
      cost: 180,
    }),
    booking({
      type: "activity",
      name: "Vatican Museums early entry",
      confirmation_number: "DEMO-VAT-5530",
      date: addDays(start, 2),
      time: "08:30",
      address: "Viale Vaticano, Vatican City",
      booking_url: "https://www.museivaticani.va",
      cost: 140,
    }),
    booking({
      type: "restaurant",
      name: "La Pergola",
      confirmation_number: "DEMO-LP-2026",
      date: addDays(start, 2),
      time: "20:00",
      address: "Via Alberto Cadlolo 101, Rome",
      notes: "Table for 2. Jacket recommended.",
    }),
    booking({
      type: "transport",
      name: "Private airport transfer",
      confirmation_number: "DEMO-TRF-118",
      date: start,
      time: "08:30",
      address: "Fiumicino Airport (FCO), Terminal 3",
      cost: 75,
    }),
  ];

  const expense = (e: Omit<Expense, "id" | "trip_id" | "created_at" | "updated_at" | "currency">): Expense => ({
    id: uid(),
    trip_id: tripId,
    currency: "USD",
    created_at: ts,
    updated_at: ts,
    ...e,
  });

  const expenses: Expense[] = [
    expense({ description: "Hotel de Russie — 5 nights", category: "accommodation", amount: 4200, date: start, is_planned: true }),
    expense({ description: "Hotel deposit", category: "accommodation", amount: 850, date: todayString(), is_planned: false }),
    expense({ description: "Colosseum tour tickets", category: "activities", amount: 180, date: todayString(), is_planned: false }),
    expense({ description: "Vatican early entry", category: "activities", amount: 140, date: todayString(), is_planned: false }),
    expense({ description: "La Pergola tasting menu", category: "food", amount: 900, date: addDays(start, 2), is_planned: true }),
    expense({ description: "Dining & aperitivo (other days)", category: "food", amount: 1300, date: start, is_planned: true }),
    expense({ description: "Airport transfers", category: "transport", amount: 150, date: start, is_planned: true }),
    expense({ description: "Taxis around Rome", category: "transport", amount: 180, date: start, is_planned: true }),
  ];

  const messages: ChatMessage[] = [
    {
      id: uid(),
      trip_id: tripId,
      role: "assistant",
      content:
        "Ciao! I'm your TripPilot concierge for this Roman Holiday. I know your itinerary, bookings and budget. Ask me things like \"Can you make tomorrow less busy?\", \"What should we do if it rains?\" or \"How much have we spent so far?\"",
      proposal: null,
      mode: "demo",
      created_at: ts,
    },
  ];

  const place = (p: Omit<SavedPlace, "id" | "user_id" | "trip_id" | "created_at">): SavedPlace => ({
    id: uid(),
    user_id: userId,
    trip_id: tripId,
    created_at: ts,
    ...p,
  });

  const savedPlaces: SavedPlace[] = [
    place({ name: "Giolitti", city: "Rome", category: "food", notes: "Historic gelateria near the Pantheon.", latitude: 41.9009, longitude: 12.4766 }),
    place({ name: "Aventine Keyhole", city: "Rome", category: "sightseeing", notes: "Peek at St. Peter's through the keyhole.", latitude: 41.8833, longitude: 12.4789 }),
    place({ name: "Orange Garden (Giardino degli Aranci)", city: "Rome", category: "outdoors", notes: "Romantic sunset spot on the Aventine.", latitude: 41.8848, longitude: 12.4796 }),
  ];

  return { trip, days, bookings, expenses, messages, savedPlaces };
}

/** A short completed trip so the dashboard can show "past trips". */
export function buildLisbonPast(userId = DEMO_USER_ID): TripBundle {
  const tripId = uid();
  const ts = nowIso();
  const start = addDays(todayString(), -120);
  const end = addDays(start, 2);
  const trip: Trip = {
    id: tripId,
    user_id: userId,
    name: "Lisbon long weekend",
    destinations: ["Lisbon, Portugal"],
    start_date: start,
    end_date: end,
    travelers: 2,
    travel_party: "couple",
    budget: 1800,
    currency: "EUR",
    budget_excludes_flights: true,
    pace: "balanced",
    interests: ["Local cuisine", "Architecture"],
    description: "Three days of trams, tiles and pastéis de nata.",
    special_requests: "",
    cover_image: PHOTOS.lisbon,
    itinerary_source: "demo",
    created_at: ts,
    updated_at: ts,
  };
  const seeds: SeedDay[] = [
    {
      title: "Alfama & fado",
      city: "Lisbon",
      summary: "Wander the old Moorish quarter and end with live fado.",
      morning: "Tram 28 and São Jorge Castle.",
      afternoon: "Miradouros and tile-spotting.",
      evening: "Fado dinner.",
      transport: "Tram and walking.",
      activities: [
        { name: "São Jorge Castle", description: "Hilltop castle with views over the Tagus.", category: "sightseeing", slot: "morning", time: "10:00", duration: 90, cost: 30, address: "R. de Santa Cruz do Castelo, Lisbon", lat: 38.7139, lng: -9.1335 },
        { name: "Miradouro de Santa Luzia", description: "Tiled viewpoint over Alfama's rooftops.", category: "outdoors", slot: "afternoon", time: "14:00", duration: 45, cost: 0, address: "Largo Santa Luzia, Lisbon", lat: 38.7118, lng: -9.1304 },
      ],
    },
    {
      title: "Belém pastries",
      city: "Lisbon",
      summary: "Monuments of the Age of Discovery and the original pastel de nata.",
      morning: "Jerónimos Monastery.",
      afternoon: "Pastéis de Belém and the riverside.",
      evening: "Dinner in Príncipe Real.",
      transport: "Tram 15 to Belém.",
      activities: [
        { name: "Jerónimos Monastery", description: "Manueline masterpiece.", category: "sightseeing", slot: "morning", time: "10:00", duration: 90, cost: 24, address: "Praça do Império, Lisbon", lat: 38.6979, lng: -9.2068 },
        { name: "Pastéis de Belém", description: "The original custard tarts since 1837.", category: "food", restaurant: true, slot: "afternoon", time: "12:00", duration: 40, cost: 10, address: "R. de Belém 84-92, Lisbon", lat: 38.6975, lng: -9.2032 },
      ],
    },
  ];
  const days = buildDays(tripId, start, seeds, "demo").map((d) => ({
    ...d,
    activities: d.activities.map((a) => ({ ...a, completed: true })),
  }));
  return { trip, days, bookings: [], expenses: [
    { id: uid(), trip_id: tripId, description: "Boutique hotel — 2 nights", category: "accommodation", amount: 520, currency: "EUR", date: start, is_planned: false, created_at: ts, updated_at: ts },
    { id: uid(), trip_id: tripId, description: "Food & wine", category: "food", amount: 340, currency: "EUR", date: start, is_planned: false, created_at: ts, updated_at: ts },
  ], messages: [], savedPlaces: [] };
}
