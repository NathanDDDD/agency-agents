import { z } from "zod";

// ---------- Shared enums ----------

export const activityCategorySchema = z.enum([
  "sightseeing",
  "museum",
  "food",
  "restaurant",
  "nightlife",
  "outdoors",
  "shopping",
  "wellness",
  "experience",
  "transport",
  "accommodation",
  "other",
]);

export const slotSchema = z.enum(["morning", "afternoon", "evening"]);
export const paceSchema = z.enum(["relaxed", "balanced", "packed"]);
export const partySchema = z.enum(["solo", "couple", "family", "friends", "business"]);

// ---------- AI output schemas (validated with Zod) ----------
// Optional values are modelled as nullable so they work with structured outputs
// (every property is required, values may be null).

export const aiActivitySchema = z.object({
  name: z.string().describe("Name of the place or experience"),
  description: z.string().describe("One or two sentences on why it fits this traveler"),
  category: activityCategorySchema,
  is_restaurant: z.boolean().describe("True for a meal/restaurant/bar recommendation"),
  slot: slotSchema,
  suggested_time: z
    .string()
    .nullable()
    .describe("Suggested start time in 24h HH:MM, or null"),
  duration_minutes: z.number().nullable().describe("Estimated duration in minutes"),
  estimated_cost: z
    .number()
    .nullable()
    .describe("Rough estimated cost for the whole party in the trip currency; an estimate, not a quote"),
  address: z.string().nullable(),
  latitude: z.number().nullable().describe("Approximate latitude if known with confidence, else null"),
  longitude: z.number().nullable().describe("Approximate longitude if known with confidence, else null"),
  booking_url: z
    .string()
    .nullable()
    .describe("Official website only if you are confident it exists, else null. Never invent URLs."),
  notes: z
    .string()
    .describe("Practical tips. Say 'check opening hours' rather than stating hours as fact."),
});

export const aiDaySchema = z.object({
  day_number: z.number().describe("1-based day index"),
  date: z.string().describe("YYYY-MM-DD"),
  city: z.string(),
  title: z.string().describe("Short evocative day title"),
  summary: z.string(),
  morning_summary: z.string(),
  afternoon_summary: z.string(),
  evening_summary: z.string(),
  transport_notes: z.string().describe("How to get around today: walking, metro, taxi, train"),
  notes: z.string(),
  estimated_cost: z.number().nullable().describe("Estimated total spend for the day for the whole party"),
  activities: z.array(aiActivitySchema),
});

export const aiItinerarySchema = z.object({
  overview: z.string().describe("Two or three sentence overview of the trip plan"),
  days: z.array(aiDaySchema),
});

export type AIActivity = z.infer<typeof aiActivitySchema>;
export type AIDay = z.infer<typeof aiDaySchema>;
export type AIItinerary = z.infer<typeof aiItinerarySchema>;

export const aiOperationSchema = z.object({
  type: z.enum(["remove_activity", "replace_activity", "add_activity"]),
  activity_id: z
    .string()
    .nullable()
    .describe("ID of the existing activity for remove/replace, else null"),
  day_number: z.number().nullable().describe("Day number for add_activity, else null"),
  reason: z.string(),
  activity: aiActivitySchema.nullable().describe("New activity for replace/add, else null"),
});

export const aiChatResponseSchema = z.object({
  reply: z
    .string()
    .describe("Conversational answer in markdown-lite (short paragraphs, '-' bullets)."),
  proposal: z
    .object({
      summary: z.string().describe("One-line description of the proposed itinerary change"),
      operations: z.array(aiOperationSchema),
    })
    .nullable()
    .describe("Only when the traveler asked to change the itinerary; otherwise null"),
});

export type AIChatResponse = z.infer<typeof aiChatResponseSchema>;

// ---------- API request schemas ----------

const looseRecord = z.record(z.string(), z.unknown());

export const planRequestSchema = z.object({
  bundle: looseRecord,
  preferences: looseRecord.nullable(),
});

export const regenerateRequestSchema = z.object({
  bundle: looseRecord,
  preferences: looseRecord.nullable(),
  scope: z.enum(["day", "activity"]),
  day_id: z.string(),
  activity_id: z.string().nullable(),
  instructions: z.string().max(1000).default(""),
});

export const chatRequestSchema = z.object({
  bundle: looseRecord,
  preferences: looseRecord.nullable(),
  message: z.string().min(1).max(4000),
});

// ---------- Form schemas ----------

export const tripFormSchema = z
  .object({
    name: z.string().min(2, "Give your trip a name").max(80),
    destinations: z.string().min(2, "Where are you going?"),
    start_date: z.string().min(1, "Pick a departure date"),
    end_date: z.string().min(1, "Pick a return date"),
    travelers: z.coerce.number().int().min(1).max(30),
    travel_party: partySchema,
    budget: z.coerce.number().min(0),
    currency: z.string().length(3),
    budget_excludes_flights: z.boolean(),
    pace: paceSchema,
    interests: z.array(z.string()),
    description: z.string().max(2000),
    special_requests: z.string().max(1000),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "Return date must be after departure",
    path: ["end_date"],
  })
  .refine(
    (v) => {
      const ms = new Date(v.end_date).getTime() - new Date(v.start_date).getTime();
      return ms / 86_400_000 <= 30;
    },
    { message: "Trips can be up to 31 days for now", path: ["end_date"] },
  );

export type TripFormInput = z.input<typeof tripFormSchema>;
export type TripFormValues = z.output<typeof tripFormSchema>;

export const activityFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  description: z.string().max(600),
  category: activityCategorySchema,
  is_restaurant: z.boolean(),
  slot: slotSchema,
  suggested_time: z.string(),
  duration_minutes: z.coerce.number().min(0).max(1440),
  estimated_cost: z.coerce.number().min(0),
  address: z.string().max(200),
  booking_url: z.union([z.literal(""), z.url("Enter a valid URL")]),
  notes: z.string().max(1000),
});

export type ActivityFormInput = z.input<typeof activityFormSchema>;
export type ActivityFormValues = z.output<typeof activityFormSchema>;

export const bookingFormSchema = z.object({
  type: z.enum(["flight", "hotel", "restaurant", "activity", "transport", "car_rental", "other"]),
  name: z.string().min(1, "Name is required").max(120),
  confirmation_number: z.string().max(60),
  date: z.string(),
  time: z.string(),
  end_date: z.string(),
  address: z.string().max(200),
  booking_url: z.union([z.literal(""), z.url("Enter a valid URL")]),
  cost: z.coerce.number().min(0),
  notes: z.string().max(1000),
});

export type BookingFormInput = z.input<typeof bookingFormSchema>;
export type BookingFormValues = z.output<typeof bookingFormSchema>;

export const expenseFormSchema = z.object({
  description: z.string().min(1, "What was it for?").max(120),
  category: z.enum(["accommodation", "food", "activities", "transport", "shopping", "flights", "other"]),
  amount: z.coerce.number().positive("Enter an amount"),
  currency: z.string().length(3),
  date: z.string().min(1),
  is_planned: z.boolean(),
});

export type ExpenseFormInput = z.input<typeof expenseFormSchema>;
export type ExpenseFormValues = z.output<typeof expenseFormSchema>;

export const preferencesSchema = z.object({
  travel_style: z.enum(["luxury", "comfort", "balanced", "budget", "backpacker", "adventure"]),
  budget_range: z.enum(["under-1k", "1k-3k", "3k-6k", "6k-10k", "10k-plus"]),
  accommodation: z.enum([
    "luxury-hotel",
    "boutique-hotel",
    "mid-range-hotel",
    "apartment",
    "hostel",
    "resort",
  ]),
  food_preferences: z.array(z.string()),
  activities: z.array(z.string()),
  pace: paceSchema,
  travel_party: partySchema,
  preferred_destinations: z.array(z.string()),
  accessibility_needs: z.string().max(500),
});
