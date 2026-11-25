import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import {
  aiActivitySchema,
  aiChatResponseSchema,
  aiDaySchema,
  aiItinerarySchema,
  type AIActivity,
  type AIChatResponse,
  type AIDay,
  type AIItinerary,
} from "../schemas";
import type { ChatMessage, TravelPreferences, TripBundle } from "../types";
import {
  describeBookings,
  describeBudget,
  describeItinerary,
  describePreferences,
  describeSavedPlaces,
  describeTrip,
} from "./context";
import { tripLength } from "../utils";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export function isAIConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export class AIError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

const PLANNER_SYSTEM = `You are TripPilot, a meticulous, warm and well-travelled personal travel planner.

You design realistic, enjoyable itineraries that respect the traveler's pace, budget, party and interests.

Rules you always follow:
- Recommend real, well-known places you are confident exist. Prefer established institutions over obscure picks.
- Never fabricate availability, reservations, exact prices, or opening hours. Costs are rough estimates for the whole party in the trip currency. When hours matter, tell the traveler to check opening hours.
- Only include a booking_url if it is the official website and you are confident it exists; otherwise null.
- Provide approximate latitude/longitude only when you know the location with confidence; otherwise null.
- Group each day geographically to minimise travel; leave realistic gaps for transit and meals.
- Match the pace: relaxed = 2–4 items/day with long meals and downtime; balanced = 4–5; packed = 5–7.
- Include a lunch and a dinner recommendation each full day (is_restaurant = true), in keeping with the budget and food preferences.
- Respect accessibility needs and special requests.
- Arrival and departure days are lighter.
- Activities the traveler edited (marked "EDITED BY TRAVELER — keep") must be preserved as-is.`;

async function structured<T>(opts: {
  schema: z.ZodType<T>;
  system: string;
  user: string;
  maxTokens: number;
  effort: "low" | "medium" | "high";
}): Promise<T> {
  try {
    const stream = getClient().beta.messages.stream({
      model: AI_MODEL,
      max_tokens: opts.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      throw new AIError("TripPilot couldn't help with that request. Try rephrasing it.", 422);
    }
    if (message.stop_reason === "max_tokens") {
      throw new AIError("The plan was too long to finish. Try a shorter trip or fewer requests.", 502);
    }
    if (!message.parsed_output) {
      throw new AIError("The AI returned an unexpected format. Please try again.", 502);
    }
    // Re-validate with Zod to be certain of the shape before it reaches the app.
    const parsed = opts.schema.safeParse(message.parsed_output);
    if (!parsed.success) throw new AIError("The AI response failed validation. Please try again.", 502);
    return parsed.data;
  } catch (err) {
    if (err instanceof AIError) throw err;
    if (err instanceof Anthropic.RateLimitError) {
      throw new AIError("TripPilot is busy right now. Please try again in a moment.", 429);
    }
    if (err instanceof Anthropic.AuthenticationError) {
      throw new AIError("The AI service is misconfigured (invalid API key).", 500);
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[ai] Anthropic API error", err.status, err.message);
      throw new AIError("The AI service returned an error. Please try again.", 502);
    }
    console.error("[ai] unexpected error", err);
    throw new AIError("Could not reach the AI service. Please try again.", 502);
  }
}

function contextBlock(bundle: TripBundle, prefs: TravelPreferences | null) {
  return `<trip>\n${describeTrip(bundle)}\n</trip>\n\n<traveler_preferences>\n${describePreferences(prefs)}\n</traveler_preferences>\n\n<saved_places>\n${describeSavedPlaces(bundle)}\n</saved_places>\n\n<bookings>\n${describeBookings(bundle)}\n</bookings>`;
}

export async function generateItinerary(
  bundle: TripBundle,
  prefs: TravelPreferences | null,
): Promise<AIItinerary> {
  const n = tripLength(bundle.trip.start_date, bundle.trip.end_date);
  const user = `${contextBlock(bundle, prefs)}

<current_itinerary>
${describeItinerary(bundle)}
</current_itinerary>

Create a complete ${n}-day itinerary (exactly ${n} days, day_number 1..${n}, dates starting ${bundle.trip.start_date}).
If there are multiple destinations, split the days sensibly and mention the transfer in transport_notes.
Work saved places in where they fit. Keep any activity marked as edited by the traveler.`;
  return structured({
    schema: aiItinerarySchema,
    system: PLANNER_SYSTEM,
    user,
    maxTokens: 64000,
    effort: "medium",
  });
}

export async function regenerateDay(
  bundle: TripBundle,
  prefs: TravelPreferences | null,
  dayNumber: number,
  instructions: string,
): Promise<AIDay> {
  const user = `${contextBlock(bundle, prefs)}

<current_itinerary>
${describeItinerary(bundle)}
</current_itinerary>

Re-plan Day ${dayNumber} only. Keep it consistent with the other days (no repeats of places used elsewhere).
Include every activity on Day ${dayNumber} that is marked as edited by the traveler, unchanged.
${instructions ? `Traveler's instructions for this day: ${instructions}` : "Offer a fresh take on the day."}`;
  return structured({ schema: aiDaySchema, system: PLANNER_SYSTEM, user, maxTokens: 24000, effort: "medium" });
}

export async function regenerateActivity(
  bundle: TripBundle,
  prefs: TravelPreferences | null,
  dayNumber: number,
  activityName: string,
  isRestaurant: boolean,
  instructions: string,
): Promise<AIActivity> {
  const user = `${contextBlock(bundle, prefs)}

<current_itinerary>
${describeItinerary(bundle)}
</current_itinerary>

Suggest ONE alternative to replace "${activityName}" on Day ${dayNumber}.
${isRestaurant ? "It must be a restaurant/meal recommendation (is_restaurant = true)." : "Keep a similar time slot."}
It must be near the day's other stops and not duplicate anything already in the itinerary.
${instructions ? `Traveler's instructions: ${instructions}` : ""}`;
  return structured({ schema: aiActivitySchema, system: PLANNER_SYSTEM, user, maxTokens: 8000, effort: "low" });
}

const CONCIERGE_SYSTEM = `You are the TripPilot concierge: a knowledgeable, friendly travel assistant embedded in one specific trip.

You can see the trip, the traveler's preferences, the full itinerary (with activity IDs), bookings, budget and saved places. Use them to give specific, practical answers. Refer to the itinerary by day and time.

Itinerary changes:
- When the traveler asks you to change the plan (remove, replace, add, make a day lighter, swap for something outdoors, etc.), return a "proposal" with operations. Use exact activity IDs from the itinerary. The app shows the proposal to the traveler for confirmation before anything changes, so describe it as a suggestion ("Here's what I'd change…"), never as already done.
- Never remove or replace activities marked "EDITED BY TRAVELER" unless the traveler explicitly names them.
- For questions that don't need a change, proposal must be null.

Honesty:
- Never claim to have made bookings, checked live availability, real-time prices, weather or opening hours. Suggest the traveler verify these.
- Costs you mention are estimates.
- For budget questions, use the budget figures provided exactly.

Style: concise, warm, skimmable. Short paragraphs and "-" bullets. No headings. Under 180 words unless asked for detail.`;

export async function conciergeReply(
  bundle: TripBundle,
  prefs: TravelPreferences | null,
  history: ChatMessage[],
  message: string,
): Promise<AIChatResponse> {
  const today = new Date().toISOString().slice(0, 10);
  const context = `${contextBlock(bundle, prefs)}

<itinerary>
${describeItinerary(bundle)}
</itinerary>

<budget>
${describeBudget(bundle)}
</budget>

Today's date: ${today}.`;

  const recent = history.slice(-12);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `${context}\n\n(Trip context above. The conversation follows.)` },
    { role: "assistant", content: "Understood — I have the full trip context." },
    ...recent.map((m) => ({ role: m.role, content: m.content }) as Anthropic.Beta.BetaMessageParam),
    { role: "user", content: message },
  ];

  try {
    const stream = getClient().beta.messages.stream({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: betaZodOutputFormat(aiChatResponseSchema) },
      system: CONCIERGE_SYSTEM,
      messages: mergeConsecutive(messages),
    });
    const res = await stream.finalMessage();
    if (res.stop_reason === "refusal") {
      return { reply: "I'm not able to help with that one. Is there something else about the trip I can do?", proposal: null };
    }
    const parsed = aiChatResponseSchema.safeParse(res.parsed_output);
    if (!parsed.success) throw new AIError("The concierge returned an unexpected format. Please try again.");
    return parsed.data;
  } catch (err) {
    if (err instanceof AIError) throw err;
    if (err instanceof Anthropic.RateLimitError) throw new AIError("TripPilot is busy. Try again in a moment.", 429);
    if (err instanceof Anthropic.AuthenticationError) throw new AIError("The AI service is misconfigured (invalid API key).", 500);
    if (err instanceof Anthropic.APIError) {
      console.error("[ai] concierge API error", err.status, err.message);
      throw new AIError("The AI service returned an error. Please try again.");
    }
    console.error("[ai] concierge unexpected error", err);
    throw new AIError("Could not reach the AI service. Please try again.");
  }
}

/** The API requires alternating roles; collapse accidental repeats. */
function mergeConsecutive(msgs: Anthropic.Beta.BetaMessageParam[]): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of msgs) {
    const last = out[out.length - 1];
    if (last && last.role === m.role && typeof last.content === "string" && typeof m.content === "string") {
      last.content = `${last.content}\n\n${m.content}`;
    } else {
      out.push({ ...m });
    }
  }
  return out;
}
