"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataRepository, NewTrip, TripSummary } from "./repository";
import type {
  Activity,
  Booking,
  BookingDocument,
  ChatMessage,
  Expense,
  ItineraryDay,
  Profile,
  SavedPlace,
  TravelPreferences,
  Trip,
  TripBundle,
} from "../types";
import { nowIso } from "../utils";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function normalizeTrip(row: Record<string, unknown>): Trip {
  return { ...(row as unknown as Trip), budget: Number(row.budget ?? 0) };
}

function normalizeActivity(row: Record<string, unknown>): Activity {
  return { ...(row as unknown as Activity), estimated_cost: num(row.estimated_cost) };
}

function normalizeDay(row: Record<string, unknown>): ItineraryDay {
  const activities = ((row.activities as Record<string, unknown>[] | undefined) ?? [])
    .map(normalizeActivity)
    .sort((a, b) => a.sort_order - b.sort_order);
  return { ...(row as unknown as ItineraryDay), estimated_cost: num(row.estimated_cost), activities };
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const stripDay = (d: ItineraryDay) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { activities, ...rest } = d;
  return rest;
};

export class SupabaseRepository implements DataRepository {
  readonly mode = "supabase" as const;

  constructor(
    private readonly sb: SupabaseClient,
    private readonly userId: string,
    private readonly email: string | null,
  ) {}

  async getProfile(): Promise<Profile> {
    const res = await this.sb.from("profiles").select("*").eq("id", this.userId).maybeSingle();
    const row = check(res);
    if (row) return row as Profile;
    // Profile trigger may not have run (e.g. user created before migration).
    const ts = nowIso();
    const profile: Profile = {
      id: this.userId,
      email: this.email,
      full_name: "",
      home_currency: "USD",
      onboarded: false,
      notifications: { trip_reminders: true, itinerary_changes: true, product_updates: false },
      created_at: ts,
      updated_at: ts,
    };
    check(await this.sb.from("profiles").upsert(profile));
    return profile;
  }

  async updateProfile(patch: Partial<Omit<Profile, "id">>) {
    const res = await this.sb.from("profiles").update(patch).eq("id", this.userId).select("*").single();
    return check(res) as Profile;
  }

  async getPreferences(): Promise<TravelPreferences | null> {
    const res = await this.sb
      .from("trip_preferences")
      .select("*")
      .eq("user_id", this.userId)
      .is("trip_id", null)
      .maybeSingle();
    const row = check(res) as (TravelPreferences & { id: string }) | null;
    if (!row) return null;
    return {
      travel_style: row.travel_style,
      budget_range: row.budget_range,
      accommodation: row.accommodation,
      food_preferences: row.food_preferences,
      activities: row.activities,
      pace: row.pace,
      travel_party: row.travel_party,
      preferred_destinations: row.preferred_destinations,
      accessibility_needs: row.accessibility_needs,
    };
  }

  async savePreferences(prefs: TravelPreferences) {
    const existing = check(
      await this.sb
        .from("trip_preferences")
        .select("id")
        .eq("user_id", this.userId)
        .is("trip_id", null)
        .maybeSingle(),
    ) as { id: string } | null;
    if (existing) {
      check(await this.sb.from("trip_preferences").update(prefs).eq("id", existing.id));
    } else {
      check(await this.sb.from("trip_preferences").insert({ ...prefs, user_id: this.userId, trip_id: null }));
    }
  }

  async listTrips(): Promise<TripSummary[]> {
    const res = await this.sb
      .from("trips")
      .select("*, itinerary_days(id), activities(id), bookings(id), expenses(amount, is_planned)")
      .order("start_date", { ascending: true });
    const rows = check(res) as Record<string, unknown>[];
    return rows.map((r) => {
      const expenses = (r.expenses as { amount: number; is_planned: boolean }[]) ?? [];
      return {
        trip: normalizeTrip(r),
        dayCount: ((r.itinerary_days as unknown[]) ?? []).length,
        activityCount: ((r.activities as unknown[]) ?? []).length,
        bookingCount: ((r.bookings as unknown[]) ?? []).length,
        spent: expenses.filter((e) => !e.is_planned).reduce((s, e) => s + Number(e.amount), 0),
      };
    });
  }

  async getBundle(tripId: string): Promise<TripBundle | null> {
    const tripRow = check(await this.sb.from("trips").select("*").eq("id", tripId).maybeSingle());
    if (!tripRow) return null;
    const [days, bookings, expenses, messages, places] = await Promise.all([
      this.sb.from("itinerary_days").select("*, activities(*)").eq("trip_id", tripId).order("day_number"),
      this.sb.from("bookings").select("*").eq("trip_id", tripId).order("date", { nullsFirst: false }),
      this.sb.from("expenses").select("*").eq("trip_id", tripId).order("date"),
      this.sb.from("chat_messages").select("*").eq("trip_id", tripId).order("created_at"),
      this.sb.from("saved_places").select("*").or(`trip_id.eq.${tripId},trip_id.is.null`),
    ]);
    return {
      trip: normalizeTrip(tripRow as Record<string, unknown>),
      days: (check(days) as Record<string, unknown>[]).map(normalizeDay),
      bookings: (check(bookings) as Record<string, unknown>[]).map(
        (b) => ({ ...(b as unknown as Booking), cost: num(b.cost) }),
      ),
      expenses: (check(expenses) as Record<string, unknown>[]).map(
        (e) => ({ ...(e as unknown as Expense), amount: Number(e.amount) }),
      ),
      messages: check(messages) as ChatMessage[],
      savedPlaces: check(places) as SavedPlace[],
    };
  }

  async createTrip(input: NewTrip): Promise<Trip> {
    const res = await this.sb
      .from("trips")
      .insert({ ...input, user_id: this.userId })
      .select("*")
      .single();
    return normalizeTrip(check(res) as Record<string, unknown>);
  }

  async updateTrip(id: string, patch: Partial<Trip>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, user_id, created_at, updated_at, ...rest } = patch;
    const res = await this.sb.from("trips").update(rest).eq("id", id).select("*").single();
    return normalizeTrip(check(res) as Record<string, unknown>);
  }

  async deleteTrip(id: string) {
    check(await this.sb.from("trips").delete().eq("id", id));
  }

  async replaceItinerary(tripId: string, days: ItineraryDay[]) {
    check(await this.sb.from("itinerary_days").delete().eq("trip_id", tripId));
    if (!days.length) return;
    check(await this.sb.from("itinerary_days").insert(days.map(stripDay)));
    const activities = days.flatMap((d) => d.activities);
    if (activities.length) check(await this.sb.from("activities").insert(activities));
  }

  async replaceDay(day: ItineraryDay) {
    check(await this.sb.from("itinerary_days").update(stripDay(day)).eq("id", day.id));
    check(await this.sb.from("activities").delete().eq("day_id", day.id));
    if (day.activities.length) check(await this.sb.from("activities").insert(day.activities));
  }

  async updateDay(id: string, patch: Partial<Omit<ItineraryDay, "activities">>) {
    check(await this.sb.from("itinerary_days").update(patch).eq("id", id));
  }

  async addActivity(activity: Activity) {
    check(await this.sb.from("activities").insert(activity));
  }

  async updateActivity(id: string, patch: Partial<Activity>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created_at, updated_at, ...rest } = patch;
    check(await this.sb.from("activities").update(rest).eq("id", id));
  }

  async deleteActivity(id: string) {
    check(await this.sb.from("activities").delete().eq("id", id));
  }

  async reorderActivities(
    updates: { id: string; day_id: string; sort_order: number; slot: Activity["slot"] }[],
  ) {
    await Promise.all(
      updates.map(async (u) =>
        check(
          await this.sb
            .from("activities")
            .update({ day_id: u.day_id, sort_order: u.sort_order, slot: u.slot })
            .eq("id", u.id),
        ),
      ),
    );
  }

  async saveBooking(booking: Booking) {
    check(await this.sb.from("bookings").upsert(booking));
  }

  async deleteBooking(id: string) {
    check(await this.sb.from("bookings").delete().eq("id", id));
  }

  async uploadDocument(tripId: string, bookingId: string, file: File): Promise<BookingDocument> {
    if (file.size > 10 * 1024 * 1024) throw new Error("Documents must be under 10 MB.");
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${this.userId}/${tripId}/${bookingId}/${Date.now()}-${safe}`;
    const { error } = await this.sb.storage.from("booking-documents").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return { name: file.name, path, size: file.size, uploaded_at: nowIso() };
  }

  async getDocumentUrl(doc: BookingDocument) {
    const { data, error } = await this.sb.storage
      .from("booking-documents")
      .createSignedUrl(doc.path, 60 * 10);
    if (error || !data) throw new Error(error?.message ?? "Could not open document");
    return data.signedUrl;
  }

  async saveExpense(expense: Expense) {
    check(await this.sb.from("expenses").upsert(expense));
  }

  async deleteExpense(id: string) {
    check(await this.sb.from("expenses").delete().eq("id", id));
  }

  async addMessage(message: ChatMessage) {
    check(await this.sb.from("chat_messages").insert({ ...message, user_id: this.userId }));
  }

  async updateMessage(id: string, patch: Partial<ChatMessage>) {
    check(await this.sb.from("chat_messages").update(patch).eq("id", id));
  }

  async clearMessages(tripId: string) {
    check(await this.sb.from("chat_messages").delete().eq("trip_id", tripId).eq("user_id", this.userId));
  }

  async listSavedPlaces() {
    const res = await this.sb.from("saved_places").select("*").order("created_at", { ascending: false });
    return check(res) as SavedPlace[];
  }

  async savePlace(place: SavedPlace) {
    check(await this.sb.from("saved_places").upsert({ ...place, user_id: this.userId }));
  }

  async deletePlace(id: string) {
    check(await this.sb.from("saved_places").delete().eq("id", id));
  }
}
