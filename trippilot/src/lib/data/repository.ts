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

export type DataMode = "demo" | "supabase";

export interface TripSummary {
  trip: Trip;
  dayCount: number;
  activityCount: number;
  bookingCount: number;
  spent: number;
}

export type NewTrip = Omit<Trip, "id" | "user_id" | "created_at" | "updated_at">;

/**
 * The single data-access contract used by the UI. Two implementations exist:
 * - LocalRepository: browser localStorage, used for demo mode.
 * - SupabaseRepository: Postgres + RLS via supabase-js.
 * Records carry client-generated UUIDs so both backends behave identically.
 */
export interface DataRepository {
  readonly mode: DataMode;

  getProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Omit<Profile, "id">>): Promise<Profile>;
  getPreferences(): Promise<TravelPreferences | null>;
  savePreferences(prefs: TravelPreferences): Promise<void>;

  listTrips(): Promise<TripSummary[]>;
  getBundle(tripId: string): Promise<TripBundle | null>;
  createTrip(input: NewTrip): Promise<Trip>;
  updateTrip(id: string, patch: Partial<Trip>): Promise<Trip>;
  deleteTrip(id: string): Promise<void>;

  /** Replace the whole itinerary for a trip (used after AI generation). */
  replaceItinerary(tripId: string, days: ItineraryDay[]): Promise<void>;
  /** Replace one day and all of its activities. */
  replaceDay(day: ItineraryDay): Promise<void>;
  updateDay(id: string, patch: Partial<Omit<ItineraryDay, "activities">>): Promise<void>;

  addActivity(activity: Activity): Promise<void>;
  updateActivity(id: string, patch: Partial<Activity>): Promise<void>;
  deleteActivity(id: string): Promise<void>;
  reorderActivities(
    updates: { id: string; day_id: string; sort_order: number; slot: Activity["slot"] }[],
  ): Promise<void>;

  saveBooking(booking: Booking): Promise<void>;
  deleteBooking(id: string): Promise<void>;
  uploadDocument(tripId: string, bookingId: string, file: File): Promise<BookingDocument>;
  getDocumentUrl(doc: BookingDocument): Promise<string>;

  saveExpense(expense: Expense): Promise<void>;
  deleteExpense(id: string): Promise<void>;

  addMessage(message: ChatMessage): Promise<void>;
  updateMessage(id: string, patch: Partial<ChatMessage>): Promise<void>;
  clearMessages(tripId: string): Promise<void>;

  listSavedPlaces(): Promise<SavedPlace[]>;
  savePlace(place: SavedPlace): Promise<void>;
  deletePlace(id: string): Promise<void>;
}

export function summarize(bundle: TripBundle): TripSummary {
  return {
    trip: bundle.trip,
    dayCount: bundle.days.length,
    activityCount: bundle.days.reduce((n, d) => n + d.activities.length, 0),
    bookingCount: bundle.bookings.length,
    spent: bundle.expenses.filter((e) => !e.is_planned).reduce((s, e) => s + e.amount, 0),
  };
}
