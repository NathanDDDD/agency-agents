"use client";

import { useState } from "react";
import { Clock, MapPin, Sparkles, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = [
  {
    label: "Day 1",
    title: "Arrivederci jet lag",
    items: [
      { t: "2:00 PM", n: "Check in · Hotel de Russie", c: "Stay", food: false, x: 52, y: 18 },
      { t: "4:30 PM", n: "Spanish Steps stroll", c: "Sightseeing", food: false, x: 64, y: 32 },
      { t: "8:00 PM", n: "Armando al Pantheon", c: "Dinner", food: true, x: 46, y: 52 },
    ],
  },
  {
    label: "Day 2",
    title: "Ancient Rome, unhurried",
    items: [
      { t: "9:00 AM", n: "Colosseum guided tour", c: "Sightseeing", food: false, x: 72, y: 74 },
      { t: "1:30 PM", n: "Roscioli Salumeria", c: "Lunch", food: true, x: 40, y: 62 },
      { t: "8:00 PM", n: "Pierluigi", c: "Dinner", food: true, x: 30, y: 46 },
    ],
  },
  {
    label: "Day 3",
    title: "Vatican treasures",
    items: [
      { t: "8:30 AM", n: "Vatican Museums", c: "Museum", food: false, x: 12, y: 30 },
      { t: "5:00 PM", n: "Castel Sant'Angelo", c: "Sunset", food: false, x: 26, y: 34 },
      { t: "8:00 PM", n: "La Pergola", c: "Dinner", food: true, x: 8, y: 10 },
    ],
  },
];

/** Interactive itinerary + map preview on the landing page (illustrative). */
export function ItineraryPreview() {
  const [day, setDay] = useState(0);
  const [active, setActive] = useState(0);
  const d = DAYS[day];
  return (
    <div className="card overflow-hidden p-0 shadow-lift">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Roman Holiday · 6 days</p>
          <p className="font-display text-lg">{d.title}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-pilot-50 px-2.5 py-1 text-xs font-semibold text-pilot-600">
          <Sparkles className="h-3.5 w-3.5" /> AI planned
        </span>
      </div>
      <div className="flex gap-1.5 px-5 pt-4" role="tablist" aria-label="Preview days">
        {DAYS.map((x, i) => (
          <button
            key={x.label}
            role="tab"
            aria-selected={i === day}
            onClick={() => {
              setDay(i);
              setActive(0);
            }}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
              i === day ? "bg-navy text-ivory" : "text-muted hover:bg-ivory-200",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_1fr]">
        <ol className="space-y-2.5">
          {d.items.map((it, i) => (
            <li key={it.n}>
              <button
                onClick={() => setActive(i)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition",
                  i === active ? "border-pilot/40 bg-pilot-50/60" : "border-line hover:border-navy/20",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                    it.food ? "bg-gold" : "bg-pilot",
                  )}
                >
                  {it.food ? <Utensils className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{it.n}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <Clock className="h-3 w-3" /> {it.t} · {it.c}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div
          className="relative min-h-52 overflow-hidden rounded-2xl border border-line bg-[#ebe7de]"
          aria-label="Illustrative map"
          role="img"
        >
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M-5 70 C 20 60, 25 40, 38 38 S 55 55, 60 40 S 80 10, 105 20" stroke="#bcd0f5" strokeWidth="5" fill="none" />
            <g stroke="#fff" strokeWidth="1.4" fill="none" opacity="0.9">
              <path d="M0 25 H100 M0 55 H100 M0 85 H100 M20 0 V100 M50 0 V100 M80 0 V100" />
            </g>
            <polyline
              points={d.items.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#101C33"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
          </svg>
          {d.items.map((p, i) => (
            <span
              key={p.n}
              className={cn(
                "absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-lg transition-transform",
                p.food ? "bg-gold" : "bg-pilot",
                i === active && "scale-125 ring-4 ring-pilot/20",
              )}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              {i + 1}
            </span>
          ))}
          <div className="absolute bottom-2 left-2 right-2 rounded-xl bg-white/95 px-3 py-2 text-xs shadow">
            <span className="flex items-center gap-1 font-semibold">
              <MapPin className="h-3 w-3 text-pilot" /> {d.items[active].n}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
