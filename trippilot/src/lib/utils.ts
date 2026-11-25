import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowIso() {
  return new Date().toISOString();
}

/** Parse YYYY-MM-DD as a local date (avoids UTC off-by-one). */
export function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date: string, n: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + n);
  return toDateString(d);
}

export function daysBetween(start: string, end: string): number {
  const ms = parseDate(end).getTime() - parseDate(start).getTime();
  return Math.round(ms / 86_400_000);
}

export function tripLength(start: string, end: string): number {
  return Math.max(1, daysBetween(start, end) + 1);
}

export function todayString() {
  return toDateString(new Date());
}

export function formatDate(
  d: string,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) {
  return parseDate(d).toLocaleDateString("en-US", opts);
}

export function formatDateRange(start: string, end: string) {
  const s = parseDate(start);
  const e = parseDate(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();
  const md = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const startStr = sameYear ? md(s) : `${md(s)}, ${s.getFullYear()}`;
  const endStr = sameMonth ? String(e.getDate()) : md(e);
  return `${startStr} – ${endStr}, ${e.getFullYear()}`;
}

export function formatTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

export function formatDuration(minutes: number | null | undefined) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function formatMoney(
  amount: number | null | undefined,
  currency = "USD",
  opts: { compact?: boolean } = {},
) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: opts.compact || Math.abs(amount) >= 100 || Number.isInteger(amount) ? 0 : 2,
      notation: opts.compact && Math.abs(amount) >= 10_000 ? "compact" : "standard",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "ILS", "AED", "SGD"];

export function slotForTime(t: string | null): "morning" | "afternoon" | "evening" {
  if (!t) return "afternoon";
  const h = Number(t.split(":")[0]);
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export function sortActivities<T extends { sort_order: number; suggested_time: string | null }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order);
}

export function tripStatus(start: string, end: string): "upcoming" | "active" | "completed" {
  const today = todayString();
  if (today < start) return "upcoming";
  if (today > end) return "completed";
  return "active";
}

export function pluralize(n: number, word: string, plural = `${word}s`) {
  return `${n} ${n === 1 ? word : plural}`;
}

export function initials(name: string | null | undefined) {
  if (!name) return "TP";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Full page navigation (used after auth changes so cookies and data reload). */
export function hardNavigate(path: string) {
  window.location.assign(new URL(path, window.location.origin).toString());
}
