"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DataRepository } from "./repository";
import { LocalRepository } from "./local";
import { SupabaseRepository } from "./supabase";
import { getSupabaseBrowser } from "../supabase/client";
import { DEMO_COOKIE, isSupabaseConfigured } from "../config";
import type { Profile, TravelPreferences } from "../types";
import { hardNavigate } from "../utils";

interface DataContextValue {
  repo: DataRepository;
  profile: Profile;
  preferences: TravelPreferences | null;
  refreshProfile: () => Promise<void>;
  setPreferences: (p: TravelPreferences) => void;
  isDemo: boolean;
  signOut: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

function hasDemoCookie() {
  return typeof document !== "undefined" && document.cookie.split("; ").some((c) => c === `${DEMO_COOKIE}=1`);
}

export function clearDemoCookie() {
  document.cookie = `${DEMO_COOKIE}=; Max-Age=0; path=/`;
}

async function resolveRepository(): Promise<DataRepository> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseBrowser();
    const { data } = await sb.auth.getUser();
    if (data.user) return new SupabaseRepository(sb, data.user.id, data.user.email ?? null);
  }
  return new LocalRepository();
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; repo: DataRepository; profile: Profile; preferences: TravelPreferences | null };

export function DataProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      const repo = await resolveRepository();
      const [profile, preferences] = await Promise.all([repo.getProfile(), repo.getPreferences()]);
      setState({ status: "ready", repo, profile, preferences });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Could not load your data" });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial async load
    void load();
  }, [load]);

  const value = useMemo<DataContextValue | null>(() => {
    if (state.status !== "ready") return null;
    return {
      repo: state.repo,
      profile: state.profile,
      preferences: state.preferences,
      isDemo: state.repo.mode === "demo",
      refreshProfile: async () => {
        const profile = await state.repo.getProfile();
        setState((s) => (s.status === "ready" ? { ...s, profile } : s));
      },
      setPreferences: (preferences) =>
        setState((s) => (s.status === "ready" ? { ...s, preferences } : s)),
      signOut: async () => {
        clearDemoCookie();
        if (state.repo.mode === "supabase") await getSupabaseBrowser().auth.signOut();
        hardNavigate("/");
      },
    };
  }, [state]);

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-2xl">Something went wrong</h1>
        <p className="mt-2 text-muted">{state.message}</p>
        <button
          className="mt-6 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-ivory"
          onClick={() => {
            setState({ status: "loading" });
            void load();
          }}
        >
          Try again
        </button>
      </div>
    );
  }
  if (!value) return <>{fallback}</>;
  return <DataContext value={value}>{children}</DataContext>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}

export { hasDemoCookie };
