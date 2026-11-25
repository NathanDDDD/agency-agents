"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, FlaskConical, Minus, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { useTrip } from "./trip-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { LogoMark } from "@/components/brand/logo";
import type { ChangeOperation, ChatMessage, TripBundle } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What restaurants are near our hotel?",
  "Can you make tomorrow less busy?",
  "What should we do if it rains?",
  "Find something romantic for tonight.",
  "Replace the afternoon activity on day 3 with something outdoors.",
  "How much have we spent so far?",
];

/** Minimal, safe formatting: paragraphs, "-" bullets and **bold**. */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
    );
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        const bullets = lines.filter((l) => /^\s*[-•*]\s+/.test(l));
        if (bullets.length && bullets.length === lines.filter((l) => l.trim()).length) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {bullets.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-•*]\s+/, ""))}</li>)}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {/^\s*[-•*]\s+/.test(l) ? `• ${l.replace(/^\s*[-•*]\s+/, "")}` : inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function describeOp(op: ChangeOperation, bundle: TripBundle) {
  const find = (id: string) => {
    for (const d of bundle.days) {
      const a = d.activities.find((x) => x.id === id);
      if (a) return { a, d };
    }
    return null;
  };
  if (op.type === "remove_activity") {
    const f = find(op.activity_id);
    const label = op.target_name ?? (f ? `${f.a.name} (Day ${f.d.day_number})` : null);
    return { icon: <Minus className="h-3.5 w-3.5" />, tone: "text-danger bg-danger/10", text: label ? `Remove ${label}` : "Remove an activity that no longer exists" };
  }
  if (op.type === "replace_activity") {
    const f = find(op.activity_id);
    const label = op.target_name ?? (f ? `${f.a.name} (Day ${f.d.day_number})` : null);
    return { icon: <RefreshCw className="h-3.5 w-3.5" />, tone: "text-pilot-600 bg-pilot-50", text: label ? `Replace ${label} with ${op.activity.name}` : `Add ${op.activity.name}` };
  }
  return { icon: <Plus className="h-3.5 w-3.5" />, tone: "text-success bg-success/10", text: `Add ${op.activity.name} to Day ${op.day_number}` };
}

function Message({ m }: { m: ChatMessage }) {
  const { bundle, applyProposal, dismissProposal } = useTrip();
  const [applying, setApplying] = useState(false);
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-navy px-4 py-3 text-[15px] text-ivory">{m.content}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <LogoMark className="mt-1 h-8 w-8 shrink-0" />
      <div className="min-w-0 max-w-[88%] space-y-2">
        <div className="rounded-3xl rounded-tl-lg border border-line bg-white px-4 py-3 text-[15px] leading-relaxed">
          <RichText text={m.content} />
        </div>
        {m.proposal && (
          <div className={cn("rounded-2xl border p-4", m.proposal.status === "pending" ? "border-pilot/30 bg-pilot-50/50" : "border-line bg-white/60")}>
            <p className="text-xs font-bold uppercase tracking-wider text-pilot-600">
              {m.proposal.status === "pending" ? "Proposed change: review before applying" : m.proposal.status === "applied" ? "Applied to itinerary" : "Dismissed"}
            </p>
            <p className="mt-1 text-sm font-semibold">{m.proposal.summary}</p>
            <ul className="mt-2 space-y-1.5">
              {m.proposal.operations.map((op, i) => {
                const d = describeOp(op, bundle);
                return (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", d.tone)}>{d.icon}</span>
                    <span>{d.text}</span>
                  </li>
                );
              })}
            </ul>
            {m.proposal.status === "pending" && (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  loading={applying}
                  icon={<Check className="h-4 w-4" />}
                  onClick={async () => {
                    setApplying(true);
                    await applyProposal(m.id);
                    setApplying(false);
                  }}
                >
                  Apply change
                </Button>
                <Button size="sm" variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => void dismissProposal(m.id)}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        )}
        {m.mode === "demo" && (
          <p className="flex items-center gap-1 pl-1 text-[11px] font-semibold text-gold-600">
            <FlaskConical className="h-3 w-3" /> Demo response (scripted, not live AI)
          </p>
        )}
        {m.mode === "live" && (
          <p className="flex items-center gap-1 pl-1 text-[11px] text-muted">
            <Sparkles className="h-3 w-3" /> AI-generated. Verify prices, hours and availability.
          </p>
        )}
      </div>
    </div>
  );
}

export function ConciergeTab() {
  const { bundle, sendMessage, busy, clearChat } = useTrip();
  const [text, setText] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bundle.messages.length, busy.chatting]);

  const send = (value: string) => {
    const v = value.trim();
    if (!v || busy.chatting) return;
    setText("");
    void sendMessage(v);
    inputRef.current?.focus();
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Ask TripPilot</h2>
          <p className="text-sm text-muted">Knows your itinerary, bookings, budget and preferences.</p>
        </div>
        {bundle.messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)} icon={<Trash2 className="h-4 w-4" />}>
            Clear
          </Button>
        )}
      </div>

      <div className="min-h-[40vh] space-y-5 pb-4" aria-live="polite">
        {bundle.messages.length === 0 && (
          <div className="card p-6 text-center">
            <LogoMark className="mx-auto h-12 w-12" />
            <p className="mt-3 font-display text-xl">How can I help with {bundle.trip.name}?</p>
            <p className="mt-1 text-sm text-muted">Ask a question or tell me what to change. I’ll suggest edits for you to approve.</p>
          </div>
        )}
        {bundle.messages.map((m) => <Message key={m.id} m={m} />)}
        {busy.chatting && (
          <div className="flex gap-3" role="status">
            <LogoMark className="mt-1 h-8 w-8 shrink-0" />
            <div className="flex items-center gap-1.5 rounded-3xl rounded-tl-lg border border-line bg-white px-4 py-4">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-navy/40" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
              <span className="sr-only">TripPilot is thinking</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-20 z-10 -mx-4 bg-gradient-to-t from-ivory via-ivory to-transparent px-4 pb-3 pt-4 md:bottom-0">
        <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} disabled={busy.chatting} className="shrink-0 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm transition hover:border-navy/30 disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex items-end gap-2 rounded-3xl border border-line bg-white p-2 shadow-lift focus-within:border-pilot"
        >
          <label htmlFor="concierge-input" className="sr-only">Message TripPilot</label>
          <textarea
            id="concierge-input"
            ref={inputRef}
            rows={1}
            value={text}
            maxLength={4000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            placeholder="Ask anything about your trip…"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] focus:outline-none"
          />
          <button type="submit" disabled={!text.trim() || busy.chatting} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy text-ivory transition disabled:opacity-40" aria-label="Send">
            <ArrowUp className="h-5 w-5" />
          </button>
        </form>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear conversation?"
        message="This removes your chat history for this trip. Your itinerary isn't affected."
        confirmLabel="Clear"
        onConfirm={() => {
          setConfirmClear(false);
          void clearChat();
        }}
      />
    </div>
  );
}
