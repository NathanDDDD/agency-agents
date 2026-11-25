"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useData } from "@/lib/data/provider";
import type {
  Activity,
  Booking,
  ChatMessage,
  ChangeProposal,
  Expense,
  ItineraryDay,
  SavedPlace,
  Trip,
  TripBundle,
} from "@/lib/types";
import type { AIActivity, AIChatResponse, AIDay, AIItinerary } from "@/lib/schemas";
import { mergeDay, mergeItinerary, orderActivities, sanitizeActivity, toActivity, toDay } from "@/lib/ai/convert";
import { nowIso, uid } from "@/lib/utils";
import { readNdjson, type PlanStreamEvent } from "@/lib/ai/stream-parser";
import { aiDaySchema, aiItinerarySchema } from "@/lib/schemas";

type AIMode = "live" | "demo";

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

/** Trip context sent to AI routes: drop document payloads and old chat. */
function aiBundle(b: TripBundle) {
  return {
    ...b,
    bookings: b.bookings.map((x) => ({ ...x, documents: [] })),
    messages: b.messages.slice(-12).map((m) => ({ ...m, proposal: null })),
  };
}

interface TripContextValue {
  bundle: TripBundle;
  busy: { generating: boolean; dayId: string | null; activityId: string | null; chatting: boolean };
  /** Days received so far while an itinerary is streaming in. */
  streaming: { days: ItineraryDay[]; total: number } | null;
  lastMode: AIMode | null;
  reload: () => Promise<void>;
  updateTrip: (patch: Partial<Trip>) => Promise<void>;
  deleteTrip: () => Promise<void>;
  generateItinerary: () => Promise<void>;
  regenerateDay: (dayId: string, instructions?: string) => Promise<void>;
  regenerateActivity: (activityId: string, instructions?: string) => Promise<void>;
  addActivity: (dayId: string, data: Omit<Activity, "id" | "day_id" | "trip_id" | "sort_order" | "created_at" | "updated_at" | "source" | "user_modified" | "completed">) => Promise<void>;
  updateActivity: (id: string, patch: Partial<Activity>, opts?: { silent?: boolean }) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  moveActivity: (id: string, toDayId: string, toIndex: number) => Promise<void>;
  updateDay: (id: string, patch: Partial<Omit<ItineraryDay, "activities">>) => Promise<void>;
  saveBooking: (b: Booking) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  saveExpense: (e: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  applyProposal: (messageId: string) => Promise<void>;
  dismissProposal: (messageId: string) => Promise<void>;
  clearChat: () => Promise<void>;
  savePlace: (a: Activity) => Promise<void>;
  removePlace: (id: string) => Promise<void>;
  focusActivity: (id: string | null) => void;
  focusedActivityId: string | null;
}

const TripContext = createContext<TripContextValue | null>(null);

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be used within TripProvider");
  return ctx;
}

const findActivity = (b: TripBundle, id: string) => {
  for (const d of b.days) {
    const a = d.activities.find((x) => x.id === id);
    if (a) return { day: d, activity: a };
  }
  return null;
};

export function TripProvider({ initial, children }: { initial: TripBundle; children: ReactNode }) {
  const { repo, preferences } = useData();
  const [bundle, setBundle] = useState(initial);
  const bundleRef = useRef(bundle);
  useEffect(() => {
    bundleRef.current = bundle;
  }, [bundle]);
  const [busy, setBusy] = useState<TripContextValue["busy"]>({ generating: false, dayId: null, activityId: null, chatting: false });
  const [lastMode, setLastMode] = useState<AIMode | null>(null);
  const [streaming, setStreaming] = useState<TripContextValue["streaming"]>(null);
  const [focusedActivityId, setFocused] = useState<string | null>(null);

  const tripId = bundle.trip.id;

  const reload = useCallback(async () => {
    const fresh = await repo.getBundle(tripId);
    if (fresh) setBundle(fresh);
  }, [repo, tripId]);

  const fail = useCallback(
    async (err: unknown, fallback: string) => {
      toast.error(err instanceof Error ? err.message : fallback);
      await reload().catch(() => undefined);
    },
    [reload],
  );

  const setDays = (fn: (days: ItineraryDay[]) => ItineraryDay[]) => setBundle((b) => ({ ...b, days: fn(b.days) }));

  const value = useMemo<TripContextValue>(() => {
    const persistDayOrder = async (day: ItineraryDay) => {
      await repo.reorderActivities(day.activities.map((a) => ({ id: a.id, day_id: day.id, sort_order: a.sort_order, slot: a.slot })));
    };

    return {
      bundle,
      busy,
      streaming,
      lastMode,
      reload,
      focusedActivityId,
      focusActivity: setFocused,

      async updateTrip(patch) {
        try {
          const trip = await repo.updateTrip(tripId, patch);
          setBundle((b) => ({ ...b, trip }));
          toast.success("Trip updated");
        } catch (err) {
          await fail(err, "Could not update trip");
        }
      },

      async deleteTrip() {
        await repo.deleteTrip(tripId);
      },

      async generateItinerary() {
        setBusy((s) => ({ ...s, generating: true }));
        const current = bundleRef.current;
        const sourceFor = (mode: AIMode) => (mode === "live" ? "ai" : "demo") as "ai" | "demo";
        setStreaming({ days: [], total: 0 });
        try {
          const res = await fetch("/api/ai/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bundle: aiBundle(current), preferences }),
          });
          if (!res.ok || !res.body) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error ?? `Request failed (${res.status})`);
          }
          let mode: AIMode = "demo";
          let final: AIItinerary | null = null;
          for await (const event of readNdjson<PlanStreamEvent>(res.body)) {
            if (event.type === "start") {
              mode = event.mode;
              setStreaming({ days: [], total: event.total_days });
            } else if (event.type === "day") {
              const parsed = aiDaySchema.safeParse(event.day);
              if (!parsed.success) continue;
              setStreaming((st) => {
                const index = st ? st.days.length : 0;
                const day = toDay(parsed.data, { trip: current.trip, index, source: sourceFor(mode) });
                return { total: st?.total ?? 0, days: [...(st?.days ?? []), day] };
              });
            } else if (event.type === "error") {
              throw new Error(event.error);
            } else if (event.type === "done") {
              const parsed = aiItinerarySchema.safeParse(event.itinerary);
              if (!parsed.success) throw new Error("The itinerary came back in an unexpected format. Please try again.");
              final = parsed.data;
              mode = event.mode;
            }
          }
          if (!final) throw new Error("The connection closed before the itinerary finished. Please try again.");
          const generated = final.days.map((d, i) => toDay(d, { trip: current.trip, index: i, source: sourceFor(mode) }));
          const merged = mergeItinerary(current.days, generated);
          await repo.replaceItinerary(tripId, merged);
          const trip = await repo.updateTrip(tripId, { itinerary_source: sourceFor(mode) });
          setBundle((b) => ({ ...b, trip, days: merged }));
          setLastMode(mode);
          toast.success(mode === "live" ? "Your itinerary is ready" : "Demo itinerary created (sample content, not live AI)");
        } catch (err) {
          await fail(err, "Could not generate itinerary");
        } finally {
          setStreaming(null);
          setBusy((s) => ({ ...s, generating: false }));
        }
      },

      async regenerateDay(dayId, instructions = "") {
        setBusy((s) => ({ ...s, dayId }));
        try {
          const current = bundleRef.current;
          const existing = current.days.find((d) => d.id === dayId);
          if (!existing) throw new Error("Day not found");
          const res = await postJSON<{ mode: AIMode; day: AIDay }>("/api/ai/regenerate", {
            bundle: aiBundle(current),
            preferences,
            scope: "day",
            day_id: dayId,
            activity_id: null,
            instructions,
          });
          const fresh = toDay(res.day, {
            trip: current.trip,
            index: existing.day_number - 1,
            source: res.mode === "live" ? "ai" : "demo",
            dayId,
          });
          const merged = mergeDay(existing, fresh);
          await repo.replaceDay(merged);
          setDays((days) => days.map((d) => (d.id === dayId ? merged : d)));
          setLastMode(res.mode);
          toast.success(`Day ${existing.day_number} re-planned${res.mode === "demo" ? " (demo content)" : ""}. Your edits were kept.`);
        } catch (err) {
          await fail(err, "Could not regenerate day");
        } finally {
          setBusy((s) => ({ ...s, dayId: null }));
        }
      },

      async regenerateActivity(activityId, instructions = "") {
        setBusy((s) => ({ ...s, activityId }));
        try {
          const current = bundleRef.current;
          const found = findActivity(current, activityId);
          if (!found) throw new Error("Activity not found");
          const res = await postJSON<{ mode: AIMode; activity: AIActivity }>("/api/ai/regenerate", {
            bundle: aiBundle(current),
            preferences,
            scope: "activity",
            day_id: found.day.id,
            activity_id: activityId,
            instructions,
          });
          const clean = sanitizeActivity(res.activity);
          const patch: Partial<Activity> = {
            ...clean,
            slot: found.activity.slot,
            suggested_time: clean.suggested_time ?? found.activity.suggested_time,
            source: res.mode === "live" ? "ai" : "demo",
            user_modified: false,
            completed: false,
          };
          await repo.updateActivity(activityId, patch);
          setDays((days) =>
            days.map((d) => (d.id === found.day.id ? { ...d, activities: d.activities.map((a) => (a.id === activityId ? { ...a, ...patch } : a)) } : d)),
          );
          setLastMode(res.mode);
          toast.success(`Swapped in ${clean.name}${res.mode === "demo" ? " (demo content)" : ""}`);
        } catch (err) {
          await fail(err, "Could not regenerate activity");
        } finally {
          setBusy((s) => ({ ...s, activityId: null }));
        }
      },

      async addActivity(dayId, data) {
        const day = bundleRef.current.days.find((d) => d.id === dayId);
        if (!day) return;
        const ts = nowIso();
        const activity: Activity = {
          ...data,
          id: uid(),
          day_id: dayId,
          trip_id: tripId,
          sort_order: day.activities.length,
          completed: false,
          source: "user",
          user_modified: true,
          created_at: ts,
          updated_at: ts,
        };
        const ordered = orderActivities([...day.activities, activity]);
        try {
          await repo.addActivity(ordered.find((a) => a.id === activity.id)!);
          const nextDay = { ...day, activities: ordered };
          await persistDayOrder(nextDay);
          setDays((days) => days.map((d) => (d.id === dayId ? nextDay : d)));
          toast.success("Activity added");
        } catch (err) {
          await fail(err, "Could not add activity");
        }
      },

      async updateActivity(id, patch, opts) {
        const found = findActivity(bundleRef.current, id);
        if (!found) return;
        const contentChange = Object.keys(patch).some((k) => !["completed", "sort_order", "latitude", "longitude"].includes(k));
        const full = { ...patch, ...(contentChange ? { user_modified: true } : {}) };
        setDays((days) =>
          days.map((d) => (d.id === found.day.id ? { ...d, activities: d.activities.map((a) => (a.id === id ? { ...a, ...full } : a)) } : d)),
        );
        try {
          await repo.updateActivity(id, full);
          if (!opts?.silent) toast.success("Saved");
        } catch (err) {
          await fail(err, "Could not save activity");
        }
      },

      async deleteActivity(id) {
        const found = findActivity(bundleRef.current, id);
        if (!found) return;
        setDays((days) => days.map((d) => (d.id === found.day.id ? { ...d, activities: d.activities.filter((a) => a.id !== id) } : d)));
        try {
          await repo.deleteActivity(id);
          toast.success("Activity removed");
        } catch (err) {
          await fail(err, "Could not delete activity");
        }
      },

      async moveActivity(id, toDayId, toIndex) {
        const current = bundleRef.current;
        const found = findActivity(current, id);
        if (!found) return;
        const moved = { ...found.activity, day_id: toDayId };
        const days = current.days.map((d) => ({ ...d, activities: d.activities.filter((a) => a.id !== id) }));
        const target = days.find((d) => d.id === toDayId);
        if (!target) return;
        target.activities.splice(Math.max(0, Math.min(toIndex, target.activities.length)), 0, moved);
        // Infer the slot from the neighbours so the card lands in a sensible part of the day.
        const prev = target.activities[toIndex - 1];
        const nextA = target.activities[toIndex + 1];
        moved.slot = prev?.slot ?? nextA?.slot ?? moved.slot;
        const touched = days
          .filter((d) => d.id === toDayId || d.id === found.day.id)
          .map((d) => ({ ...d, activities: d.activities.map((a, i) => ({ ...a, sort_order: i })) }));
        setBundle((b) => ({ ...b, days: b.days.map((d) => touched.find((t) => t.id === d.id) ?? d) }));
        try {
          await repo.reorderActivities(
            touched.flatMap((d) => d.activities.map((a) => ({ id: a.id, day_id: d.id, sort_order: a.sort_order, slot: a.slot }))),
          );
        } catch (err) {
          await fail(err, "Could not reorder");
        }
      },

      async updateDay(id, patch) {
        setDays((days) => days.map((d) => (d.id === id ? { ...d, ...patch } : d)));
        try {
          await repo.updateDay(id, patch);
        } catch (err) {
          await fail(err, "Could not save day");
        }
      },

      async saveBooking(booking) {
        try {
          await repo.saveBooking(booking);
          setBundle((b) => {
            const exists = b.bookings.some((x) => x.id === booking.id);
            return { ...b, bookings: exists ? b.bookings.map((x) => (x.id === booking.id ? booking : x)) : [...b.bookings, booking] };
          });
          toast.success("Booking saved");
        } catch (err) {
          await fail(err, "Could not save booking");
          throw err;
        }
      },

      async deleteBooking(id) {
        setBundle((b) => ({ ...b, bookings: b.bookings.filter((x) => x.id !== id) }));
        try {
          await repo.deleteBooking(id);
          toast.success("Booking deleted");
        } catch (err) {
          await fail(err, "Could not delete booking");
        }
      },

      async saveExpense(expense) {
        try {
          await repo.saveExpense(expense);
          setBundle((b) => {
            const exists = b.expenses.some((x) => x.id === expense.id);
            return { ...b, expenses: exists ? b.expenses.map((x) => (x.id === expense.id ? expense : x)) : [...b.expenses, expense] };
          });
          toast.success("Expense saved");
        } catch (err) {
          await fail(err, "Could not save expense");
          throw err;
        }
      },

      async deleteExpense(id) {
        setBundle((b) => ({ ...b, expenses: b.expenses.filter((x) => x.id !== id) }));
        try {
          await repo.deleteExpense(id);
        } catch (err) {
          await fail(err, "Could not delete expense");
        }
      },

      async sendMessage(text) {
        const ts = nowIso();
        const userMsg: ChatMessage = { id: uid(), trip_id: tripId, role: "user", content: text, proposal: null, mode: null, created_at: ts };
        const before = bundleRef.current;
        setBundle((b) => ({ ...b, messages: [...b.messages, userMsg] }));
        setBusy((s) => ({ ...s, chatting: true }));
        try {
          await repo.addMessage(userMsg);
          const res = await postJSON<{ mode: AIMode; response: AIChatResponse }>("/api/ai/chat", {
            bundle: aiBundle(before),
            preferences,
            message: text,
          });
          const proposal = toProposal(res.response, before);
          const reply: ChatMessage = {
            id: uid(),
            trip_id: tripId,
            role: "assistant",
            content: res.response.reply,
            proposal,
            mode: res.mode,
            created_at: nowIso(),
          };
          await repo.addMessage(reply);
          setBundle((b) => ({ ...b, messages: [...b.messages, reply] }));
          setLastMode(res.mode);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "The concierge couldn't respond");
        } finally {
          setBusy((s) => ({ ...s, chatting: false }));
        }
      },

      async applyProposal(messageId) {
        const current = bundleRef.current;
        const msg = current.messages.find((m) => m.id === messageId);
        if (!msg?.proposal || msg.proposal.status !== "pending") return;
        const source = msg.mode === "live" ? "ai" : "demo";
        let days = current.days.map((d) => ({ ...d, activities: [...d.activities] }));
        try {
          for (const op of msg.proposal.operations) {
            if (op.type === "remove_activity") {
              const day = days.find((d) => d.activities.some((a) => a.id === op.activity_id));
              if (!day) continue;
              await repo.deleteActivity(op.activity_id);
              day.activities = day.activities.filter((a) => a.id !== op.activity_id);
            } else if (op.type === "replace_activity") {
              const day = days.find((d) => d.activities.some((a) => a.id === op.activity_id));
              if (!day) continue;
              const prev = day.activities.find((a) => a.id === op.activity_id)!;
              const clean = sanitizeActivity(op.activity);
              const patch: Partial<Activity> = {
                ...clean,
                slot: clean.slot ?? prev.slot,
                suggested_time: clean.suggested_time ?? prev.suggested_time,
                source,
                user_modified: false,
                completed: false,
              };
              await repo.updateActivity(prev.id, patch);
              day.activities = day.activities.map((a) => (a.id === prev.id ? { ...a, ...patch } : a));
            } else if (op.type === "add_activity") {
              const day = days.find((d) => d.day_number === op.day_number);
              if (!day) continue;
              const a = toActivity(op.activity, { tripId, dayId: day.id, sortOrder: day.activities.length, source });
              await repo.addActivity(a);
              day.activities = orderActivities([...day.activities, a]);
              await persistDayOrder(day);
            }
          }
          days = days.map((d) => ({ ...d, activities: d.activities.map((a, i) => ({ ...a, sort_order: a.sort_order ?? i })) }));
          const proposal: ChangeProposal = { ...msg.proposal, status: "applied" };
          await repo.updateMessage(messageId, { proposal });
          setBundle((b) => ({ ...b, days, messages: b.messages.map((m) => (m.id === messageId ? { ...m, proposal } : m)) }));
          toast.success("Itinerary updated");
        } catch (err) {
          await fail(err, "Could not apply the change");
        }
      },

      async dismissProposal(messageId) {
        const msg = bundleRef.current.messages.find((m) => m.id === messageId);
        if (!msg?.proposal) return;
        const proposal: ChangeProposal = { ...msg.proposal, status: "dismissed" };
        setBundle((b) => ({ ...b, messages: b.messages.map((m) => (m.id === messageId ? { ...m, proposal } : m)) }));
        await repo.updateMessage(messageId, { proposal }).catch(() => undefined);
      },

      async clearChat() {
        try {
          await repo.clearMessages(tripId);
          setBundle((b) => ({ ...b, messages: [] }));
        } catch (err) {
          await fail(err, "Could not clear conversation");
        }
      },

      async savePlace(a) {
        const exists = bundleRef.current.savedPlaces.some((p) => p.name === a.name);
        if (exists) {
          toast("Already in your saved places");
          return;
        }
        const day = bundleRef.current.days.find((d) => d.id === a.day_id);
        const place: SavedPlace = {
          id: uid(),
          user_id: bundleRef.current.trip.user_id,
          trip_id: tripId,
          name: a.name,
          city: day?.city ?? "",
          category: a.category,
          notes: a.description.slice(0, 160),
          latitude: a.latitude,
          longitude: a.longitude,
          created_at: nowIso(),
        };
        try {
          await repo.savePlace(place);
          setBundle((b) => ({ ...b, savedPlaces: [place, ...b.savedPlaces] }));
          toast.success("Saved to your places");
        } catch (err) {
          await fail(err, "Could not save place");
        }
      },

      async removePlace(id) {
        setBundle((b) => ({ ...b, savedPlaces: b.savedPlaces.filter((p) => p.id !== id) }));
        await repo.deletePlace(id).catch((err: unknown) => fail(err, "Could not remove place"));
      },
    };
  }, [bundle, busy, streaming, lastMode, reload, focusedActivityId, repo, tripId, preferences, fail]);

  return <TripContext value={value}>{children}</TripContext>;
}

/** Validate AI-proposed operations against the real itinerary. */
function toProposal(res: AIChatResponse, bundle: TripBundle): ChangeProposal | null {
  if (!res.proposal || !res.proposal.operations.length) return null;
  const names = new Map(bundle.days.flatMap((d) => d.activities.map((a) => [a.id, `${a.name} (Day ${d.day_number})`] as const)));
  const ids = new Set(names.keys());
  const dayNumbers = new Set(bundle.days.map((d) => d.day_number));
  const operations: ChangeProposal["operations"] = [];
  for (const op of res.proposal.operations) {
    if (op.type === "remove_activity" && op.activity_id && ids.has(op.activity_id)) {
      operations.push({ type: "remove_activity", activity_id: op.activity_id, target_name: names.get(op.activity_id), reason: op.reason });
    } else if (op.type === "replace_activity" && op.activity_id && ids.has(op.activity_id) && op.activity) {
      operations.push({ type: "replace_activity", activity_id: op.activity_id, target_name: names.get(op.activity_id), reason: op.reason, activity: sanitizeActivity(op.activity) });
    } else if (op.type === "add_activity" && op.day_number && dayNumbers.has(op.day_number) && op.activity) {
      operations.push({ type: "add_activity", day_number: op.day_number, reason: op.reason, activity: sanitizeActivity(op.activity) });
    }
  }
  if (!operations.length) return null;
  return { summary: res.proposal.summary, operations, status: "pending" };
}
