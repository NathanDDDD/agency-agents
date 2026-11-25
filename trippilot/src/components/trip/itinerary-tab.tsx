"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bookmark,
  Check,
  Clock,
  ExternalLink,
  GripVertical,
  Info,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  StickyNote,
  Train,
  Trash2,
  Utensils,
  Wallet,
  Wand2,
} from "lucide-react";
import { useTrip } from "./trip-context";
import type { TabId } from "./trip-dashboard";
import { ActivityEditor, RegenerateDialog } from "./activity-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/field";
import { CATEGORY_META, dayColor } from "@/lib/options";
import type { Activity, ItineraryDay } from "@/lib/types";
import { cn, formatDate, formatDuration, formatMoney, formatTime } from "@/lib/utils";

const GEN_MESSAGES = [
  "Reading your preferences…",
  "Mapping neighbourhoods and travel times…",
  "Choosing restaurants that fit your budget…",
  "Balancing the pace of each day…",
  "Adding transport tips and notes…",
];

function GeneratingState() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % GEN_MESSAGES.length), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="card overflow-hidden" role="status" aria-live="polite">
      <div className="flex items-center gap-4 bg-navy p-6 text-ivory">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold text-navy">
          <Sparkles className="h-6 w-6 animate-pulse" />
        </span>
        <div>
          <p className="font-display text-xl">Planning your trip</p>
          <p className="text-sm text-ivory/70">{GEN_MESSAGES[i]}</p>
        </div>
      </div>
      <div className="space-y-3 p-6">
        {[0, 1, 2].map((k) => (
          <div key={k} className="flex gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-ivory-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 animate-pulse rounded bg-ivory-200" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-ivory-200" />
            </div>
          </div>
        ))}
        <p className="pt-2 text-xs text-muted">This usually takes 20–60 seconds with live AI.</p>
      </div>
    </div>
  );
}

function SourceBadge({ a }: { a: Activity }) {
  if (a.source === "user") return <Badge tone="green">Added by you</Badge>;
  if (a.user_modified) return <Badge tone="green">Edited</Badge>;
  if (a.source === "demo") return <Badge tone="gold">Demo suggestion</Badge>;
  return <Badge tone="blue" icon={<Sparkles className="h-3 w-3" />}>AI suggestion</Badge>;
}

function ActivityCard({ a, day, onShowOnMap }: { a: Activity; day: ItineraryDay; onShowOnMap: (id: string) => void }) {
  const { updateActivity, deleteActivity, regenerateActivity, savePlace, busy, bundle } = useTrip();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [regen, setRegen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: a.id });
  const meta = CATEGORY_META[a.category] ?? CATEGORY_META.other;
  const loading = busy.activityId === a.id;
  const saved = bundle.savedPlaces.some((p) => p.name === a.name);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-20")}
    >
      <div className={cn("group flex gap-2 rounded-2xl border bg-white p-3 transition sm:gap-3 sm:p-4", isDragging ? "border-pilot shadow-lift" : "border-line", a.completed && "opacity-60")}>
        <button
          className="mt-1 hidden cursor-grab touch-none text-ivory-300 hover:text-muted active:cursor-grabbing sm:block"
          aria-label={`Drag to reorder ${a.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <button
          onClick={() => void updateActivity(a.id, { completed: !a.completed }, { silent: true })}
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition",
            a.completed ? "border-success bg-success text-white" : "border-ivory-300 hover:border-success",
          )}
          aria-label={a.completed ? `Mark ${a.name} as not done` : `Mark ${a.name} as done`}
          aria-pressed={a.completed}
        >
          {a.completed && <Check className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-muted">
                {a.suggested_time && <span className="text-navy">{formatTime(a.suggested_time)}</span>}
                <span className="inline-flex items-center gap-1" style={{ color: meta.color }}>
                  {a.is_restaurant ? <Utensils className="h-3 w-3" /> : <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />}
                  {meta.label}
                </span>
              </p>
              <h4 className={cn("mt-0.5 font-semibold leading-snug", a.completed && "line-through")}>{a.name}</h4>
            </div>
            <div className="relative shrink-0">
              {loading ? (
                <Spinner className="m-2 h-5 w-5 text-pilot" />
              ) : (
                <button onClick={() => setMenu((m) => !m)} onBlur={() => setTimeout(() => setMenu(false), 150)} className="rounded-full p-1.5 text-muted hover:bg-ivory-200" aria-label={`Actions for ${a.name}`} aria-expanded={menu}>
                  <MoreVertical className="h-4 w-4" />
                </button>
              )}
              {menu && (
                <div className="absolute right-0 top-9 z-30 w-52 animate-fade-in rounded-2xl border border-line bg-white p-1.5 shadow-lift">
                  <MenuItem icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Edit</MenuItem>
                  <MenuItem icon={<RefreshCw className="h-4 w-4" />} onClick={() => setRegen(true)}>{a.is_restaurant ? "Suggest another restaurant" : "Suggest an alternative"}</MenuItem>
                  {a.latitude !== null && <MenuItem icon={<MapPin className="h-4 w-4" />} onClick={() => onShowOnMap(a.id)}>Show on map</MenuItem>}
                  <MenuItem icon={<Bookmark className="h-4 w-4" />} onClick={() => void savePlace(a)}>{saved ? "Saved" : "Save place"}</MenuItem>
                  <MenuItem icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)} danger>Delete</MenuItem>
                </div>
              )}
            </div>
          </div>
          {a.description && <p className="mt-1 text-sm leading-relaxed text-muted">{a.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
            {a.duration_minutes ? <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDuration(a.duration_minutes)}</span> : null}
            {a.estimated_cost !== null && a.estimated_cost > 0 && (
              <span className="inline-flex items-center gap-1" title="Estimated cost, not a quote"><Wallet className="h-3.5 w-3.5" /> ~{formatMoney(a.estimated_cost, bundle.trip.currency)}</span>
            )}
            {a.address && (
              a.latitude !== null ? (
                <button onClick={() => onShowOnMap(a.id)} className="inline-flex max-w-full items-center gap-1 truncate hover:text-pilot">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{a.address}</span>
                </button>
              ) : (
                <span className="inline-flex max-w-full items-center gap-1 truncate"><MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{a.address}</span></span>
              )
            )}
            {a.booking_url && (
              <a href={a.booking_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-pilot hover:underline">
                Website <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <SourceBadge a={a} />
          </div>
          {a.notes && (
            <p className="mt-2 flex gap-1.5 rounded-xl bg-ivory-200/60 px-3 py-2 text-xs text-navy/80">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" /> {a.notes}
            </p>
          )}
        </div>
      </div>
      {editing && <ActivityEditor open onClose={() => setEditing(false)} day={day} activity={a} />}
      <RegenerateDialog
        open={regen}
        onClose={() => setRegen(false)}
        title={a.is_restaurant ? "Suggest another restaurant" : "Suggest an alternative"}
        description={`Replace “${a.name}” with a new suggestion nearby.`}
        onSubmit={(text) => {
          setRegen(false);
          void regenerateActivity(a.id, text);
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Remove this activity?"
        message={`“${a.name}” will be removed from Day ${day.day_number}.`}
        confirmLabel="Remove"
        onConfirm={() => {
          setConfirmDelete(false);
          void deleteActivity(a.id);
        }}
      />
    </li>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-ivory-200", danger && "text-danger hover:bg-danger/5")}>
      {icon}
      {children}
    </button>
  );
}

function DayNotes({ day }: { day: ItineraryDay }) {
  const { updateDay } = useTrip();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(day.notes);
  if (!editing) {
    return (
      <button onClick={() => { setValue(day.notes); setEditing(true); }} className="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted hover:bg-ivory-200/60">
        <StickyNote className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{day.notes || "Add notes for this day"}</span>
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <Textarea rows={3} value={value} onChange={(e) => setValue(e.target.value)} aria-label={`Notes for day ${day.day_number}`} autoFocus />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        <Button size="sm" onClick={() => { void updateDay(day.id, { notes: value }); setEditing(false); }}>Save notes</Button>
      </div>
    </div>
  );
}

function DayCard({ day, onShowOnMap }: { day: ItineraryDay; onShowOnMap: (id: string) => void }) {
  const { moveActivity, regenerateDay, busy, bundle } = useTrip();
  const [adding, setAdding] = useState(false);
  const [regen, setRegen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const loading = busy.dayId === day.id;
  const estimate = day.activities.reduce((s, a) => s + (a.estimated_cost ?? 0), 0);
  const color = dayColor(day.day_number);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const to = day.activities.findIndex((a) => a.id === e.over!.id);
    if (to >= 0) void moveActivity(String(e.active.id), day.id, to);
  };

  return (
    <section id={`day-${day.day_number}`} className="scroll-mt-36" aria-labelledby={`day-title-${day.id}`}>
      <div className="card overflow-hidden">
        <header className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-white" style={{ background: color }}>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Day</span>
              <span className="font-display text-2xl leading-none">{day.day_number}</span>
            </div>
            <div>
              <p className="text-sm text-muted">{formatDate(day.date, { weekday: "long", month: "long", day: "numeric" })} · {day.city}</p>
              <h3 id={`day-title-${day.id}`} className="font-display text-2xl leading-tight">{day.title}</h3>
              {day.summary && <p className="mt-1 text-sm text-muted">{day.summary}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
            {estimate > 0 && <span className="text-sm text-muted" title="Sum of activity estimates">~{formatMoney(estimate, bundle.trip.currency)}</span>}
            <Button size="sm" variant="secondary" loading={loading} onClick={() => setRegen(true)} icon={<RefreshCw className="h-3.5 w-3.5" />}>
              Regenerate day
            </Button>
          </div>
        </header>

        {(day.morning_summary || day.afternoon_summary || day.evening_summary) && (
          <div className="grid gap-px bg-line text-sm sm:grid-cols-3">
            {[
              ["Morning", day.morning_summary],
              ["Afternoon", day.afternoon_summary],
              ["Evening", day.evening_summary],
            ].map(([label, text]) => (
              <div key={label} className="bg-ivory/60 px-5 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
                <p className="mt-0.5 text-navy/80">{text || "Free time"}</p>
              </div>
            ))}
          </div>
        )}

        <div className={cn("p-3 sm:p-5", loading && "pointer-events-none opacity-50")}>
          {day.activities.length ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={day.activities.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                <ol className="space-y-2.5">
                  {day.activities.map((a) => (
                    <ActivityCard key={a.id} a={a} day={day} onShowOnMap={onShowOnMap} />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="rounded-2xl border border-dashed border-ivory-300 p-6 text-center text-sm text-muted">A free day. Add something, or regenerate it.</p>
          )}
          <button onClick={() => setAdding(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-ivory-300 py-3 text-sm font-semibold text-navy/70 transition hover:border-navy/30 hover:text-navy">
            <Plus className="h-4 w-4" /> Add activity
          </button>
        </div>

        <footer className="space-y-1 border-t border-line px-3 py-3 sm:px-5">
          {day.transport_notes && (
            <p className="flex items-start gap-2 px-3 py-1 text-sm text-muted">
              <Train className="mt-0.5 h-4 w-4 shrink-0" /> {day.transport_notes}
            </p>
          )}
          <DayNotes day={day} />
        </footer>
      </div>
      {adding && <ActivityEditor open onClose={() => setAdding(false)} day={day} />}
      <RegenerateDialog
        open={regen}
        onClose={() => setRegen(false)}
        title={`Regenerate Day ${day.day_number}`}
        description="TripPilot re-plans this day. Activities you added, edited or completed are kept."
        onSubmit={(text) => {
          setRegen(false);
          void regenerateDay(day.id, text);
        }}
      />
    </section>
  );
}

export function ItineraryTab({ onNavigate }: { onNavigate: (t: TabId) => void }) {
  const { bundle, generateItinerary, busy, focusActivity } = useTrip();
  const [confirmRegen, setConfirmRegen] = useState(false);
  const isDemo = bundle.trip.itinerary_source === "demo";

  const showOnMap = (id: string) => {
    focusActivity(id);
    onNavigate("map");
  };

  if (busy.generating && !bundle.days.length) return <GeneratingState />;

  if (!bundle.days.length) {
    return (
      <EmptyState
        icon={<Wand2 className="h-6 w-6" />}
        title="Let’s build your itinerary"
        description="TripPilot will plan each day around your destinations, dates, budget, pace and preferences."
        action={
          <Button variant="gold" size="lg" onClick={() => void generateItinerary()} icon={<Sparkles className="h-5 w-5" />}>
            Generate itinerary
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-36 lg:self-start">
        <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0" aria-label="Jump to day">
          {bundle.days.map((d) => (
            <a key={d.id} href={`#day-${d.day_number}`} className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-line bg-white px-3 py-2 text-sm transition hover:border-navy/30 lg:shrink">
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: dayColor(d.day_number) }}>{d.day_number}</span>
              <span className="min-w-0">
                <span className="block font-semibold">{formatDate(d.date, { weekday: "short", month: "short", day: "numeric" })}</span>
                <span className="hidden truncate text-xs text-muted lg:block">{d.city}</span>
              </span>
            </a>
          ))}
        </nav>
        <div className="mt-4 hidden space-y-2 lg:block">
          <Button variant="secondary" size="sm" className="w-full" loading={busy.generating} onClick={() => setConfirmRegen(true)} icon={<Wand2 className="h-4 w-4" />}>
            Regenerate all
          </Button>
        </div>
      </aside>

      <div className="min-w-0 space-y-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white/70 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-pilot" />
            {isDemo
              ? "Demo itinerary: sample suggestions, not generated by live AI."
              : "AI suggestions: costs are estimates, and nothing is booked. Check opening hours and availability before you go."}
          </p>
          <Button variant="secondary" size="sm" className="lg:hidden" loading={busy.generating} onClick={() => setConfirmRegen(true)} icon={<Wand2 className="h-4 w-4" />}>
            Regenerate all
          </Button>
        </div>
        {busy.generating && <GeneratingState />}
        {bundle.days.map((d) => (
          <DayCard key={d.id} day={d} onShowOnMap={showOnMap} />
        ))}
      </div>

      <ConfirmDialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        title="Regenerate the whole itinerary?"
        message="TripPilot will re-plan every day. Activities you added, edited or marked complete are kept; other suggestions are replaced."
        confirmLabel="Regenerate"
        onConfirm={() => {
          setConfirmRegen(false);
          void generateItinerary();
        }}
      />
    </div>
  );
}
