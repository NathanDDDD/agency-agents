"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/button";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-ivory/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium text-navy/80 transition hover:text-navy">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="px-3 text-sm font-semibold text-navy">
            Log in
          </Link>
          <LinkButton href="/signup" size="sm">
            Start planning
          </LinkButton>
        </div>
        <button className="rounded-full p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="animate-fade-in border-t border-line bg-ivory px-5 pb-6 pt-2 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block py-3 text-lg font-medium">
              {n.label}
            </Link>
          ))}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <LinkButton href="/login" variant="secondary">
              Log in
            </LinkButton>
            <LinkButton href="/signup">Start planning</LinkButton>
          </div>
          <a href="/demo" className="mt-3 block text-center text-sm font-semibold text-pilot">
            Or explore the live demo →
          </a>
        </div>
      )}
    </header>
  );
}
