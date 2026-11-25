import type { Metadata } from "next";
import { CTA, FeatureGrid, PageHero, ProductPreview } from "@/components/marketing/sections";
import { ItineraryPreview } from "@/components/marketing/itinerary-preview";

export const metadata: Metadata = {
  title: "Features",
  description: "AI trip planner, smart itinerary, concierge, travel wallet, budget and travel intelligence in one app.",
};

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Everything your trip needs. Nothing it doesn’t."
        body="Six connected modules that share one understanding of your trip, so every answer and suggestion fits your plan."
      />
      <FeatureGrid heading={false} />
      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <h2 className="font-display text-4xl">An itinerary you can actually use.</h2>
          <p className="mt-4 text-lg text-muted">
            Activities are ordered by time and grouped by neighbourhood. Every stop sits on the map, with estimated durations,
            costs and transport notes. Drag to reorder, mark things done, add notes, or regenerate a single day without losing your edits.
          </p>
        </div>
        <ItineraryPreview />
      </section>
      <section className="bg-navy px-5 py-20 text-ivory lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-display text-4xl">A concierge that knows the plan.</h2>
            <p className="mt-4 text-lg text-ivory/70">
              Ask “What restaurants are near our hotel?” or “Can you make tomorrow less busy?” The concierge reads your itinerary,
              bookings and budget, and proposes changes that you approve before anything is modified.
            </p>
          </div>
          <ProductPreview />
        </div>
      </section>
      <div className="h-20" />
      <CTA />
    </>
  );
}
