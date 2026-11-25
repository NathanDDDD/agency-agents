"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChipGroup, Field, Input, Select, Textarea, Toggle } from "@/components/ui/field";
import { tripFormSchema, type TripFormInput, type TripFormValues } from "@/lib/schemas";
import { ACTIVITY_OPTIONS, FOOD_OPTIONS, PACES, PARTIES } from "@/lib/options";
import { parseTripPrompt } from "@/lib/parse-prompt";
import { addDays, CURRENCIES } from "@/lib/utils";

const INTEREST_OPTIONS = [...new Set([...ACTIVITY_OPTIONS, "Fine dining", "Local cuisine", "Wine bars"])].map((v) => ({
  value: v,
  label: v,
}));

export function TripForm({
  defaultValues,
  onSubmit,
  submitLabel,
  showPrompt = true,
  submitIcon,
}: {
  defaultValues: TripFormInput;
  onSubmit: (values: TripFormValues) => Promise<void>;
  submitLabel: string;
  showPrompt?: boolean;
  submitIcon?: React.ReactNode;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);
  const form = useForm<TripFormInput, unknown, TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues,
  });
  const { register, control, handleSubmit, formState, setValue, getValues, watch } = form;
  const errors = formState.errors;
  const description = watch("description");

  function applyPrompt() {
    const p = parseTripPrompt(getValues("description") ?? "");
    const filled: string[] = [];
    if (p.destinations?.length) {
      setValue("destinations", p.destinations.join(", "));
      filled.push("destinations");
    }
    if (p.name && !getValues("name")) setValue("name", p.name);
    if (p.days) {
      setValue("end_date", addDays(getValues("start_date"), p.days - 1));
      filled.push(`${p.days} days`);
    }
    if (p.budget) {
      setValue("budget", p.budget);
      filled.push("budget");
    }
    if (p.currency) setValue("currency", p.currency);
    if (p.excludesFlights !== undefined) setValue("budget_excludes_flights", p.excludesFlights);
    if (p.party) {
      setValue("travel_party", p.party);
      filled.push(p.party);
    }
    if (p.travelers) setValue("travelers", p.travelers);
    if (p.pace) {
      setValue("pace", p.pace);
      filled.push(`${p.pace} pace`);
    }
    if (p.interests.length) {
      setValue("interests", [...new Set([...(getValues("interests") ?? []), ...p.interests])]);
      filled.push("interests");
    }
    setApplied(filled.length ? `Filled in ${filled.join(", ")}. Review below.` : "Couldn't pick out details. Fill in the form below.");
  }

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      {showPrompt && (
        <section className="rounded-[var(--radius-card)] bg-navy p-5 text-ivory sm:p-6">
          <label htmlFor="description" className="font-display text-2xl">
            Describe your trip
          </label>
          <p className="mt-1 text-sm text-ivory/70">Write it like you’d tell a friend. We’ll pick out the details, and the AI reads every word.</p>
          <Textarea
            id="description"
            rows={4}
            className="mt-4 border-white/10 bg-white/95"
            placeholder="Plan a 6 day romantic trip to Rome and Florence. We love restaurants, historical attractions, luxury experiences and nightlife. We don't want to rush. Budget is $4,000 excluding flights."
            {...register("description")}
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gold" aria-live="polite">{applied}</p>
            <Button type="button" variant="gold" size="sm" onClick={applyPrompt} disabled={!description?.trim()} icon={<Wand2 className="h-4 w-4" />}>
              Fill in the details
            </Button>
          </div>
        </section>
      )}

      <section className="card space-y-5 p-5 sm:p-6">
        <h2 className="text-lg font-bold">The basics</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Trip name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" placeholder="Roman Holiday" aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="Destination(s)" htmlFor="destinations" error={errors.destinations?.message} hint="Separate multiple places with commas.">
            <Input id="destinations" placeholder="Rome, Florence" aria-invalid={!!errors.destinations} {...register("destinations")} />
          </Field>
          <Field label="Departure date" htmlFor="start_date" error={errors.start_date?.message}>
            <Input id="start_date" type="date" aria-invalid={!!errors.start_date} {...register("start_date")} />
          </Field>
          <Field label="Return date" htmlFor="end_date" error={errors.end_date?.message}>
            <Input id="end_date" type="date" aria-invalid={!!errors.end_date} {...register("end_date")} />
          </Field>
          <Field label="Number of travelers" htmlFor="travelers" error={errors.travelers?.message}>
            <Input id="travelers" type="number" min={1} max={30} inputMode="numeric" {...register("travelers")} />
          </Field>
          <Field label="Travel party" htmlFor="travel_party">
            <Select id="travel_party" {...register("travel_party")}>
              {PARTIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section className="card space-y-5 p-5 sm:p-6">
        <h2 className="text-lg font-bold">Budget</h2>
        <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
          <Field label="Total budget" htmlFor="budget" error={errors.budget?.message}>
            <Input id="budget" type="number" min={0} step={50} inputMode="decimal" {...register("budget")} />
          </Field>
          <Field label="Currency" htmlFor="currency">
            <Select id="currency" {...register("currency")}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Controller
          control={control}
          name="budget_excludes_flights"
          render={({ field }) => (
            <Toggle checked={!!field.value} onChange={field.onChange} label="Budget excludes flights" description="Turn off if flights come out of this budget." />
          )}
        />
      </section>

      <section className="card space-y-6 p-5 sm:p-6">
        <h2 className="text-lg font-bold">Style</h2>
        <Field label="Pace">
          <Controller
            control={control}
            name="pace"
            render={({ field }) => <ChipGroup label="Pace" options={PACES} value={field.value} onChange={field.onChange} />}
          />
        </Field>
        <Field label="Interests for this trip">
          <Controller
            control={control}
            name="interests"
            render={({ field }) => (
              <ChipGroup label="Interests" multiple options={INTEREST_OPTIONS} value={field.value ?? []} onChange={field.onChange} />
            )}
          />
        </Field>
        <Field label="Special requests" htmlFor="special_requests" hint={`E.g. "One splurge dinner", "Step-free access", "${FOOD_OPTIONS[5]} only".`}>
          <Textarea id="special_requests" rows={3} {...register("special_requests")} />
        </Field>
        {!showPrompt && (
          <Field label="Trip description" htmlFor="description">
            <Textarea id="description" rows={4} {...register("description")} />
          </Field>
        )}
      </section>

      <div className="sticky bottom-20 z-10 flex justify-end md:bottom-4">
        <Button type="submit" size="lg" loading={submitting} icon={submitIcon} className="shadow-lift">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
