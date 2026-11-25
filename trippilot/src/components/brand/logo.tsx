import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#101C33" />
      <path d="M8 18.5 24 9.5l-4.6 14.2-4.1-4.4-3.9 2.3.9-4.4L8 18.5Z" fill="#DDA96C" />
      <path d="m15.3 19.3 8.7-9.8-11.7 7.8" fill="#456CFF" />
    </svg>
  );
}

export function Logo({ href = "/", className, light }: { href?: string; className?: string; light?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="TripPilot home">
      <LogoMark />
      <span className={cn("font-display text-[1.35rem] font-semibold tracking-tight", light ? "text-ivory" : "text-navy")}>
        TripPilot
      </span>
    </Link>
  );
}
