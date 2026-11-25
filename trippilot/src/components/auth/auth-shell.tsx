import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { SafeImage } from "@/components/ui/safe-image";
import { PHOTOS } from "@/lib/images";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-4xl">{title}</h1>
          <p className="mt-2 text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden lg:block">
        <SafeImage src={PHOTOS.heroRoad} alt="Road trip through the mountains" seed="auth" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/20 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-ivory">
          <p className="font-display text-3xl leading-snug">“Explore freely. Plan intelligently.”</p>
          <p className="mt-2 text-ivory/70">Your trips, bookings, budget and concierge, all in one place.</p>
        </div>
      </div>
    </div>
  );
}

export function DemoNotice() {
  return (
    <div className="rounded-2xl border border-gold/40 bg-gold-50 p-4 text-sm">
      <p className="font-semibold text-navy">Accounts aren’t configured on this deployment</p>
      <p className="mt-1 text-muted">
        Supabase credentials are missing, so sign-up is disabled. You can explore the full app in demo mode with sample data
        stored in your browser.
      </p>
      <a
        href="/demo"
        className="mt-3 inline-flex h-10 items-center rounded-full bg-navy px-4 text-sm font-semibold text-ivory"
      >
        Explore the demo
      </a>
    </div>
  );
}
