import {
  ArrowRight,
  CalendarRange,
  Check,
  CloudSun,
  Compass,
  MessageCircle,
  PiggyBank,
  Sparkles,
  Ticket,
  Wand2,
} from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { PHOTOS } from "@/lib/images";
import { ItineraryPreview } from "./itinerary-preview";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <SafeImage src={PHOTOS.heroCoast} alt="Alpine lake at sunrise" priority seed="hero" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/70 via-navy/45 to-ivory" />
      </div>
      <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:px-8 lg:pb-28">
        <div className="animate-fade-up text-ivory">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-gold" /> Your personal AI travel agent
          </span>
          <h1 className="mt-5 font-display text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-[4.2rem]">
            Explore freely.
            <br />
            <span className="text-gold">Plan intelligently.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ivory/85">
            Describe the trip you dream about. TripPilot builds a day-by-day plan, maps it, tracks your budget and bookings,
            and stays with you as a concierge who actually knows your trip.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/signup" variant="gold" size="lg" icon={<Wand2 className="h-5 w-5" />}>
              Plan my trip
            </LinkButton>
            <a
              href="/demo"
              className="inline-flex h-13 items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 font-semibold text-ivory backdrop-blur transition hover:bg-white/20"
            >
              Explore the demo <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="mt-8 max-w-xl rounded-2xl border border-white/15 bg-navy/40 p-4 text-sm text-ivory/90 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wider text-gold">Try a prompt like</p>
            <p className="mt-1.5 italic leading-relaxed">
              “Plan 6 days in Italy for a couple. Rome and Florence. Luxury hotels, amazing restaurants, historical places,
              nightlife, but no packed schedule. Budget $4,000 excluding flights.”
            </p>
          </div>
        </div>
        <div className="animate-fade-up [animation-delay:150ms]">
          <ItineraryPreview />
        </div>
      </div>
    </section>
  );
}

export const MODULES = [
  { icon: Wand2, n: "01", title: "AI Trip Planner", body: "Create a complete trip from a sentence: destinations, dates, budget, preferences and travel style." },
  { icon: CalendarRange, n: "02", title: "Smart Itinerary", body: "Day-by-day plans with grouped locations, restaurants, durations and how to get between them. Edit anything." },
  { icon: MessageCircle, n: "03", title: "AI Concierge", body: "Ask anything mid-trip. It knows your schedule, budget and taste, and proposes changes for you to approve." },
  { icon: Ticket, n: "04", title: "Travel Wallet", body: "Flights, hotels, tickets and reservations with confirmation numbers and documents in one place." },
  { icon: PiggyBank, n: "05", title: "Trip Budget", body: "Planned versus actual spend by category, with your remaining balance always in view." },
  { icon: CloudSun, n: "06", title: "Travel Intelligence", body: "Weather, local recommendations and suggestions that adapt to real circumstances. (Rolling out next.)" },
];

export function FeatureGrid({ heading = true }: { heading?: boolean }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
      {heading && (
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-pilot">One companion, the whole journey</p>
          <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Stop juggling ten apps to take one trip.</h2>
          <p className="mt-4 text-lg text-muted">
            Booking sites, maps, notes, screenshots, spreadsheets and group chats, all replaced by one intelligent plan.
          </p>
        </div>
      )}
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <div key={m.n} className="card group p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy text-gold">
                <m.icon className="h-5 w-5" />
              </span>
              <span className="font-display text-2xl text-ivory-300">{m.n}</span>
            </div>
            <h3 className="mt-5 text-lg font-bold">{m.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{m.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export const STEPS = [
  { title: "Tell us how you travel", body: "Set your style, pace, food and activity preferences once. TripPilot remembers them." },
  { title: "Describe your trip", body: "Where, when, who and roughly how much, in your own words. Add any special requests." },
  { title: "Get a real plan", body: "A day-by-day itinerary with restaurants, timings, estimated costs and a map of every stop." },
  { title: "Refine by talking", body: "“Remove the museum on Tuesday. I want something outdoors.” Review the change, approve it, done." },
];

export function HowItWorks() {
  return (
    <section className="bg-navy py-20 text-ivory">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-gold">How it works</p>
          <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">From daydream to day one in minutes.</h2>
          <ol className="mt-10 space-y-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/50 font-display text-gold">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-ivory/70">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <ProductPreview />
      </div>
    </section>
  );
}

/** Realistic UI preview of the concierge + budget (illustrative mock-up). */
export function ProductPreview() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-ivory text-ink shadow-2xl">
        <div className="relative h-40">
          <SafeImage src={PHOTOS.trevi} alt="Trevi Fountain in Rome" seed="trevi" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/80 to-transparent" />
          <div className="absolute bottom-3 left-4 text-ivory">
            <p className="text-xs opacity-80">Day 4 · Rome</p>
            <p className="font-display text-xl">Trastevere tastes</p>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-navy px-3.5 py-2.5 text-sm text-ivory">
            Replace the afternoon activity with something outdoors.
          </div>
          <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-line bg-white px-3.5 py-2.5 text-sm">
            Here’s what I’d change on Day 4: swap the food walk for the <b>Gianicolo Terrace</b>, a short walk with the best view of Rome’s domes.
            <div className="mt-2.5 rounded-xl border border-pilot/30 bg-pilot-50/60 p-2.5">
              <p className="text-xs font-semibold text-pilot-600">Proposed change</p>
              <p className="text-xs text-muted">Replace 1 activity · Day 4 afternoon</p>
              <div className="mt-2 flex gap-2">
                <span className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-ivory">Apply</span>
                <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold">Dismiss</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-8 -left-4 hidden w-56 rounded-2xl border border-line bg-white p-4 text-ink shadow-lift sm:block">
        <p className="text-xs font-semibold text-muted">Budget</p>
        <p className="font-display text-2xl">$2,610 left</p>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-ivory-200">
          <span className="bg-navy-700" style={{ width: "48%" }} />
          <span className="bg-gold" style={{ width: "18%" }} />
          <span className="bg-pilot" style={{ width: "6%" }} />
        </div>
        <p className="mt-1.5 text-[11px] text-muted">of $8,500 · planned + spent</p>
      </div>
    </div>
  );
}

export function Testimonials() {
  const items = [
    { q: "This is where a quote from an early beta traveler will go once we have permission to share it.", who: "Placeholder · Beta traveler" },
    { q: "Placeholder testimonial. We only publish real feedback from real TripPilot users.", who: "Placeholder · Couple, Italy" },
    { q: "Placeholder testimonial reserved for our first group-trip testers.", who: "Placeholder · Friends trip" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-pilot">Travelers</p>
          <h2 className="mt-3 font-display text-4xl">Loved by travelers (soon, we hope).</h2>
        </div>
        <span className="w-fit rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-600">
          Placeholder content: not real testimonials
        </span>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {items.map((t) => (
          <figure key={t.who} className="card border-dashed p-6">
            <blockquote className="font-display text-lg leading-snug text-navy/70">“{t.q}”</blockquote>
            <figcaption className="mt-4 text-sm font-semibold text-muted">{t.who}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export const PLANS = [
  {
    name: "Explorer",
    price: "$0",
    period: "forever",
    blurb: "Everything you need to plan your next trip.",
    features: ["3 active trips", "AI itinerary generation", "Interactive maps", "Bookings & budget tracking", "AI concierge (limited)"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pilot",
    price: "$9",
    period: "per month",
    blurb: "For frequent travelers who want the full co-pilot.",
    features: ["Unlimited trips", "Unlimited regenerations", "Unlimited concierge", "Document storage", "Priority AI", "Weather & travel alerts (soon)"],
    cta: "Join the beta",
    highlight: true,
  },
  {
    name: "Crew",
    price: "$19",
    period: "per month",
    blurb: "Plan together with friends, family or a team.",
    features: ["Everything in Pilot", "Shared trips (soon)", "Group budget splits (soon)", "Up to 6 travelers"],
    cta: "Join the waitlist",
    highlight: false,
  },
];

export function Pricing() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8" id="pricing">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-pilot">Pricing</p>
        <h2 className="mt-3 font-display text-4xl sm:text-5xl">Simple, traveler-friendly pricing.</h2>
        <p className="mt-4 text-muted">
          TripPilot is in early access. All features are free while we’re in beta, and paid plans will launch later.
        </p>
      </div>
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={
              p.highlight
                ? "relative rounded-[var(--radius-card)] bg-navy p-7 text-ivory shadow-lift"
                : "card p-7"
            }
          >
            {p.highlight && (
              <span className="absolute -top-3 left-7 rounded-full bg-gold px-3 py-1 text-xs font-bold text-navy">Most popular</span>
            )}
            <h3 className="text-lg font-bold">{p.name}</h3>
            <p className={p.highlight ? "mt-1 text-sm text-ivory/70" : "mt-1 text-sm text-muted"}>{p.blurb}</p>
            <p className="mt-6">
              <span className="font-display text-5xl">{p.price}</span>
              <span className={p.highlight ? "ml-2 text-sm text-ivory/60" : "ml-2 text-sm text-muted"}>{p.period}</span>
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className={p.highlight ? "h-5 w-5 shrink-0 text-gold" : "h-5 w-5 shrink-0 text-pilot"} />
                  {f}
                </li>
              ))}
            </ul>
            <LinkButton href="/signup" variant={p.highlight ? "gold" : "secondary"} className="mt-8 w-full">
              {p.cta}
            </LinkButton>
          </div>
        ))}
      </div>
    </section>
  );
}

export const FAQS = [
  {
    q: "Is the itinerary really personalised?",
    a: "Yes. TripPilot combines your saved travel preferences with the details of each trip (dates, party, budget, pace, interests and special requests) to plan every day.",
  },
  {
    q: "Are prices and opening hours accurate?",
    a: "AI suggestions include estimated costs only. TripPilot never invents availability, reservations or opening hours, and clearly labels AI suggestions so you know what to verify before you go.",
  },
  {
    q: "Can I change the plan?",
    a: "Completely. Edit, reorder, add or delete activities, regenerate a single day or activity, or ask the concierge in plain language. Your manual edits are preserved when the AI re-plans.",
  },
  {
    q: "Does TripPilot book flights and hotels?",
    a: "Not yet. Today you can store every booking, confirmation number and document in your Travel Wallet. Integrated booking is on our roadmap.",
  },
  {
    q: "Is my data private?",
    a: "Your trips are private to your account and protected by row-level security. You decide what to share.",
  },
  {
    q: "Can I try it without signing up?",
    a: "Yes. Open the demo to explore a fully populated Rome trip, with clearly labelled demo AI responses.",
  },
];

export function FAQ() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-20">
      <h2 className="text-center font-display text-4xl">Questions, answered.</h2>
      <div className="mt-10 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
        {FAQS.map((f) => (
          <details key={f.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {f.q}
              <span className="text-xl text-muted transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function CTA() {
  return (
    <section className="px-5 pb-20 lg:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem]">
        <SafeImage src={PHOTOS.santorini} alt="Santorini at dusk" seed="cta" />
        <div className="absolute inset-0 bg-navy/65" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-ivory">
          <Compass className="h-8 w-8 text-gold" />
          <h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">Your next trip is one sentence away.</h2>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/signup" variant="gold" size="lg">
              Create your free account
            </LinkButton>
            <a href="/demo" className="inline-flex h-13 items-center justify-center rounded-full border border-white/40 px-7 font-semibold hover:bg-white/10">
              Explore the demo
            </a>
          </div>
        </div>
        <div className="h-[420px]" />
      </div>
    </section>
  );
}

export function PageHero({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <section className="mx-auto max-w-4xl px-5 pb-4 pt-16 text-center sm:pt-24">
      <p className="text-sm font-semibold uppercase tracking-wider text-pilot">{eyebrow}</p>
      <h1 className="mt-3 font-display text-5xl leading-tight sm:text-6xl">{title}</h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">{body}</p>
      <div className="mt-8 flex justify-center gap-3">
        <LinkButton href="/signup">Start planning</LinkButton>
        <a href="/demo" className="inline-flex h-11 items-center px-4 text-sm font-semibold text-navy">
          Explore the demo →
        </a>
      </div>
    </section>
  );
}
