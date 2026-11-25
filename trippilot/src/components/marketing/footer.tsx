import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function MarketingFooter() {
  return (
    <footer className="bg-navy text-ivory/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ivory/60">
            Explore freely. Plan intelligently. One intelligent travel companion for everything before, during and after your journey.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ivory">Product</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/features" className="hover:text-ivory">Features</Link></li>
            <li><Link href="/how-it-works" className="hover:text-ivory">How it works</Link></li>
            <li><Link href="/pricing" className="hover:text-ivory">Pricing</Link></li>
            <li><a href="/demo" className="hover:text-ivory">Live demo</a></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ivory">Account</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/login" className="hover:text-ivory">Log in</Link></li>
            <li><Link href="/signup" className="hover:text-ivory">Create account</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-ivory/50 sm:flex-row sm:justify-between lg:px-8">
          <p>© {2026} TripPilot. All rights reserved.</p>
          <p>AI suggestions are estimates. Always verify prices, availability and opening hours before you go.</p>
        </div>
      </div>
    </footer>
  );
}
