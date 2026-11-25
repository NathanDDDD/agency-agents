import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "blue" | "gold" | "green" | "red" | "navy";

const tones: Record<Tone, string> = {
  neutral: "bg-ivory-200 text-muted",
  blue: "bg-pilot-50 text-pilot-600",
  gold: "bg-gold-50 text-gold-600",
  green: "bg-success/10 text-success",
  red: "bg-danger/10 text-danger",
  navy: "bg-navy text-ivory",
};

export function Badge({ tone = "neutral", children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
