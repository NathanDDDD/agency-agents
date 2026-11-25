"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ChipGroup, Field, Input, Textarea } from "@/components/ui/field";
import {
  ACCOMMODATIONS,
  ACTIVITY_OPTIONS,
  BUDGET_RANGES,
  FOOD_OPTIONS,
  PACES,
  PARTIES,
  TRAVEL_STYLES,
} from "@/lib/options";
import type { TravelPreferences } from "@/lib/types";

const toOpts = (list: string[]) => list.map((v) => ({ value: v, label: v }));

export type PreferenceSection = "style" | "budget" | "food" | "activities" | "pace" | "places";

export function PreferenceFields({
  value,
  onChange,
  sections = ["style", "budget", "food", "activities", "pace", "places"],
}: {
  value: TravelPreferences;
  onChange: (v: TravelPreferences) => void;
  sections?: PreferenceSection[];
}) {
  const set = <K extends keyof TravelPreferences>(k: K, v: TravelPreferences[K]) => onChange({ ...value, [k]: v });
  const [dest, setDest] = useState("");
  const show = (s: PreferenceSection) => sections.includes(s);

  return (
    <div className="space-y-7">
      {show("style") && (
        <>
          <Field label="Travel style">
            <ChipGroup label="Travel style" options={TRAVEL_STYLES} value={value.travel_style} onChange={(v) => set("travel_style", v as TravelPreferences["travel_style"])} />
          </Field>
          <Field label="Who do you usually travel with?">
            <ChipGroup label="Travel party" options={PARTIES} value={value.travel_party} onChange={(v) => set("travel_party", v as TravelPreferences["travel_party"])} />
          </Field>
        </>
      )}
      {show("budget") && (
        <>
          <Field label="Typical trip budget (excluding flights)">
            <ChipGroup label="Budget range" options={BUDGET_RANGES} value={value.budget_range} onChange={(v) => set("budget_range", v as TravelPreferences["budget_range"])} />
          </Field>
          <Field label="Where do you like to stay?">
            <ChipGroup label="Accommodation" options={ACCOMMODATIONS} value={value.accommodation} onChange={(v) => set("accommodation", v as TravelPreferences["accommodation"])} />
          </Field>
        </>
      )}
      {show("food") && (
        <Field label="Food preferences" hint="Pick any that apply, including dietary needs.">
          <ChipGroup label="Food preferences" multiple options={toOpts(FOOD_OPTIONS)} value={value.food_preferences} onChange={(v) => set("food_preferences", v as string[])} />
        </Field>
      )}
      {show("activities") && (
        <Field label="What do you love doing?">
          <ChipGroup label="Activities" multiple options={toOpts(ACTIVITY_OPTIONS)} value={value.activities} onChange={(v) => set("activities", v as string[])} />
        </Field>
      )}
      {show("pace") && (
        <Field label="Pace of travel">
          <div className="grid gap-2 sm:grid-cols-3">
            {PACES.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={value.pace === p.value}
                onClick={() => set("pace", p.value)}
                className={`rounded-2xl border p-4 text-left transition ${value.pace === p.value ? "border-navy bg-navy text-ivory" : "border-line bg-white hover:border-navy/30"}`}
              >
                <span className="block font-semibold">{p.label}</span>
                <span className={`mt-1 block text-xs ${value.pace === p.value ? "text-ivory/70" : "text-muted"}`}>{p.hint}</span>
              </button>
            ))}
          </div>
        </Field>
      )}
      {show("places") && (
        <>
          <Field label="Dream destinations" hint="Press Enter to add. We'll use these for inspiration.">
            <div className="space-y-2">
              <Input
                value={dest}
                placeholder="e.g. Japan, Amalfi Coast, Patagonia"
                onChange={(e) => setDest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && dest.trim()) {
                    e.preventDefault();
                    if (!value.preferred_destinations.includes(dest.trim()))
                      set("preferred_destinations", [...value.preferred_destinations, dest.trim()]);
                    setDest("");
                  }
                }}
              />
              {value.preferred_destinations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {value.preferred_destinations.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 rounded-full bg-pilot-50 py-1 pl-3 pr-1.5 text-sm font-medium text-pilot-600">
                      {d}
                      <button
                        type="button"
                        aria-label={`Remove ${d}`}
                        className="rounded-full p-0.5 hover:bg-pilot/10"
                        onClick={() => set("preferred_destinations", value.preferred_destinations.filter((x) => x !== d))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Field>
          <Field label="Accessibility requirements (optional)" htmlFor="a11y" hint="E.g. step-free access, limited walking, sensory needs.">
            <Textarea id="a11y" rows={3} value={value.accessibility_needs} onChange={(e) => set("accessibility_needs", e.target.value)} />
          </Field>
        </>
      )}
    </div>
  );
}
