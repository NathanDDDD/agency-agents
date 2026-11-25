import type { Metadata } from "next";
import { CTA, FAQ, HowItWorks, PageHero } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "How it works",
  description: "Tell TripPilot how you travel, describe your trip, get a real plan and refine it by talking.",
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="Plan the way you talk."
        body="TripPilot turns a natural-language description into a structured, editable trip, then keeps helping once you’re on the road."
      />
      <div className="h-12" />
      <HowItWorks />
      <FAQ />
      <CTA />
    </>
  );
}
