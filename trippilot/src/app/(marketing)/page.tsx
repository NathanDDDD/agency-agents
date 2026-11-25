import { CTA, FAQ, FeatureGrid, Hero, HowItWorks, Pricing, Testimonials } from "@/components/marketing/sections";
import { SafeImage } from "@/components/ui/safe-image";
import { PHOTOS } from "@/lib/images";

export default function HomePage() {
  return (
    <>
      <Hero />
      <section className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { src: PHOTOS.kyoto, label: "Kyoto" },
            { src: PHOTOS.paris, label: "Paris" },
            { src: PHOTOS.bali, label: "Bali" },
            { src: PHOTOS.newYork, label: "New York" },
          ].map((d) => (
            <div key={d.label} className="group relative h-40 overflow-hidden rounded-2xl sm:h-56">
              <SafeImage src={d.src} alt={d.label} className="transition duration-700 group-hover:scale-105" seed={d.label} />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/70 to-transparent" />
              <span className="absolute bottom-3 left-4 font-display text-xl text-ivory">{d.label}</span>
            </div>
          ))}
        </div>
      </section>
      <FeatureGrid />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTA />
    </>
  );
}
