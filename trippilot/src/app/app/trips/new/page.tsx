"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { TripForm } from "@/components/forms/trip-form";
import { useData } from "@/lib/data/provider";
import type { TripFormInput } from "@/lib/schemas";
import { photoForDestination } from "@/lib/images";
import { addDays, todayString } from "@/lib/utils";
import { PageLoader } from "@/components/ui/spinner";

export default function NewTripPage() {
  const { repo, preferences, profile } = useData();
  const router = useRouter();
  const [defaults, setDefaults] = useState<TripFormInput | null>(null);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idea = params.get("idea");
    const start = addDays(todayString(), 30);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads URL once on mount
    setWelcome(params.get("welcome") === "1");
    setDefaults({
      name: "",
      destinations: "",
      start_date: start,
      end_date: addDays(start, 5),
      travelers: preferences?.travel_party === "solo" ? 1 : 2,
      travel_party: preferences?.travel_party ?? "couple",
      budget: 3000,
      currency: profile.home_currency || "USD",
      budget_excludes_flights: true,
      pace: preferences?.pace ?? "balanced",
      interests: [...(preferences?.activities ?? [])].slice(0, 4),
      description: idea ? `Plan a trip: ${idea}.` : "",
      special_requests: "",
    });
  }, [preferences, profile.home_currency]);

  if (!defaults) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm font-semibold text-pilot">{welcome ? "You're all set" : "New trip"}</p>
      <h1 className="font-display text-4xl">{welcome ? "Let’s plan your first trip" : "Where to next?"}</h1>
      <p className="mt-2 text-muted">
        TripPilot will build a day-by-day itinerary using these details{preferences ? " and your travel preferences" : ""}.
      </p>
      <div className="mt-8">
        <TripForm
          defaultValues={defaults}
          submitLabel="Create trip & plan itinerary"
          submitIcon={<Sparkles className="h-5 w-5" />}
          onSubmit={async (v) => {
            const destinations = v.destinations
              .split(",")
              .map((d) => d.trim())
              .filter(Boolean);
            try {
              const trip = await repo.createTrip({
                name: v.name,
                destinations,
                start_date: v.start_date,
                end_date: v.end_date,
                travelers: v.travelers,
                travel_party: v.travel_party,
                budget: v.budget,
                currency: v.currency,
                budget_excludes_flights: v.budget_excludes_flights,
                pace: v.pace,
                interests: v.interests,
                description: v.description,
                special_requests: v.special_requests,
                cover_image: photoForDestination(destinations),
                itinerary_source: "manual",
              });
              router.push(`/app/trips/${trip.id}?tab=itinerary&generate=1`);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not create trip");
            }
          }}
        />
      </div>
    </div>
  );
}
