"use client";

import { useEffect, useRef } from "react";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type FarmLocationMapMarker = {
  farmKey: FarmKey;
  label: string;
  lat: number;
  lng: number;
};

type Props = {
  markers: FarmLocationMapMarker[];
  selectedId: string | null;
  onSelect: (farmKey: FarmKey) => void;
  className?: string;
};

export function FarmLocationMiniMap({
  markers,
  selectedId,
  onSelect,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [36.5, 127.8],
        zoom: 7,
        scrollWheelZoom: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current || !layerRef.current) return;

      layerRef.current.clearLayers();
      const bounds: [number, number][] = [];

      for (const m of markers) {
        const id = farmKeyId(m.farmKey);
        const selected = id === selectedId;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;border-radius:9999px;border:2px solid ${selected ? "#059669" : "#fff"};background:${selected ? "#10b981" : "#3b82f6"};box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const marker = L.marker([m.lat, m.lng], { icon }).bindTooltip(m.label);
        marker.on("click", () => onSelect(m.farmKey));
        marker.addTo(layerRef.current!);
        bounds.push([m.lat, m.lng]);
      }

      if (bounds.length > 0) {
        mapRef.current.fitBounds(bounds, { padding: [24, 24], maxZoom: 11 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [markers, selectedId, onSelect]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-muted/10",
        className
      )}
    >
      <div ref={containerRef} className="h-72 w-full" />
      {markers.length === 0 ? (
        <p
          className={cn(
            "border-t bg-muted/20 px-4 py-3 text-muted-foreground",
            dashboardUi.tableMeta
          )}
        >
          지도에 표시할 위치가 없습니다. 농장을 저장하면 마커가 표시됩니다.
        </p>
      ) : null}
    </div>
  );
}
