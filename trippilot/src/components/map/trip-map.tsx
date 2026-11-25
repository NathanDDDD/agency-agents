"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/spinner";
import type { TripMapProps } from "./types";

// Swap this import to change map provider (e.g. a Google Maps implementation
// of the same TripMapProps contract).
const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

export function TripMap(props: TripMapProps) {
  return <LeafletMap {...props} />;
}
