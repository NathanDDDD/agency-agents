"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { activityFormSchema, type ActivityFormInput, type ActivityFormValues } from "@/lib/schemas";
import { CATEGORY_META } from "@/lib/options";
import type { Activity, ItineraryDay } from "@/lib/types";
import { slotForTime } from "@/lib/utils";
import { lookupLocation } from "@/lib/hooks/geocode-client";
import { useTrip } from "./trip-context";

export function ActivityEditor({
  open,
  onClose,
  day,
  activity,
}: {
  open: boolean;
  onClose: () => void;
  day: ItineraryDay;
  activity?: Activity;
}) {
  const { bundle, addActivity, updateActivity, moveActivity } = useTrip();
  const [targetDay, setTargetDay] = useState(day.id);
  const { register, handleSubmit, formState, watch, setValue } = useForm<ActivityFormInput, unknown, ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      name: activity?.name ?? "",
      description: activity?.description ?? "",
      category: activity?.category ?? "sightseeing",
      is_restaurant: activity?.is_restaurant ?? false,
      slot: activity?.slot ?? "afternoon",
      suggested_time: activity?.suggested_time ?? "",
      duration_minutes: activity?.duration_minutes ?? 60,
      estimated_cost: activity?.estimated_cost ?? 0,
      address: activity?.address ?? "",
      booking_url: activity?.booking_url ?? "",
      notes: activity?.notes ?? "",
    },
  });
  const errors = formState.errors;
  const category = watch("category");

  const submit = handleSubmit(async (v) => {
    const data = {
      name: v.name,
      description: v.description,
      category: v.category,
      is_restaurant: v.is_restaurant || v.category === "restaurant",
      slot: v.suggested_time ? slotForTime(v.suggested_time) : v.slot,
      suggested_time: v.suggested_time || null,
      duration_minutes: v.duration_minutes || null,
      estimated_cost: v.estimated_cost ?? null,
      address: v.address || null,
      booking_url: v.booking_url || null,
      notes: v.notes,
      latitude: activity?.latitude ?? null,
      longitude: activity?.longitude ?? null,
    };
    // Look up coordinates when the address is new or changed so the stop appears on the map.
    const address = (v.address ?? "").trim();
    const addressChanged = (activity?.address ?? "").trim() !== address;
    const needsLookup = address.length > 1 && (addressChanged || data.latitude === null);
    if (addressChanged) {
      // Old coordinates belonged to the old address; never keep them.
      data.latitude = null;
      data.longitude = null;
    }
    if (needsLookup) {
      try {
        const found = await lookupLocation(address, day.city);
        if (found) {
          data.latitude = found.latitude;
          data.longitude = found.longitude;
        } else {
          toast("We couldn't find that address on the map. The activity is saved without a pin.");
        }
      } catch {
        toast("Location lookup is unavailable, so the activity is saved without a map pin.");
      }
    }
    if (activity) {
      await updateActivity(activity.id, data);
      if (targetDay !== day.id) {
        const dest = bundle.days.find((d) => d.id === targetDay);
        await moveActivity(activity.id, targetDay, dest?.activities.length ?? 0);
      }
    } else {
      await addActivity(day.id, data);
    }
    onClose();
  }, () => toast.error("Please check the highlighted fields"));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={activity ? "Edit activity" : `Add to Day ${day.day_number}`}
      description={activity ? "Edited activities are kept when the AI re-plans this day." : undefined}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={formState.isSubmitting}>{activity ? "Save changes" : "Add activity"}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Name" htmlFor="a-name" error={errors.name?.message} className="sm:col-span-2">
          <Input id="a-name" aria-invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field label="Category" htmlFor="a-cat">
          <Select
            id="a-cat"
            {...register("category", {
              onChange: (e) => setValue("is_restaurant", e.target.value === "restaurant" || e.target.value === "food"),
            })}
          >
            {Object.entries(CATEGORY_META).map(([k, m]) => (
              <option key={k} value={k}>{m.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Time" htmlFor="a-time" hint="Leave empty to place by part of day.">
          <Input id="a-time" type="time" {...register("suggested_time")} />
        </Field>
        <Field label="Part of day" htmlFor="a-slot">
          <Select id="a-slot" {...register("slot")}>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </Select>
        </Field>
        <Field label="Duration (minutes)" htmlFor="a-dur" error={errors.duration_minutes?.message}>
          <Input id="a-dur" type="number" min={0} step={15} {...register("duration_minutes")} />
        </Field>
        <Field label={`Estimated cost (${bundle.trip.currency})`} htmlFor="a-cost" error={errors.estimated_cost?.message}>
          <Input id="a-cost" type="number" min={0} step={5} {...register("estimated_cost")} />
        </Field>
        <Field label="Address" htmlFor="a-addr">
          <Input id="a-addr" {...register("address")} />
        </Field>
        <Field label="Booking or website URL" htmlFor="a-url" error={errors.booking_url?.message} className="sm:col-span-2">
          <Input id="a-url" type="url" placeholder="https://" {...register("booking_url")} />
        </Field>
        <Field label="Description" htmlFor="a-desc" className="sm:col-span-2">
          <Textarea id="a-desc" rows={2} {...register("description")} />
        </Field>
        <Field label="Notes" htmlFor="a-notes" className="sm:col-span-2">
          <Textarea id="a-notes" rows={2} {...register("notes")} />
        </Field>
        {activity && (
          <Field label="Day" htmlFor="a-day" className="sm:col-span-2">
            <Select id="a-day" value={targetDay} onChange={(e) => setTargetDay(e.target.value)}>
              {bundle.days.map((d) => (
                <option key={d.id} value={d.id}>Day {d.day_number}: {d.title}</option>
              ))}
            </Select>
          </Field>
        )}
        {category === "restaurant" && <p className="text-xs text-muted sm:col-span-2">Restaurants are shown with a gold marker.</p>}
      </form>
    </Modal>
  );
}

const QUICK = ["More relaxed", "Something outdoors", "Cheaper options", "More food-focused", "Better for rainy weather", "More romantic"];

export function RegenerateDialog({
  open,
  onClose,
  title,
  description,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onSubmit: (instructions: string) => void;
  loading?: boolean;
}) {
  const [text, setText] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="gold"
            loading={loading}
            onClick={() => {
              onSubmit(text.trim());
              setText("");
            }}
          >
            Regenerate
          </Button>
        </>
      }
    >
      <Field label="Anything specific? (optional)" htmlFor="regen">
        <Textarea id="regen" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Swap the museum for something outdoors and keep lunch." />
      </Field>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button key={q} type="button" onClick={() => setText((t) => (t ? `${t}. ${q}` : q))} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-navy/30">
            {q}
          </button>
        ))}
      </div>
    </Modal>
  );
}
