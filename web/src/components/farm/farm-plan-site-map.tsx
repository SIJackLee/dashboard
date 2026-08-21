"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./farm-plan-site-map.css";
import {
  BARN_PLAN_BOUNDARY_MIN,
  type BarnPlanLatLng,
  type BarnPlanLot,
} from "@/lib/farm/barn-plan-boundary";
import { FarmPlanKakaoMap } from "@/components/farm/farm-plan-kakao-map";

const SOUTH_KOREA_VIEW = L.latLngBounds([32.95, 124.55], [38.72, 129.85]);
const SOUTH_KOREA_PAN = L.latLngBounds([32.7, 124.15], [38.95, 132.05]);
const MAX_ZOOM = 18;

const OSM_URL = "https://tiles.osm.kr/hot/{z}/{x}/{y}.png";
const OSM_ATTR =
  '© <a href="https://www.openstreetmap.org/copyright">오픈스트리트맵 기여자</a> · <a href="https://osm.kr/">OSM 한국</a>';
const SAT_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SAT_ATTR =
  "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics";

export type FarmPlanMapLayer = "sat" | "map";

type Props = {
  layer: FarmPlanMapLayer;
  center: BarnPlanLatLng | null;
  centerZoom?: number;
  points: BarnPlanLatLng[];
  lots?: BarnPlanLot[];
  selectedLotIds?: string[];
  closed: boolean;
  kakaoAppKey?: string | null;
  active?: boolean;
  onToggleLot?: (id: string) => void;
};

function pathMutedColor(): string {
  if (typeof document === "undefined") return "oklch(0.55 0.02 240)";
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--muted-foreground")
      .trim() || "oklch(0.55 0.02 240)"
  );
}

function pathColor(): string {
  if (typeof document === "undefined") return "oklch(0.5 0.15 145)";
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() ||
    "oklch(0.5 0.15 145)"
  );
}

function toLatLngs(points: BarnPlanLatLng[]): L.LatLng[] {
  return points.map((p) => L.latLng(p.lat, p.lng));
}

export function FarmPlanSiteMap(props: Props) {
  const [kakaoFailed, setKakaoFailed] = useState(false);
  const onKakaoFail = useCallback(() => setKakaoFailed(true), []);
  if (props.kakaoAppKey && !kakaoFailed) {
    return (
      <FarmPlanKakaoMap
        appKey={props.kakaoAppKey}
        layer={props.layer}
        center={props.center}
        centerZoom={props.centerZoom}
        points={props.points}
        lots={props.lots}
        selectedLotIds={props.selectedLotIds}
        closed={props.closed}
        active={props.active}
        onToggleLot={props.onToggleLot}
        onFail={onKakaoFail}
      />
    );
  }
  return <FarmPlanLeafletMap {...props} />;
}

function FarmPlanLeafletMap({
  layer,
  center,
  centerZoom = 17,
  points,
  lots = [],
  selectedLotIds = [],
  closed,
  active = true,
  onToggleLot,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const osmRef = useRef<L.TileLayer | null>(null);
  const satRef = useRef<L.TileLayer | null>(null);
  const drawRef = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const onToggleLotRef = useRef(onToggleLot);
  const centerRef = useRef(center);
  const centerZoomRef = useRef(centerZoom);

  useEffect(() => {
    onToggleLotRef.current = onToggleLot;
  }, [onToggleLot]);
  useEffect(() => {
    centerRef.current = center;
    centerZoomRef.current = centerZoom;
  }, [center, centerZoom]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let map: L.Map | null = null;
    const timers: number[] = [];

    const hostReady = () => host.clientWidth >= 160 && host.clientHeight >= 160;

    const applyCamera = (force: boolean) => {
      if (!map) return;
      const before = map.getSize();
      map.invalidateSize({ animate: false });
      const after = map.getSize();
      if (!hostReady()) return;
      if (before.x !== after.x || before.y !== after.y) {
        map.panBy([1, 0], { animate: false });
        map.panBy([-1, 0], { animate: false });
      }
      const start = centerRef.current;
      if (start) {
        if (force) {
          map.setView([start.lat, start.lng], centerZoomRef.current, {
            animate: false,
          });
        }
        return;
      }
      const needed = map.getBoundsZoom(SOUTH_KOREA_VIEW, false, L.point(28, 28));
      if (!Number.isFinite(needed)) return;
      if (force || map.getZoom() <= needed + 0.05) {
        map.fitBounds(SOUTH_KOREA_VIEW, {
          padding: [28, 28],
          animate: false,
        });
      }
    };

    const create = () => {
      if (cancelled || mapRef.current) return;
      if (!hostReady()) return;

      map = L.map(host, {
        attributionControl: true,
        zoomControl: false,
        scrollWheelZoom: true,
        maxBounds: SOUTH_KOREA_PAN,
        maxBoundsViscosity: 0.75,
        minZoom: 5,
        maxZoom: MAX_ZOOM,
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

      const osm = L.tileLayer(OSM_URL, {
        attribution: OSM_ATTR,
        maxZoom: MAX_ZOOM,
      });
      const sat = L.tileLayer(SAT_URL, {
        attribution: SAT_ATTR,
        maxZoom: MAX_ZOOM,
      });
      osmRef.current = osm;
      satRef.current = sat;
      sat.addTo(map);

      const draw = L.layerGroup().addTo(map);
      drawRef.current = draw;

      mapRef.current = map;
      setMapReady(true);
      applyCamera(true);
    };

    const ro = new ResizeObserver(() => {
      if (!mapRef.current) create();
      else applyCamera(false);
    });
    ro.observe(host);
    create();
    timers.push(window.setTimeout(create, 50));
    timers.push(window.setTimeout(create, 200));
    timers.push(window.setTimeout(() => applyCamera(true), 80));
    timers.push(window.setTimeout(() => applyCamera(true), 280));

    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
      ro.disconnect();
      if (map) map.remove();
      mapRef.current = null;
      drawRef.current = null;
      osmRef.current = null;
      satRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    map.setView([center.lat, center.lng], centerZoom, { animate: false });
  }, [center, centerZoom]);

  useEffect(() => {
    const map = mapRef.current;
    const osm = osmRef.current;
    const sat = satRef.current;
    if (!map || !osm || !sat) return;
    if (layer === "sat") {
      if (map.hasLayer(osm)) map.removeLayer(osm);
      if (!map.hasLayer(sat)) sat.addTo(map);
      return;
    }
    if (map.hasLayer(sat)) map.removeLayer(sat);
    if (!map.hasLayer(osm)) osm.addTo(map);
  }, [layer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !active || !mapReady) return;
    map.invalidateSize({ animate: false });
  }, [active, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) return;
    draw.clearLayers();
    const selected = new Set(selectedLotIds);
    const pickable = lots.length > 0;
    const muted = pathMutedColor();
    const color = pathColor();

    for (const lot of lots) {
      if (lot.ring.length < BARN_PLAN_BOUNDARY_MIN) continue;
      const on = selected.has(lot.id);
      const poly = L.polygon(toLatLngs(lot.ring), {
        color: on ? color : muted,
        weight: on ? 2 : 1,
        fillColor: on ? color : muted,
        fillOpacity: on ? 0.38 : 0.06,
        interactive: true,
      });
      poly.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onToggleLotRef.current?.(lot.id);
      });
      poly.addTo(draw);
    }

    if (pickable) return;
    if (closed && points.length >= BARN_PLAN_BOUNDARY_MIN) {
      L.polygon(toLatLngs(points), {
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.22,
        interactive: false,
      }).addTo(draw);
    }
  }, [points, closed, lots, selectedLotIds, mapReady, active]);

  return (
    <div
      ref={hostRef}
      className="farm-plan-leaflet absolute inset-0 h-full w-full"
      aria-label="농장 부지 지도"
      data-testid="farm-plan-site-map"
    />
  );
}
