"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  LayoutGrid,
  ListOrdered,
  Map as MapIcon,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useTrip } from "./trip-context";
import { SafeImage } from "@/components/ui/safe-image";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { TripForm } from "@/components/forms/trip-form";
import { photoForDestination } from "@/lib/images";
import { cn, formatDateRange, pluralize, tripLength } from "@/lib/utils";
import { OverviewTab } from "./overview-tab";
import { ItineraryTab } from "./itinerary-tab";
import { MapTab } from "./map-tab";
import { BookingsTab } from "./bookings-tab";
import { BudgetTab } from "./budget-tab";
import { ConciergeTab } from "./concierge-tab";

export const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "itinerary", label: "Itinerary", icon: ListOrdered },
  { id: "map", label: "Map", icon: MapIcon },
  { id: "bookings", label: "Bookings", icon: Ticket },
  { id: "budget", label: "Budget", icon: PiggyBank },
  { id: "concierge", label: "Concierge", icon: MessageCircle },
] as const;

export type TabId = (typeof TABS)[number]["id"];

function TripMenu() {
  const { bundle, updateTrip, deleteTrip } = useTrip();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = bundle.trip;
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-ivory backdrop-blur hover:bg-white/25"
        aria-label="Trip options"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-52 animate-fade-in rounded-2xl border border-line bg-white p-1.5 text-ink shadow-lift">
          <button onClick={() => { setEditing(true); setOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ivory-200">
            <Pencil className="h-4 w-4" /> Edit trip details
          </button>
          <button onClick={() => { setConfirm(true); setOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger hover:bg-danger/5">
            <Trash2 className="h-4 w-4" /> Delete trip
          </button>
        </div>
      )}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit trip" size="lg">
        <TripForm
          showPrompt={false}
          submitLabel="Save changes"
          defaultValues={{
            name: t.name,
            destinations: t.destinations.join(", "),
            start_date: t.start_date,
            end_date: t.end_date,
            travelers: t.travelers,
            travel_party: t.travel_party,
            budget: t.budget,
            currency: t.currency,
            budget_excludes_flights: t.budget_excludes_flights,
            pace: t.pace,
            interests: t.interests,
            description: t.description,
            special_requests: t.special_requests,
          }}
          onSubmit={async (v) => {
            const destinations = v.destinations.split(",").map((d) => d.trim()).filter(Boolean);
            const lengthChanged = tripLength(v.start_date, v.end_date) !== tripLength(t.start_date, t.end_date) || v.start_date !== t.start_date;
            await updateTrip({
              ...v,
              destinations,
              cover_image: destinations.join() === t.destinations.join() ? t.cover_image : photoForDestination(destinations),
            });
            if (lengthChanged && bundle.days.length) {
              toast("Dates changed. Regenerate the itinerary to match the new dates.", { duration: 6000 });
            }
            setEditing(false);
          }}
        />
      </Modal>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        loading={deleting}
        title="Delete this trip?"
        message={`“${t.name}” and its itinerary, bookings, expenses and conversation will be permanently deleted.`}
        confirmLabel="Delete trip"
        onConfirm={async () => {
          setDeleting(true);
          try {
            await deleteTrip();
            toast.success("Trip deleted");
            router.replace("/app");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not delete trip");
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}

export function TripDashboard() {
  const { bundle, generateItinerary, busy } = useTrip();
  const [tab, setTabState] = useState<TabId>("overview");
  const autoGen = useRef(false);
  const t = bundle.trip;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("tab") as TabId | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync initial tab from URL
    if (fromUrl && TABS.some((x) => x.id === fromUrl)) setTabState(fromUrl);
    if (params.get("generate") === "1" && !autoGen.current && bundle.days.length === 0) {
      autoGen.current = true;
      params.delete("generate");
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      void generateItinerary();
    }
    // Only on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTab = (id: TabId) => {
    setTabState(id);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", id);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const n = tripLength(t.start_date, t.end_date);

  return (
    <div>
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden">
          <SafeImage src={t.cover_image ?? photoForDestination(t.destinations)} alt={t.destinations.join(", ")} seed={t.id} priority />
          <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/50 to-navy/20" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 pb-6 pt-5 text-ivory lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/app" className="flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-sm font-semibold backdrop-blur hover:bg-white/25">
              <ArrowLeft className="h-4 w-4" /> Trips
            </Link>
            <TripMenu />
          </div>
          <div className="mt-16 sm:mt-24">
            <div className="flex flex-wrap gap-2">
              {t.itinerary_source === "ai" && <Badge tone="blue">AI-planned itinerary</Badge>}
              {t.itinerary_source === "demo" && <Badge tone="gold">Demo itinerary</Badge>}
            </div>
            <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">{t.name}</h1>
            <p className="mt-1 text-ivory/80">{t.destinations.join(" · ")}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ivory/80">
              <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {formatDateRange(t.start_date, t.end_date)} · {pluralize(n, "day")}</span>
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {pluralize(t.travelers, "traveler")}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="sticky top-16 z-30 border-b border-line bg-ivory/95 backdrop-blur">
        <div className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 lg:px-8" role="tablist" aria-label="Trip sections">
          {TABS.map((x) => (
            <button
              key={x.id}
              role="tab"
              id={`tab-${x.id}`}
              aria-selected={tab === x.id}
              aria-controls={`panel-${x.id}`}
              onClick={() => setTab(x.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition",
                tab === x.id ? "bg-navy text-ivory" : "text-navy/70 hover:bg-navy/5",
              )}
            >
              <x.icon className="h-4 w-4" />
              {x.label}
              {x.id === "itinerary" && busy.generating && <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />}
            </button>
          ))}
        </div>
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        {tab === "overview" && <OverviewTab onNavigate={setTab} />}
        {tab === "itinerary" && <ItineraryTab onNavigate={setTab} />}
        {tab === "map" && <MapTab />}
        {tab === "bookings" && <BookingsTab />}
        {tab === "budget" && <BudgetTab />}
        {tab === "concierge" && <ConciergeTab />}
      </div>
    </div>
  );
}
