"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PreferenceFields, type PreferenceSection } from "@/components/forms/preferences-form";
import { SafeImage } from "@/components/ui/safe-image";
import { useData } from "@/lib/data/provider";
import { DEFAULT_PREFERENCES } from "@/lib/options";
import { PHOTOS } from "@/lib/images";
import { preferencesSchema } from "@/lib/schemas";
import type { TravelPreferences } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS: { title: string; body: string; sections: PreferenceSection[] }[] = [
  { title: "How do you like to travel?", body: "This shapes every plan TripPilot makes for you.", sections: ["style"] },
  { title: "Budget & stays", body: "We’ll recommend places that fit how you like to spend.", sections: ["budget"] },
  { title: "Food & favourite things", body: "Restaurants and activities are picked around these.", sections: ["food", "activities"] },
  { title: "Pace & places", body: "How full should your days be, and where do you dream of going?", sections: ["pace", "places"] },
];

export default function OnboardingPage() {
  const { repo, profile, preferences, setPreferences, refreshProfile } = useData();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.full_name ?? "");
  const [prefs, setPrefs] = useState<TravelPreferences>(preferences ?? DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const last = step === STEPS.length - 1;

  async function finish() {
    const parsed = preferencesSchema.safeParse(prefs);
    if (!parsed.success) {
      toast.error("Please check your preferences");
      return;
    }
    setSaving(true);
    try {
      await repo.savePreferences(parsed.data);
      await repo.updateProfile({ onboarded: true, full_name: name.trim() || profile.full_name });
      setPreferences(parsed.data);
      await refreshProfile();
      toast.success("Preferences saved");
      router.replace("/app/trips/new?welcome=1");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save preferences");
      setSaving(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_420px]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo href="/app" />
          <button className="text-sm font-semibold text-muted hover:text-navy" onClick={finish} disabled={saving}>
            Skip for now
          </button>
        </div>
        <div className="mx-auto w-full max-w-2xl flex-1 py-10">
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <span key={i} className={cn("h-1.5 flex-1 rounded-full transition", i <= step ? "bg-navy" : "bg-ivory-300")} />
            ))}
          </div>
          <p className="mt-6 text-sm font-semibold text-pilot">Step {step + 1} of {STEPS.length}</p>
          <h1 className="mt-1 font-display text-4xl">{STEPS[step].title}</h1>
          <p className="mt-2 text-muted">{STEPS[step].body}</p>
          <div className="mt-8 animate-fade-up" key={step}>
            {step === 0 && (
              <Field label="What should we call you?" htmlFor="name" className="mb-7">
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" />
              </Field>
            )}
            <PreferenceFields value={prefs} onChange={setPrefs} sections={STEPS[step].sections} />
          </div>
          <div className="mt-10 flex justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0} icon={<ArrowLeft className="h-4 w-4" />}>
              Back
            </Button>
            {last ? (
              <Button onClick={finish} loading={saving} variant="gold">
                Finish & plan a trip
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="relative hidden lg:block">
        <SafeImage src={PHOTOS.kyoto} alt="Kyoto temple" seed="onboarding" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/70 to-transparent" />
        <p className="absolute bottom-10 left-8 right-8 font-display text-2xl text-ivory">
          Tell us once. Every trip after this feels like it was planned by a friend who knows you.
        </p>
      </div>
    </div>
  );
}
