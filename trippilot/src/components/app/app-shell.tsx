"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FlaskConical, Home, LogOut, Plus, Settings, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PageLoader } from "@/components/ui/spinner";
import { DataProvider, useData } from "@/lib/data/provider";
import { useAIStatus } from "@/lib/hooks/use-ai-status";
import { cn, initials } from "@/lib/utils";

const NAV = [
  { href: "/app", label: "Trips", icon: Home, exact: true },
  { href: "/app/trips/new", label: "New trip", icon: Plus, exact: true },
  { href: "/app/settings", label: "Settings", icon: Settings, exact: false },
];

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function DemoBanner() {
  const { isDemo } = useData();
  const status = useAIStatus();
  if (!isDemo && (status?.ai ?? true)) return null;
  return (
    <div className="border-b border-gold/30 bg-gold-50 text-navy">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-xs sm:text-sm lg:px-8">
        <FlaskConical className="h-4 w-4 shrink-0 text-gold-600" />
        <p className="min-w-0">
          {isDemo ? (
            <>
              <b>Demo mode.</b> Sample data is stored in this browser only.{" "}
              {status?.ai && status.supabase ? "Create an account to use live AI." : "AI responses are scripted demo content, not live AI."}
            </>
          ) : (
            <>
              <b>AI demo mode.</b> No Anthropic API key is configured, so AI responses are scripted demo content.
            </>
          )}
        </p>
        {isDemo && status?.supabase && (
          <Link href="/signup" className="ml-auto shrink-0 font-semibold text-pilot-600 underline-offset-2 hover:underline">
            Sign up
          </Link>
        )}
      </div>
    </div>
  );
}

function UserMenu() {
  const { profile, signOut, isDemo } = useData();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-sm font-bold text-gold"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initials(profile.full_name || profile.email)}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-60 animate-fade-in rounded-2xl border border-line bg-white p-2 shadow-lift">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{profile.full_name || "Traveler"}</p>
            <p className="truncate text-xs text-muted">{isDemo ? "Demo account" : profile.email}</p>
          </div>
          <Link href="/app/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ivory-200">
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <button onClick={() => void signOut()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ivory-200">
            <LogOut className="h-4 w-4" /> {isDemo ? "Exit demo" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}

function OnboardingGate({ children }: { children: ReactNode }) {
  const { profile } = useData();
  const router = useRouter();
  useEffect(() => {
    if (!profile.onboarded) router.replace("/onboarding");
  }, [profile.onboarded, router]);
  if (!profile.onboarded) return <PageLoader label="Setting things up" />;
  return <>{children}</>;
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <header className="sticky top-0 z-40 border-b border-line/70 bg-ivory/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
          <Logo href="/app" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="App">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                  isActive(pathname, n.href, n.exact) ? "bg-navy text-ivory" : "text-navy/70 hover:bg-navy/5 hover:text-navy",
                )}
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/app/trips/new"
              className="hidden h-10 items-center gap-1.5 rounded-full bg-gold px-4 text-sm font-semibold text-navy sm:inline-flex md:hidden lg:inline-flex"
            >
              <Sparkles className="h-4 w-4" /> Plan a trip
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="flex-1 pb-24 md:pb-10">
        <OnboardingGate>{children}</OnboardingGate>
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="App"
      >
        <div className="grid grid-cols-3">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href, n.exact);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold", active ? "text-navy" : "text-muted")}
              >
                <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition", active && "bg-navy text-gold")}>
                  <n.icon className="h-5 w-5" />
                </span>
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <DataProvider fallback={<PageLoader label="Loading your trips" />}>
      <Shell>{children}</Shell>
    </DataProvider>
  );
}
