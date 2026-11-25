// Provider-agnostic map contract. Any map implementation (Leaflet/OSM,
// Mapbox, Google Maps…) renders these props, so providers are swappable.
export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string; // short text inside the pin, e.g. "3"
  color: string;
  title: string;
  subtitle?: string;
  group: string; // e.g. day id, used for route lines
}

export interface TripMapProps {
  markers: MapMarker[];
  focusedId: string | null;
  onSelect: (id: string) => void;
  /** Draw a dashed line between markers of the same group, in order. */
  showRoutes?: boolean;
  className?: string;
}
