"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./admin-hub-leaflet-map.css";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import {
  farmDisplayLabel,
  formatHumidityPct,
  formatTempC,
} from "@/lib/data/farm-summaries";
import {
  hubFarmMonitorMetrics,
  type AdminHubFarmRow,
} from "@/lib/farm/admin-hub-farm-status";
import { farmNoFromLsind } from "@/lib/geo/korea-regions";

/** 첫 화면: 본토+제주가 잘리지 않게. 독도까지 맞추면 가로로 찌그러진다. */
const SOUTH_KOREA_VIEW = L.latLngBounds([32.95, 124.55], [38.72, 129.85]);
/** 팬 한계: 울릉·독도까지 이동 가능, 북한·중국·일본 본토는 막음 */
const SOUTH_KOREA_PAN = L.latLngBounds([32.7, 124.15], [38.95, 132.05]);
const SOUTH_KOREA_MAX_ZOOM = 16;

const TONE_LABEL = {
  live: "정상",
  alert: "경보",
  offline: "오프라인",
  location: "위치만",
} as const;

type Props = {
  rows: AdminHubFarmRow[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (farmKey: FarmKey) => void;
};

function pinLabel(farmKey: FarmKey): string {
  const n = farmNoFromLsind(farmKey.lsindRegistNo);
  if (n != null) return String(n);
  return farmKey.lsindRegistNo.slice(-2);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TIP_ICON = {
  temp: '<svg class="hub-map-tip-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>',
  hum: '<svg class="hub-map-tip-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z"/></svg>',
  cpu: '<svg class="hub-map-tip-icon" viewBox="0 0 24 24" aria-hidden="true"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>',
} as const;

function pinTooltipHtml(row: AdminHubFarmRow): string {
  const title = escapeHtml(
    farmDisplayLabel(row.farmKey, row.location?.farmName),
  );
  const status = escapeHtml(TONE_LABEL[row.tone]);
  const { tempC, humidityPct, online, controllerCount } =
    hubFarmMonitorMetrics(row);
  const controllers =
    online == null ? "—" : `${online}/${controllerCount}`;
  return `<div class="hub-map-tip-card"><div class="hub-map-tip-name">${title}</div><div class="hub-map-tip-status">${status}</div><div class="hub-map-tip-metrics"><span class="hub-map-tip-metric hub-map-tip-metric--temp">${TIP_ICON.temp}<span>${escapeHtml(formatTempC(tempC))}</span></span><span class="hub-map-tip-metric hub-map-tip-metric--hum">${TIP_ICON.hum}<span>${escapeHtml(formatHumidityPct(humidityPct))}</span></span><span class="hub-map-tip-metric">${TIP_ICON.cpu}<span>${escapeHtml(controllers)}</span></span></div></div>`;
}

function pinIcon(row: AdminHubFarmRow, active: boolean): L.DivIcon {
  const label = pinLabel(row.farmKey);
  return L.divIcon({
    className: "hub-map-pin-wrap",
    iconSize: active ? [32, 32] : [28, 28],
    iconAnchor: active ? [16, 16] : [14, 14],
    html: `<span class="hub-map-pin hub-map-pin--${row.tone}${active ? " is-active" : ""}">${label}</span>`,
  });
}

export function AdminHubLeafletMap({
  rows,
  activeId,
  onHover,
  onSelect,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelect);
  const rowsRef = useRef(rows);

  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || mapRef.current) return;

    const map = L.map(host, {
      attributionControl: true,
      zoomControl: false,
      scrollWheelZoom: true,
      maxBounds: SOUTH_KOREA_PAN,
      maxBoundsViscosity: 0.75,
      minZoom: 5,
      maxZoom: SOUTH_KOREA_MAX_ZOOM,
    });
    L.control
      .zoom({
        position: "topleft",
        zoomInTitle: "확대",
        zoomOutTitle: "축소",
      })
      .addTo(map);
    L.control
      .scale({
        position: "bottomleft",
        metric: true,
        imperial: false,
      })
      .addTo(map);
    L.tileLayer("https://tiles.osm.kr/hot/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">오픈스트리트맵 기여자</a> · <a href="https://osm.kr/">OSM 한국</a>',
      maxZoom: SOUTH_KOREA_MAX_ZOOM,
    }).addTo(map);

    const fitSouthKorea = (force = true) => {
      map.invalidateSize();
      const needed = map.getBoundsZoom(SOUTH_KOREA_VIEW, false, [28, 28]);
      if (!Number.isFinite(needed)) return;
      map.setMinZoom(needed);
      if (force || map.getZoom() <= needed + 0.05) {
        map.fitBounds(SOUTH_KOREA_VIEW, {
          padding: [36, 36],
          animate: false,
        });
      }
    };
    fitSouthKorea();
    mapRef.current = map;

    const ro = new ResizeObserver(() => {
      fitSouthKorea(false);
    });
    ro.observe(host);
    const ready = window.setTimeout(() => fitSouthKorea(true), 80);
    const markers = markersRef.current;

    return () => {
      window.clearTimeout(ready);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markersRef.current.values()) {
      map.removeLayer(marker);
    }
    markersRef.current.clear();

    for (const row of rows) {
      const loc = row.location;
      if (!loc) continue;
      if (!SOUTH_KOREA_PAN.contains([loc.lat, loc.lng])) continue;
      const id = farmKeyId(row.farmKey);
      const title = farmDisplayLabel(row.farmKey, loc.farmName);
      const marker = L.marker([loc.lat, loc.lng], {
        icon: pinIcon(row, false),
        title,
        keyboard: true,
        riseOnHover: true,
      });
      marker.bindTooltip(pinTooltipHtml(row), {
        direction: "auto",
        offset: [14, 0],
        className: "hub-map-tip",
        opacity: 1,
      });
      marker.on("mouseover", () => onHoverRef.current(id));
      marker.on("mouseout", () => onHoverRef.current(null));
      marker.on("click", () => onSelectRef.current(row.farmKey));
      marker.addTo(map);
      markersRef.current.set(id, marker);
    }

    map.invalidateSize();
  }, [rows]);

  useEffect(() => {
    for (const row of rowsRef.current) {
      const id = farmKeyId(row.farmKey);
      const marker = markersRef.current.get(id);
      if (!marker) continue;
      marker.setIcon(pinIcon(row, activeId === id));
      marker.setZIndexOffset(activeId === id ? 400 : 0);
    }
  }, [activeId]);

  return (
    <div
      ref={hostRef}
      className="hub-leaflet absolute inset-0 min-h-[18rem]"
      aria-label="전체 농장 지리 지도"
    />
  );
}
