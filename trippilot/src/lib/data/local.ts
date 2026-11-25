"use client";

import type { DataRepository, NewTrip, TripSummary } from "./repository";
import { summarize } from "./repository";
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
import { buildLisbonPast, buildRomeDemo, DEMO_USER_ID } from "../demo/rome";
import { nowIso, uid } from "../utils";
import { DEFAULT_PREFERENCES } from "../options";

const STORAGE_KEY = "trippilot:demo:v1";
const MAX_DOC_BYTES = 1_500_000;

interface LocalState {
  profile: Profile;
  preferences: TravelPreferences | null;
  bundles: TripBundle[];
  savedPlaces: SavedPlace[];
}

function seed(): LocalState {
  const ts = nowIso();
  const rome = buildRomeDemo();
  const lisbon = buildLisbonPast();
  return {
    profile: {
      id: DEMO_USER_ID,
      email: "demo@trippilot.app",
      full_name: "Demo Traveler",
      home_currency: "USD",
      onboarded: true,
      notifications: { trip_reminders: true, itinerary_changes: true, product_updates: false },
      created_at: ts,
      updated_at: ts,
    },
    preferences: {
      ...DEFAULT_PREFERENCES,
      travel_style: "luxury",
      budget_range: "6k-10k",
      accommodation: "luxury-hotel",
      food_preferences: ["Fine dining", "Local cuisine", "Wine bars"],
      activities: ["History", "Food tours", "Nightlife"],
      pace: "relaxed",
      travel_party: "couple",
      preferred_destinations: ["Italy", "Japan", "Greece"],
    },
    bundles: [rome, lisbon],
    savedPlaces: [...rome.savedPlaces],
  };
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export class LocalRepository implements DataRepository {
  readonly mode = "demo" as const;

  private read(): LocalState {
    if (typeof window === "undefined") return seed();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as LocalState;
    } catch {
      // fall through to a fresh seed
    }
    const s = seed();
    this.write(s);
    return s;
  }

  private write(state: LocalState) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      throw new Error(
        err instanceof DOMException && err.name === "QuotaExceededError"
          ? "Demo storage is full. Remove some documents or reset the demo in Settings."
          : "Could not save demo data in this browser.",
      );
    }
  }

  private mutate<T>(fn: (s: LocalState) => T): T {
    const s = this.read();
    const result = fn(s);
    this.write(s);
    return result;
  }

  private findBundle(s: LocalState, tripId: string) {
    const b = s.bundles.find((x) => x.trip.id === tripId);
    if (!b) throw new Error("Trip not found");
    return b;
  }

  private findActivity(s: LocalState, id: string) {
    for (const b of s.bundles)
      for (const d of b.days) {
        const a = d.activities.find((x) => x.id === id);
        if (a) return { bundle: b, day: d, activity: a };
      }
    throw new Error("Activity not found");
  }

  static reset() {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  async getProfile() {
    return clone(this.read().profile);
  }
  async updateProfile(patch: Partial<Omit<Profile, "id">>) {
    return this.mutate((s) => {
      s.profile = { ...s.profile, ...patch, updated_at: nowIso() };
      return clone(s.profile);
    });
  }
  async getPreferences() {
    return clone(this.read().preferences);
  }
  async savePreferences(prefs: TravelPreferences) {
    this.mutate((s) => {
      s.preferences = prefs;
    });
  }

  async listTrips(): Promise<TripSummary[]> {
    return this.read().bundles.map((b) => summarize(clone(b)));
  }
  async getBundle(tripId: string) {
    const s = this.read();
    const b = s.bundles.find((x) => x.trip.id === tripId);
    if (!b) return null;
    const out = clone(b);
    out.savedPlaces = s.savedPlaces.filter((p) => p.trip_id === tripId || p.trip_id === null);
    return out;
  }
  async createTrip(input: NewTrip): Promise<Trip> {
    return this.mutate((s) => {
      const ts = nowIso();
      const trip: Trip = { ...input, id: uid(), user_id: s.profile.id, created_at: ts, updated_at: ts };
      s.bundles.unshift({ trip, days: [], bookings: [], expenses: [], messages: [], savedPlaces: [] });
      return clone(trip);
    });
  }
  async updateTrip(id: string, patch: Partial<Trip>) {
    return this.mutate((s) => {
      const b = this.findBundle(s, id);
      b.trip = { ...b.trip, ...patch, id, updated_at: nowIso() };
      return clone(b.trip);
    });
  }
  async deleteTrip(id: string) {
    this.mutate((s) => {
      s.bundles = s.bundles.filter((b) => b.trip.id !== id);
      s.savedPlaces = s.savedPlaces.filter((p) => p.trip_id !== id);
    });
  }

  async replaceItinerary(tripId: string, days: ItineraryDay[]) {
    this.mutate((s) => {
      const b = this.findBundle(s, tripId);
      b.days = clone(days);
      b.trip.updated_at = nowIso();
    });
  }
  async replaceDay(day: ItineraryDay) {
    this.mutate((s) => {
      const b = this.findBundle(s, day.trip_id);
      b.days = b.days.map((d) => (d.id === day.id ? clone(day) : d));
    });
  }
  async updateDay(id: string, patch: Partial<Omit<ItineraryDay, "activities">>) {
    this.mutate((s) => {
      for (const b of s.bundles) {
        const d = b.days.find((x) => x.id === id);
        if (d) Object.assign(d, patch, { updated_at: nowIso() });
      }
    });
  }

  async addActivity(activity: Activity) {
    this.mutate((s) => {
      const b = this.findBundle(s, activity.trip_id);
      const d = b.days.find((x) => x.id === activity.day_id);
      if (!d) throw new Error("Day not found");
      d.activities.push(clone(activity));
    });
  }
  async updateActivity(id: string, patch: Partial<Activity>) {
    this.mutate((s) => {
      const { activity } = this.findActivity(s, id);
      Object.assign(activity, patch, { id, updated_at: nowIso() });
    });
  }
  async deleteActivity(id: string) {
    this.mutate((s) => {
      const { day } = this.findActivity(s, id);
      day.activities = day.activities.filter((a) => a.id !== id);
    });
  }
  async reorderActivities(
    updates: { id: string; day_id: string; sort_order: number; slot: Activity["slot"] }[],
  ) {
    this.mutate((s) => {
      for (const u of updates) {
        const { bundle, day, activity } = this.findActivity(s, u.id);
        activity.sort_order = u.sort_order;
        activity.slot = u.slot;
        if (day.id !== u.day_id) {
          day.activities = day.activities.filter((a) => a.id !== u.id);
          const target = bundle.days.find((d) => d.id === u.day_id);
          if (target) target.activities.push({ ...activity, day_id: u.day_id });
        }
      }
    });
  }

  async saveBooking(booking: Booking) {
    this.mutate((s) => {
      const b = this.findBundle(s, booking.trip_id);
      const i = b.bookings.findIndex((x) => x.id === booking.id);
      const next = { ...booking, updated_at: nowIso() };
      if (i >= 0) b.bookings[i] = next;
      else b.bookings.push(next);
    });
  }
  async deleteBooking(id: string) {
    this.mutate((s) => {
      for (const b of s.bundles) b.bookings = b.bookings.filter((x) => x.id !== id);
    });
  }
  async uploadDocument(_tripId: string, _bookingId: string, file: File): Promise<BookingDocument> {
    if (file.size > MAX_DOC_BYTES) {
      throw new Error("In demo mode documents are stored in your browser and must be under 1.5 MB.");
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
    return { name: file.name, path: dataUrl, size: file.size, uploaded_at: nowIso() };
  }
  async getDocumentUrl(doc: BookingDocument) {
    return doc.path;
  }

  async saveExpense(expense: Expense) {
    this.mutate((s) => {
      const b = this.findBundle(s, expense.trip_id);
      const i = b.expenses.findIndex((x) => x.id === expense.id);
      const next = { ...expense, updated_at: nowIso() };
      if (i >= 0) b.expenses[i] = next;
      else b.expenses.push(next);
    });
  }
  async deleteExpense(id: string) {
    this.mutate((s) => {
      for (const b of s.bundles) b.expenses = b.expenses.filter((x) => x.id !== id);
    });
  }

  async addMessage(message: ChatMessage) {
    this.mutate((s) => {
      this.findBundle(s, message.trip_id).messages.push(clone(message));
    });
  }
  async updateMessage(id: string, patch: Partial<ChatMessage>) {
    this.mutate((s) => {
      for (const b of s.bundles) {
        const m = b.messages.find((x) => x.id === id);
        if (m) Object.assign(m, patch);
      }
    });
  }
  async clearMessages(tripId: string) {
    this.mutate((s) => {
      this.findBundle(s, tripId).messages = [];
    });
  }

  async listSavedPlaces() {
    return clone(this.read().savedPlaces);
  }
  async savePlace(place: SavedPlace) {
    this.mutate((s) => {
      const i = s.savedPlaces.findIndex((p) => p.id === place.id);
      if (i >= 0) s.savedPlaces[i] = place;
      else s.savedPlaces.unshift(place);
    });
  }
  async deletePlace(id: string) {
    this.mutate((s) => {
      s.savedPlaces = s.savedPlaces.filter((p) => p.id !== id);
    });
  }
}
