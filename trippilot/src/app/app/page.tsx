"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Bookmark, CalendarDays, Clock, MapPin, MessageCircle, Plus, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton } from "@/components/ui/spinner";
import { useData } from "@/lib/data/provider";
import type { TripSummary } from "@/lib/data/repository";
import type { SavedPlace } from "@/lib/types";
import { photoForDestination, PHOTOS } from "@/lib/images";
import { daysBetween, formatDateRange, formatMoney, pluralize, todayString, tripLength, tripStatus } from "@/lib/utils";
import { CATEGORY_META } from "@/lib/options";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function TripCard({ s, featured }: { s: TripSummary; featured?: boolean }) {
  const t = s.trip;
  const status = tripStatus(t.start_date, t.end_date);
  const until = daysBetween(todayString(), t.start_date);
  return (
    <Link
      href={`/app/trips/${t.id}`}
      className={`group relative block overflow-hidden rounded-[var(--radius-card)] shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift ${featured ? "h-80 sm:h-96" : "h-64"}`}
    >
      <SafeImage src={t.cover_image ?? photoForDestination(t.destinations)} alt={t.destinations.join(", ")} seed={t.id} className="transition duration-700 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/30 to-transparent" />
      <div className="absolute left-4 top-4 flex gap-2">
        {status === "active" && <Badge tone="gold">Happening now</Badge>}
        {status === "upcoming" && <Badge className="bg-white/90 text-navy">{until === 0 ? "Today" : `In ${pluralize(until, "day")}`}</Badge>}
        {status === "completed" && <Badge className="bg-white/80 text-navy">Completed</Badge>}
        {t.itinerary_source === "ai" && <Badge tone="blue" icon={<Sparkles className="h-3 w-3" />}>AI planned</Badge>}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 text-ivory">
        <p className="flex items-center gap-1.5 text-sm text-ivory/80">
          <MapPin className="h-3.5 w-3.5" /> {t.destinations.join(" · ")}
        </p>
        <h3 className={`mt-1 font-display ${featured ? "text-3xl sm:text-4xl" : "text-2xl"}`}>{t.name}</h3>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ivory/80">
          <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {formatDateRange(t.start_date, t.end_date)}</span>
          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {pluralize(tripLength(t.start_date, t.end_date), "day")}</span>
          <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {t.travelers}</span>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { repo, profile } = useData();
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [places, setPlaces] = useState<SavedPlace[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([repo.listTrips(), repo.listSavedPlaces()])
      .then(([t, p]) => {
        if (!alive) return;
        setTrips(t);
        setPlaces(p);
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not load trips"));
    return () => {
      alive = false;
    };
  }, [repo]);

  const firstName = (profile.full_name || "").split(" ")[0];

  if (!trips) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-80 w-full" />
        <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
      </div>
    );
  }

  const upcoming = trips
    .filter((s) => tripStatus(s.trip.start_date, s.trip.end_date) !== "completed")
    .sort((a, b) => a.trip.start_date.localeCompare(b.trip.start_date));
  const past = trips
    .filter((s) => tripStatus(s.trip.start_date, s.trip.end_date) === "completed")
    .sort((a, b) => b.trip.start_date.localeCompare(a.trip.start_date));
  const recent = [...trips].sort((a, b) => b.trip.updated_at.localeCompare(a.trip.updated_at)).slice(0, 4);
  const next = upcoming[0];

  if (!trips.length) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem]">
          <SafeImage src={PHOTOS.heroRoad} alt="Open road" seed="empty" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/60 to-navy/10" />
          <div className="absolute inset-0 flex flex-col justify-center p-8 text-ivory sm:p-12">
            <p className="text-sm font-semibold uppercase tracking-wider text-gold">Welcome{firstName ? `, ${firstName}` : ""}</p>
            <h1 className="mt-3 max-w-xl font-display text-4xl leading-tight sm:text-5xl">Where are we flying first?</h1>
            <p className="mt-3 max-w-md text-ivory/80">Describe a trip in a sentence and TripPilot will plan every day, map it and keep your budget on track.</p>
            <div className="mt-7">
              <LinkButton href="/app/trips/new" variant="gold" size="lg" icon={<Sparkles className="h-5 w-5" />}>
                Plan my first trip
              </LinkButton>
            </div>
          </div>
          <div className="h-[460px]" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { t: "Rome & Florence, 6 days", d: "Romantic, food-focused, relaxed pace" },
            { t: "Tokyo & Kyoto, 10 days", d: "Temples, ramen, design and nightlife" },
            { t: "Lisbon long weekend", d: "Trams, tiles and pastéis de nata" },
          ].map((x) => (
            <Link key={x.t} href={`/app/trips/new?idea=${encodeURIComponent(x.t)}`} className="card p-5 transition hover:shadow-lift">
              <p className="text-xs font-semibold uppercase tracking-wider text-pilot">Idea</p>
              <p className="mt-1 font-semibold">{x.t}</p>
              <p className="text-sm text-muted">{x.d}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted">{greeting()}{firstName ? `, ${firstName}` : ""}</p>
          <h1 className="font-display text-4xl">Your journeys</h1>
        </div>
        <LinkButton href="/app/trips/new" icon={<Plus className="h-4 w-4" />}>
          New trip
        </LinkButton>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          {next ? (
            <section aria-labelledby="next-trip">
              <h2 id="next-trip" className="sr-only">Next trip</h2>
              <TripCard s={next} featured />
            </section>
          ) : (
            <div className="card flex items-center justify-between gap-4 p-6">
              <div>
                <p className="font-semibold">No upcoming trips</p>
                <p className="text-sm text-muted">Time to plan the next one?</p>
              </div>
              <LinkButton href="/app/trips/new" size="sm" variant="gold">Plan a trip</LinkButton>
            </div>
          )}

          {upcoming.length > 1 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">Also coming up</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {upcoming.slice(1).map((s) => <TripCard key={s.trip.id} s={s} />)}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">Past trips</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {past.map((s) => <TripCard key={s.trip.id} s={s} />)}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          {next && (
            <Link href={`/app/trips/${next.trip.id}?tab=concierge`} className="block rounded-[var(--radius-card)] bg-navy p-5 text-ivory shadow-lift transition hover:bg-navy-800">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold text-navy">
                <MessageCircle className="h-5 w-5" />
              </span>
              <p className="mt-4 font-display text-xl">Ask TripPilot</p>
              <p className="mt-1 text-sm text-ivory/70">“Find something romantic for tonight” or “How much have we spent so far?”</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold">
                Open concierge for {next.trip.name} <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          )}

          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-bold"><Bookmark className="h-4 w-4 text-gold-600" /> Saved places</h2>
            {places.length ? (
              <ul className="mt-3 space-y-2.5">
                {places.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-start gap-3">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_META[p.category]?.color }} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="truncate text-xs text-muted">{p.city}{p.notes ? ` · ${p.notes}` : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Bookmark activities from any itinerary to keep them here.</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-bold">Recent activity</h2>
            <ul className="mt-3 space-y-3">
              {recent.map((s) => (
                <li key={s.trip.id}>
                  <Link href={`/app/trips/${s.trip.id}`} className="flex items-center justify-between gap-3 text-sm hover:text-pilot">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{s.trip.name}</span>
                      <span className="text-xs text-muted">
                        {pluralize(s.activityCount, "activity", "activities")} · {pluralize(s.bookingCount, "booking")} · {formatMoney(s.spent, s.trip.currency)} spent
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {new Date(s.trip.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
