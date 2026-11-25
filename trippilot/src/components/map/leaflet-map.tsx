"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_PROVIDER, MAPBOX_TOKEN } from "@/lib/config";
import type { TripMapProps } from "./types";

function tileLayer() {
  if (MAP_PROVIDER === "mapbox" && MAPBOX_TOKEN) {
    return L.tileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
      { attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 },
    );
  }
  return L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Leaflet implementation of the TripMap contract (OSM/CARTO or Mapbox tiles). */
export default function LeafletMap({ markers, focusedId, onSelect, showRoutes = true, className }: TripMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markerRefs = useRef(new Map<string, L.Marker>());
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const key = useMemo(() => markers.map((m) => `${m.id}:${m.lat}:${m.lng}:${m.label}:${m.color}`).join("|"), [markers]);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: false, scrollWheelZoom: true }).setView([41.9, 12.48], 12);
    L.control.zoom({ position: "bottomright" }).addTo(map.current);
    tileLayer().addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    const ro = new ResizeObserver(() => map.current?.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group) return;
    group.clearLayers();
    markerRefs.current.clear();
    if (showRoutes) {
      const byGroup = new Map<string, [number, number][]>();
      for (const mk of markers) byGroup.set(mk.group, [...(byGroup.get(mk.group) ?? []), [mk.lat, mk.lng]]);
      for (const [g, pts] of byGroup) {
        if (pts.length < 2) continue;
        const color = markers.find((x) => x.group === g)?.color ?? "#101C33";
        L.polyline(pts, { color, weight: 2.5, opacity: 0.55, dashArray: "6 6" }).addTo(group);
      }
    }
    for (const mk of markers) {
      const icon = L.divIcon({
        className: "",
        html: `<div class="tp-marker" data-id="${mk.id}" style="background:${mk.color}"><span>${escapeHtml(mk.label)}</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30],
      });
      const marker = L.marker([mk.lat, mk.lng], { icon, title: mk.title, keyboard: true })
        .bindPopup(`<strong>${escapeHtml(mk.title)}</strong>${mk.subtitle ? `<br/><span style="color:#5b6478">${escapeHtml(mk.subtitle)}</span>` : ""}`)
        .on("click", () => onSelectRef.current(mk.id));
      marker.addTo(group);
      markerRefs.current.set(mk.id, marker);
    }
    if (markers.length === 1) m.setView([markers[0].lat, markers[0].lng], 15);
    else if (markers.length > 1) m.fitBounds(L.latLngBounds(markers.map((x) => [x.lat, x.lng])), { padding: [48, 48], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures marker changes
  }, [key, showRoutes]);

  useEffect(() => {
    document.querySelectorAll(".tp-marker.is-active").forEach((n) => n.classList.remove("is-active"));
    if (!focusedId) return;
    const marker = markerRefs.current.get(focusedId);
    if (!marker || !map.current) return;
    map.current.flyTo(marker.getLatLng(), Math.max(map.current.getZoom(), 15), { duration: 0.6 });
    marker.openPopup();
    document.querySelector(`.tp-marker[data-id="${focusedId}"]`)?.classList.add("is-active");
  }, [focusedId, key]);

  return <div ref={el} className={className} role="application" aria-label="Trip map" />;
}
