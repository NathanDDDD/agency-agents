"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { lookupLocation } from "@/lib/hooks/geocode-client";
import { Button } from "@/components/ui/button";
import { Clock, Crosshair, ExternalLink, MapPin, MapPinOff, Utensils, Wallet, X } from "lucide-react";
import { useTrip } from "./trip-context";
import { TripMap } from "@/components/map/trip-map";
import type { MapMarker } from "@/components/map/types";
import { EmptyState } from "@/components/ui/empty-state";
import { CATEGORY_META, dayColor } from "@/lib/options";
import { cn, formatDate, formatDuration, formatMoney, formatTime } from "@/lib/utils";

export function MapTab() {
  const { bundle, focusedActivityId, focusActivity, updateActivity } = useTrip();
  const [locating, setLocating] = useState<{ done: number; total: number } | null>(null);
  const [dayFilter, setDayFilter] = useState<string | "all">(() => {
    if (!focusedActivityId) return "all";
    return bundle.days.find((d) => d.activities.some((a) => a.id === focusedActivityId))?.id ?? "all";
  });

  const visibleDays = useMemo(
    () => (dayFilter === "all" ? bundle.days : bundle.days.filter((d) => d.id === dayFilter)),
    [bundle.days, dayFilter],
  );

  const markers: MapMarker[] = useMemo(
    () =>
      visibleDays.flatMap((d) =>
        d.activities
          .filter((a) => a.latitude !== null && a.longitude !== null)
          .map((a, i) => ({
            id: a.id,
            lat: a.latitude!,
            lng: a.longitude!,
            label: dayFilter === "all" ? String(d.day_number) : String(i + 1),
            color: a.is_restaurant ? "#DDA96C" : dayColor(d.day_number),
            title: a.name,
            subtitle: `Day ${d.day_number}${a.suggested_time ? ` · ${formatTime(a.suggested_time)}` : ""}`,
            group: d.id,
          })),
      ),
    [visibleDays, dayFilter],
  );

  const selected = (() => {
    for (const d of bundle.days) {
      const a = d.activities.find((x) => x.id === focusedActivityId);
      if (a) return { a, d };
    }
    return null;
  })();

  const unmapped = visibleDays.flatMap((d) => d.activities.filter((a) => a.latitude === null || a.longitude === null));

  if (!bundle.days.length) {
    return <EmptyState icon={<MapPin className="h-6 w-6" />} title="Nothing to map yet" description="Generate an itinerary and every stop will appear here, grouped by day." />;
  }

  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Filter by day">
        <FilterChip active={dayFilter === "all"} onClick={() => setDayFilter("all")} label="All days" />
        {bundle.days.map((d) => (
          <FilterChip key={d.id} active={dayFilter === d.id} onClick={() => setDayFilter(d.id)} label={`Day ${d.day_number}`} color={dayColor(d.day_number)} />
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="order-2 max-h-[70vh] space-y-4 overflow-y-auto lg:order-1">
          {visibleDays.map((d) => (
            <section key={d.id} className="card p-4">
              <h3 className="flex items-center gap-2 font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: dayColor(d.day_number) }}>{d.day_number}</span>
                {d.title}
                <span className="ml-auto text-xs font-normal text-muted">{formatDate(d.date)}</span>
              </h3>
              <ol className="mt-3 space-y-1">
                {d.activities.map((a, i) => {
                  const mapped = a.latitude !== null && a.longitude !== null;
                  return (
                    <li key={a.id}>
                      <button
                        disabled={!mapped}
                        onClick={() => focusActivity(a.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition",
                          focusedActivityId === a.id ? "bg-pilot-50 text-navy" : "hover:bg-ivory-200/70",
                          !mapped && "cursor-default opacity-60",
                        )}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: a.is_restaurant ? "#DDA96C" : dayColor(d.day_number) }}>
                          {a.is_restaurant ? <Utensils className="h-3 w-3" /> : i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{a.name}</span>
                          <span className="text-xs text-muted">{a.suggested_time ? formatTime(a.suggested_time) : a.slot}{!mapped && " · no location"}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>

        <div className="relative order-1 h-[55vh] overflow-hidden rounded-[var(--radius-card)] border border-line shadow-soft lg:order-2 lg:h-[70vh]">
          {markers.length ? (
            <TripMap markers={markers} focusedId={focusedActivityId} onSelect={focusActivity} className="h-full w-full" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-ivory-200 p-6 text-center text-muted">
              <MapPinOff className="h-8 w-8" />
              <p className="text-sm">No locations for this selection yet.</p>
            </div>
          )}
          {selected && (
            <div className="absolute inset-x-3 bottom-3 z-[500] animate-sheet-up rounded-2xl border border-line bg-white p-4 shadow-lift sm:left-auto sm:right-14 sm:w-80">
              <button onClick={() => focusActivity(null)} className="absolute right-2 top-2 rounded-full p-1.5 text-muted hover:bg-ivory-200" aria-label="Close details">
                <X className="h-4 w-4" />
              </button>
              <p className="text-xs font-semibold" style={{ color: CATEGORY_META[selected.a.category]?.color }}>
                Day {selected.d.day_number} · {CATEGORY_META[selected.a.category]?.label}
              </p>
              <p className="mt-0.5 pr-6 font-semibold">{selected.a.name}</p>
              {selected.a.description && <p className="mt-1 line-clamp-3 text-sm text-muted">{selected.a.description}</p>}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                {selected.a.suggested_time && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatTime(selected.a.suggested_time)}{selected.a.duration_minutes ? ` · ${formatDuration(selected.a.duration_minutes)}` : ""}</span>}
                {selected.a.estimated_cost ? <span className="flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> ~{formatMoney(selected.a.estimated_cost, bundle.trip.currency)}</span> : null}
              </div>
              {selected.a.address && <p className="mt-1.5 flex items-center gap-1 text-xs text-muted"><MapPin className="h-3.5 w-3.5" /> {selected.a.address}</p>}
              <div className="mt-3 flex gap-3 text-sm font-semibold">
                {selected.a.latitude !== null && (
                  <a
                    className="inline-flex items-center gap-1 text-pilot"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selected.a.latitude},${selected.a.longitude}`}
                  >
                    Directions <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {selected.a.booking_url && (
                  <a className="inline-flex items-center gap-1 text-pilot" target="_blank" rel="noopener noreferrer" href={selected.a.booking_url}>
                    Website <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {unmapped.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white/70 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted">
            {unmapped.length} {unmapped.length === 1 ? "stop has" : "stops have"} no location yet and {unmapped.length === 1 ? "isn't" : "aren't"} shown on the map.
          </p>
          <Button
            size="sm"
            variant="secondary"
            icon={<Crosshair className="h-4 w-4" />}
            loading={!!locating}
            onClick={async () => {
              const targets = visibleDays.flatMap((d) =>
                d.activities.filter((a) => a.latitude === null || a.longitude === null).map((a) => ({ a, d })),
              );
              let found = 0;
              setLocating({ done: 0, total: targets.length });
              for (const [i, { a, d }] of targets.entries()) {
                try {
                  // Prefer the address; fall back to the place name within the day's city.
                  const hit = await lookupLocation(a.address || a.name, d.city);
                  if (hit) {
                    found++;
                    await updateActivity(a.id, { latitude: hit.latitude, longitude: hit.longitude }, { silent: true });
                  }
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Location lookup failed");
                  break;
                }
                setLocating({ done: i + 1, total: targets.length });
              }
              setLocating(null);
              toast.success(found ? `Placed ${found} of ${targets.length} stops on the map` : "Couldn't find those locations");
            }}
          >
            {locating ? `Locating ${locating.done}/${locating.total}…` : "Locate missing stops"}
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
        active ? "border-navy bg-navy text-ivory" : "border-line bg-white hover:border-navy/30",
      )}
    >
      {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}
