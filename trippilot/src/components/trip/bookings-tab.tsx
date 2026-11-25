"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  BedDouble,
  Car,
  Copy,
  ExternalLink,
  FileText,
  MapPin,
  Paperclip,
  Pencil,
  Plane,
  Plus,
  Ticket,
  Train,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { useTrip } from "./trip-context";
import { useData } from "@/lib/data/provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { bookingFormSchema, type BookingFormInput, type BookingFormValues } from "@/lib/schemas";
import { BOOKING_TYPES } from "@/lib/options";
import type { Booking, BookingDocument, BookingType } from "@/lib/types";
import { formatDate, formatMoney, formatTime, nowIso, uid } from "@/lib/utils";

const ICONS: Record<BookingType, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: BedDouble,
  restaurant: Utensils,
  activity: Ticket,
  transport: Train,
  car_rental: Car,
  other: FileText,
};

function BookingEditor({ booking, onClose }: { booking?: Booking; onClose: () => void }) {
  const { bundle, saveBooking } = useTrip();
  const { repo } = useData();
  const [docs, setDocs] = useState<BookingDocument[]>(booking?.documents ?? []);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [bookingId] = useState(() => booking?.id ?? uid());
  const { register, handleSubmit, formState } = useForm<BookingFormInput, unknown, BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      type: booking?.type ?? "hotel",
      name: booking?.name ?? "",
      confirmation_number: booking?.confirmation_number ?? "",
      date: booking?.date ?? bundle.trip.start_date,
      time: booking?.time ?? "",
      end_date: booking?.end_date ?? "",
      address: booking?.address ?? "",
      booking_url: booking?.booking_url ?? "",
      cost: booking?.cost ?? 0,
      notes: booking?.notes ?? "",
    },
  });
  const errors = formState.errors;

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const doc = await repo.uploadDocument(bundle.trip.id, bookingId, f);
        setDocs((d) => [...d, doc]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const submit = handleSubmit(async (v) => {
    const ts = nowIso();
    try {
      await saveBooking({
        id: bookingId,
        trip_id: bundle.trip.id,
        type: v.type,
        name: v.name,
        confirmation_number: v.confirmation_number,
        date: v.date || null,
        time: v.time || null,
        end_date: v.end_date || null,
        address: v.address,
        booking_url: v.booking_url,
        cost: v.cost || null,
        notes: v.notes,
        documents: docs,
        created_at: booking?.created_at ?? ts,
        updated_at: ts,
      });
      onClose();
    } catch {
      // toast already shown
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={booking ? "Edit booking" : "Add booking"}
      description="Store confirmations here. TripPilot doesn't make or verify bookings."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={formState.isSubmitting} disabled={uploading}>Save booking</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Type" htmlFor="b-type">
          <Select id="b-type" {...register("type")}>
            {BOOKING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
        <Field label="Name" htmlFor="b-name" error={errors.name?.message}>
          <Input id="b-name" placeholder="e.g. Hotel de Russie" aria-invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field label="Confirmation number" htmlFor="b-conf">
          <Input id="b-conf" className="font-mono" {...register("confirmation_number")} />
        </Field>
        <Field label={`Cost (${bundle.trip.currency})`} htmlFor="b-cost" error={errors.cost?.message}>
          <Input id="b-cost" type="number" min={0} step={1} {...register("cost")} />
        </Field>
        <Field label="Date" htmlFor="b-date">
          <Input id="b-date" type="date" {...register("date")} />
        </Field>
        <Field label="Time" htmlFor="b-time">
          <Input id="b-time" type="time" {...register("time")} />
        </Field>
        <Field label="End date (optional)" htmlFor="b-end" hint="Check-out or return date.">
          <Input id="b-end" type="date" {...register("end_date")} />
        </Field>
        <Field label="Address" htmlFor="b-addr">
          <Input id="b-addr" {...register("address")} />
        </Field>
        <Field label="Booking URL" htmlFor="b-url" error={errors.booking_url?.message} className="sm:col-span-2">
          <Input id="b-url" type="url" placeholder="https://" {...register("booking_url")} />
        </Field>
        <Field label="Notes" htmlFor="b-notes" className="sm:col-span-2">
          <Textarea id="b-notes" rows={2} {...register("notes")} />
        </Field>
        <div className="sm:col-span-2">
          <p className="text-sm font-semibold">Documents</p>
          <ul className="mt-2 space-y-1.5">
            {docs.map((d) => (
              <li key={d.path} className="flex items-center justify-between gap-2 rounded-xl bg-ivory-200/60 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2"><Paperclip className="h-4 w-4 shrink-0" /> <span className="truncate">{d.name}</span></span>
                <button type="button" onClick={() => setDocs((x) => x.filter((y) => y.path !== d.path))} className="rounded-full p-1 hover:bg-white" aria-label={`Remove ${d.name}`}>
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <input ref={fileRef} type="file" multiple accept=".pdf,image/*,.txt,.eml" className="hidden" onChange={(e) => void onFiles(e.target.files)} />
          <Button type="button" variant="secondary" size="sm" className="mt-2" loading={uploading} onClick={() => fileRef.current?.click()} icon={<Paperclip className="h-4 w-4" />}>
            Attach file
          </Button>
          <p className="mt-1 text-xs text-muted">{repo.mode === "demo" ? "Demo mode stores files in this browser (max 1.5 MB each)." : "PDFs or images, up to 10 MB. Stored privately."}</p>
        </div>
      </form>
    </Modal>
  );
}

export function BookingsTab() {
  const { bundle, deleteBooking } = useTrip();
  const { repo } = useData();
  const [editing, setEditing] = useState<Booking | "new" | null>(null);
  const [deleting, setDeleting] = useState<Booking | null>(null);
  const sorted = [...bundle.bookings].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || (a.time ?? "").localeCompare(b.time ?? ""));
  const total = bundle.bookings.reduce((s, b) => s + (b.cost ?? 0), 0);

  async function openDoc(doc: BookingDocument) {
    try {
      const url = await repo.getDocumentUrl(doc);
      if (url.startsWith("data:")) {
        const w = window.open();
        if (w) w.document.write(`<iframe src="${url}" style="border:0;width:100%;height:100%" title="${doc.name.replace(/"/g, "")}"></iframe>`);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open document");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-2xl">Travel wallet</h2>
          <p className="text-sm text-muted">{bundle.bookings.length} bookings{total ? ` · ${formatMoney(total, bundle.trip.currency)} total` : ""}</p>
        </div>
        <Button onClick={() => setEditing("new")} icon={<Plus className="h-4 w-4" />}>Add booking</Button>
      </div>

      {sorted.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {sorted.map((b) => {
            const Icon = ICONS[b.type];
            return (
              <li key={b.id} className="card flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy text-gold">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">{BOOKING_TYPES.find((t) => t.value === b.type)?.label}</p>
                    <p className="truncate font-semibold">{b.name}</p>
                    <p className="text-sm text-muted">
                      {b.date ? formatDate(b.date, { weekday: "short", month: "short", day: "numeric" }) : "No date"}
                      {b.time ? ` · ${formatTime(b.time)}` : ""}
                      {b.end_date ? ` → ${formatDate(b.end_date)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <button onClick={() => setEditing(b)} className="rounded-full p-2 text-muted hover:bg-ivory-200" aria-label={`Edit ${b.name}`}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setDeleting(b)} className="rounded-full p-2 text-muted hover:bg-danger/5 hover:text-danger" aria-label={`Delete ${b.name}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {b.confirmation_number && (
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(b.confirmation_number);
                      toast.success("Confirmation number copied");
                    }}
                    className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-ivory-300 px-3 py-2 text-left transition hover:border-navy/30"
                  >
                    <span>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">Confirmation</span>
                      <span className="font-mono text-sm font-semibold">{b.confirmation_number}</span>
                    </span>
                    <Copy className="h-4 w-4 text-muted" />
                  </button>
                )}
                <div className="mt-3 space-y-1 text-sm text-muted">
                  {b.address && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /> {b.address}</p>}
                  {b.notes && <p>{b.notes}</p>}
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-sm">
                  {b.cost ? <span className="font-semibold">{formatMoney(b.cost, bundle.trip.currency)}</span> : null}
                  {b.booking_url && (
                    <a href={b.booking_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-pilot">
                      Manage <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {b.documents.map((d) => (
                    <button key={d.path} onClick={() => void openDoc(d)} className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-ivory-200 px-2.5 py-1 text-xs font-semibold">
                      <Paperclip className="h-3 w-3" /> {d.name}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<Ticket className="h-6 w-6" />}
          title="Your travel wallet is empty"
          description="Add flights, hotels, restaurant reservations and tickets so everything is in one place."
          action={<Button onClick={() => setEditing("new")} icon={<Plus className="h-4 w-4" />}>Add your first booking</Button>}
        />
      )}

      {editing && <BookingEditor booking={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete booking?"
        message={`“${deleting?.name}” and its attached documents will be removed from this trip.`}
        onConfirm={() => {
          if (deleting) void deleteBooking(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
