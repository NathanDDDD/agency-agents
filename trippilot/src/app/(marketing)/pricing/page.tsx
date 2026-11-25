import type { Metadata } from "next";
import { CTA, FAQ, Pricing } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Pricing",
  description: "TripPilot is free during early access. Explorer, Pilot and Crew plans coming soon.",
};

export default function PricingPage() {
  return (
    <>
      <Pricing />
      <FAQ />
      <CTA />
    </>
  );
}
