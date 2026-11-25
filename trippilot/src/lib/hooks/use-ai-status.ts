"use client";

import { useEffect, useState } from "react";

export interface AIStatus {
  ai: boolean;
  supabase: boolean;
}

let cached: AIStatus | null = null;
let inflight: Promise<AIStatus> | null = null;

export function useAIStatus(): AIStatus | null {
  const [status, setStatus] = useState<AIStatus | null>(cached);
  useEffect(() => {
    if (cached) return;
    inflight ??= fetch("/api/status")
      .then((r) => r.json() as Promise<AIStatus>)
      .catch(() => ({ ai: false, supabase: false }));
    let alive = true;
    void inflight.then((s) => {
      cached = s;
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
