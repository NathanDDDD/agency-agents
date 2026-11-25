"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MapPinOff } from "lucide-react";
import { useData } from "@/lib/data/provider";
import type { TripBundle } from "@/lib/types";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { TripProvider } from "@/components/trip/trip-context";
import { TripDashboard } from "@/components/trip/trip-dashboard";

export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const { repo } = useData();
  const [state, setState] = useState<{ status: "loading" } | { status: "missing" } | { status: "error"; message: string } | { status: "ready"; bundle: TripBundle }>({
    status: "loading",
  });

  useEffect(() => {
    let alive = true;
    repo
      .getBundle(id)
      .then((bundle) => alive && setState(bundle ? { status: "ready", bundle } : { status: "missing" }))
      .catch((err: unknown) => alive && setState({ status: "error", message: err instanceof Error ? err.message : "Could not load trip" }));
    return () => {
      alive = false;
    };
  }, [repo, id]);

  if (state.status === "loading") return <PageLoader label="Loading trip" />;
  if (state.status !== "ready") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          icon={<MapPinOff className="h-6 w-6" />}
          title={state.status === "missing" ? "Trip not found" : "Couldn't load this trip"}
          description={state.status === "missing" ? "It may have been deleted, or you don't have access to it." : state.message}
          action={<LinkButton href="/app">Back to trips</LinkButton>}
        />
      </div>
    );
  }
  return (
    <TripProvider key={state.bundle.trip.id} initial={state.bundle}>
      <TripDashboard />
    </TripProvider>
  );
}
