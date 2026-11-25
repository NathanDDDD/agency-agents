"use client";

import { ArrowRight, CalendarClock, CloudSun, MapPin, PiggyBank, Sparkles, Ticket, Users, Wand2 } from "lucide-react";
import { useTrip } from "./trip-context";
import type { TabId } from "./trip-dashboard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { budgetSnapshot } from "@/lib/ai/context";
import { BOOKING_TYPES, CATEGORY_META } from "@/lib/options";
import { daysBetween, formatDate, formatMoney, formatTime, pluralize, todayString, tripLength, tripStatus } from "@/lib/utils";

export function OverviewTab({ onNavigate }: { onNavigate: (t: TabId) => void }) {
  const { bundle, generateItinerary, busy } = useTrip();
  const t = bundle.trip;
  const status = tripStatus(t.start_date, t.end_date);
  const until = daysBetween(todayString(), t.start_date);
  const budget = budgetSnapshot(bundle);
  const committed = budget.spent + budget.planned;
  const pct = t.budget > 0 ? Math.min(100, (committed / t.budget) * 100) : 0;

  const today = todayString();
  const upcomingDays = status === "active" ? bundle.days.filter((d) => d.date >= today) : bundle.days;
  const upcoming = upcomingDays.flatMap((d) => d.activities.filter((a) => !a.completed).map((a) => ({ a, d }))).slice(0, 5);
  const bookings = [...bundle.bookings]
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || (a.time ?? "").localeCompare(b.time ?? ""))
    .slice(0, 4);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<CalendarClock className="h-4 w-4" />} label={status === "upcoming" ? "Countdown" : "Status"} value={status === "upcoming" ? (until === 0 ? "Today!" : pluralize(until, "day")) : status === "active" ? "On the road" : "Completed"} />
          <Stat icon={<MapPin className="h-4 w-4" />} label="Duration" value={pluralize(tripLength(t.start_date, t.end_date), "day")} />
          <Stat icon={<Users className="h-4 w-4" />} label="Travelers" value={`${t.travelers} · ${t.travel_party}`} />
          <Stat icon={<Ticket className="h-4 w-4" />} label="Bookings" value={String(bundle.bookings.length)} />
        </div>

        {bundle.days.length === 0 ? (
          <EmptyState
            icon={<Wand2 className="h-6 w-6" />}
            title="No itinerary yet"
            description="Let TripPilot plan every day around your preferences, budget and pace."
            action={
              <Button onClick={() => void generateItinerary()} loading={busy.generating} variant="gold" icon={<Sparkles className="h-4 w-4" />}>
                Generate itinerary
              </Button>
            }
          />
        ) : (
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{status === "active" ? "Up next" : "First up"}</h2>
              <button className="flex items-center gap-1 text-sm font-semibold text-pilot" onClick={() => onNavigate("itinerary")}>
                Full itinerary <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            {upcoming.length ? (
              <ol className="mt-4 space-y-3">
                {upcoming.map(({ a, d }) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_META[a.category]?.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{a.name}</p>
                      <p className="text-sm text-muted">
                        Day {d.day_number} · {formatDate(d.date, { weekday: "short", month: "short", day: "numeric" })}
                        {a.suggested_time ? ` · ${formatTime(a.suggested_time)}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-muted">Everything’s checked off. What a trip!</p>
            )}
          </section>
        )}

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Important bookings</h2>
            <button className="flex items-center gap-1 text-sm font-semibold text-pilot" onClick={() => onNavigate("bookings")}>
              Manage <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {bookings.length ? (
            <ul className="mt-4 divide-y divide-line">
              {bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.name}</p>
                    <p className="text-sm text-muted">
                      {BOOKING_TYPES.find((x) => x.value === b.type)?.label}
                      {b.date ? ` · ${formatDate(b.date)}` : ""}
                      {b.time ? ` · ${formatTime(b.time)}` : ""}
                    </p>
                  </div>
                  {b.confirmation_number && <code className="shrink-0 rounded-lg bg-ivory-200 px-2 py-1 text-xs">{b.confirmation_number}</code>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Add flights, hotels and reservations to keep confirmations handy.</p>
          )}
        </section>
      </div>

      <div className="space-y-5">
        <button onClick={() => onNavigate("budget")} className="card block w-full p-5 text-left transition hover:shadow-lift">
          <h2 className="flex items-center gap-2 font-bold"><PiggyBank className="h-4 w-4 text-gold-600" /> Budget</h2>
          <p className="mt-3 font-display text-3xl">{formatMoney(Math.max(0, t.budget - committed), t.currency)}</p>
          <p className="text-sm text-muted">left of {formatMoney(t.budget, t.currency)}{t.budget_excludes_flights ? " (excl. flights)" : ""}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ivory-200" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Budget used">
            <div className={`h-full rounded-full ${pct > 95 ? "bg-danger" : "bg-navy"}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>Spent {formatMoney(budget.spent, t.currency)}</span>
            <span>Planned {formatMoney(budget.planned, t.currency)}</span>
          </div>
        </button>

        <section className="card overflow-hidden">
          <div className="bg-gradient-to-br from-pilot to-navy p-5 text-ivory">
            <h2 className="flex items-center gap-2 font-bold"><CloudSun className="h-4 w-4" /> Weather</h2>
            <p className="mt-3 font-display text-2xl">Forecast coming soon</p>
            <p className="mt-1 text-sm text-ivory/75">
              Live forecasts for {t.destinations[0] ?? "your destination"} will appear here closer to departure. Coming in the next release.
            </p>
          </div>
        </section>

        <button onClick={() => onNavigate("concierge")} className="block w-full rounded-[var(--radius-card)] bg-navy p-5 text-left text-ivory shadow-soft transition hover:bg-navy-800">
          <p className="font-display text-xl">Ask TripPilot</p>
          <p className="mt-1 text-sm text-ivory/70">“What should we do if it rains?”</p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold">Open concierge <ArrowRight className="h-4 w-4" /></span>
        </button>

        {t.description && (
          <section className="card p-5">
            <h2 className="font-bold">Trip brief</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t.description}</p>
            {t.special_requests && <p className="mt-2 text-sm"><b>Requests:</b> {t.special_requests}</p>}
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">{icon} {label}</p>
      <p className="mt-1.5 truncate font-semibold capitalize">{value}</p>
    </div>
  );
}
