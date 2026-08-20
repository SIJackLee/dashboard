"use client";

import { useEffect, useRef, useState } from "react";
import {
  BARN_PLAN_BOUNDARY_MAX,
  BARN_PLAN_BOUNDARY_MIN,
  type BarnPlanLatLng,
  type BarnPlanLot,
} from "@/lib/farm/barn-plan-boundary";
import {
  leafletZoomToKakaoLevel,
  loadKakaoMapsSdk,
} from "@/lib/farm/kakao-maps-loader";
import "./farm-plan-site-map.css";

type KakaoLatLng = { getLat: () => number; getLng: () => number };
type KakaoPoint = { x: number; y: number };
type KakaoMap = {
  setMapTypeId: (id: unknown) => void;
  addOverlayMapTypeId: (id: unknown) => void;
  addControl: (control: unknown, pos: unknown) => void;
  setCenter: (ll: KakaoLatLng) => void;
  setLevel: (level: number) => void;
  setBounds: (bounds: unknown, t?: number, r?: number, b?: number, l?: number) => void;
  relayout: () => void;
  getProjection: () => {
    containerPointFromCoords: (ll: KakaoLatLng) => KakaoPoint;
  };
};

type KakaoNs = {
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new (sw: KakaoLatLng, ne: KakaoLatLng) => {
    extend: (ll: KakaoLatLng) => void;
  };
  Map: new (
    el: HTMLElement,
    opts: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  MapTypeId: { HYBRID: unknown; ROADMAP: unknown; USE_DISTRICT: unknown };
  ZoomControl: new () => unknown;
  ControlPosition: { TOPLEFT: unknown };
  Polygon: new (opts: Record<string, unknown>) => {
    setMap: (map: KakaoMap | null) => void;
  };
  Polyline: new (opts: Record<string, unknown>) => {
    setMap: (map: KakaoMap | null) => void;
  };
  Marker: new (opts: Record<string, unknown>) => {
    setMap: (map: KakaoMap | null) => void;
    setPosition: (ll: KakaoLatLng) => void;
    getPosition: () => KakaoLatLng;
  };
  MarkerImage: new (
    src: string,
    size: unknown,
    opts: { offset: unknown },
  ) => unknown;
  Size: new (w: number, h: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  event: {
    addListener: (target: unknown, name: string, handler: (e: unknown) => void) => void;
  };
};

type Props = {
  appKey: string;
  layer: "sat" | "map";
  center: BarnPlanLatLng | null;
  centerZoom?: number;
  points: BarnPlanLatLng[];
  lots?: BarnPlanLot[];
  selectedLotIds?: string[];
  closed: boolean;
  onPointsChange: (points: BarnPlanLatLng[]) => void;
  onToggleLot?: (id: string) => void;
  onClose: () => void;
  onFail: () => void;
};

function readCssColor(varName: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const raw =
    getComputedStyle(document.documentElement).getPropertyValue(varName).trim() ||
    fallback;
  const probe = document.createElement("span");
  probe.style.color = raw;
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return computed || fallback;
}

function rgbToHex(color: string): string {
  const m = color.match(/(\d+)/g);
  if (!m || m.length < 3) return "#166534";
  const hex = m
    .slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

function vertexImage(maps: KakaoNs, fill: string, stroke: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><circle cx="7" cy="7" r="5.5" fill="${fill}" stroke="${stroke}" stroke-width="2"/></svg>`;
  const src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  return new maps.MarkerImage(src, new maps.Size(14, 14), {
    offset: new maps.Point(7, 7),
  });
}

function toPath(maps: KakaoNs, points: BarnPlanLatLng[]): KakaoLatLng[] {
  return points.map((p) => new maps.LatLng(p.lat, p.lng));
}

export function FarmPlanKakaoMap({
  appKey,
  layer,
  center,
  centerZoom = 17,
  points,
  lots = [],
  selectedLotIds = [],
  closed,
  onPointsChange,
  onToggleLot,
  onClose,
  onFail,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const mapsRef = useRef<KakaoNs | null>(null);
  const overlaysRef = useRef<{ setMap: (map: KakaoMap | null) => void }[]>([]);
  const onPointsChangeRef = useRef(onPointsChange);
  const onCloseRef = useRef(onClose);
  const onToggleLotRef = useRef(onToggleLot);
  const pointsRef = useRef(points);
  const lotsRef = useRef(lots);
  const closedRef = useRef(closed);
  const centerRef = useRef(center);
  const centerZoomRef = useRef(centerZoom);
  const skipMapClickRef = useRef(false);
  const layerRef = useRef(layer);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onPointsChangeRef.current = onPointsChange;
  }, [onPointsChange]);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    onToggleLotRef.current = onToggleLot;
  }, [onToggleLot]);
  useEffect(() => {
    pointsRef.current = points;
    lotsRef.current = lots;
    closedRef.current = closed;
    centerRef.current = center;
    centerZoomRef.current = centerZoom;
    layerRef.current = layer;
  }, [points, lots, closed, center, centerZoom, layer]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let clickTarget: KakaoMap | null = null;

    const applyType = (map: KakaoMap, maps: KakaoNs) => {
      map.setMapTypeId(
        layerRef.current === "sat" ? maps.MapTypeId.HYBRID : maps.MapTypeId.ROADMAP,
      );
      map.addOverlayMapTypeId(maps.MapTypeId.USE_DISTRICT);
    };

    const applyCamera = (map: KakaoMap, maps: KakaoNs, force: boolean) => {
      map.relayout();
      const start = centerRef.current;
      if (start) {
        if (force) {
          map.setCenter(new maps.LatLng(start.lat, start.lng));
          map.setLevel(leafletZoomToKakaoLevel(centerZoomRef.current));
        }
        return;
      }
      map.setCenter(new maps.LatLng(36.2, 127.8));
      map.setLevel(12);
    };

    void loadKakaoMapsSdk(appKey)
      .then(() => {
        if (cancelled || !hostRef.current) return;
        const maps = window.kakao?.maps as unknown as KakaoNs | undefined;
        if (!maps?.Map) {
          onFail();
          return;
        }
        mapsRef.current = maps;
        const start = centerRef.current;
        const map = new maps.Map(hostRef.current, {
          center: start
            ? new maps.LatLng(start.lat, start.lng)
            : new maps.LatLng(36.2, 127.8),
          level: start ? leafletZoomToKakaoLevel(centerZoomRef.current) : 12,
        });
        map.addControl(
          new maps.ZoomControl(),
          maps.ControlPosition.TOPLEFT,
        );
        applyType(map, maps);
        hostRef.current.style.cursor =
          lotsRef.current.length > 0 || closedRef.current ? "" : "crosshair";
        maps.event.addListener(map, "click", (raw) => {
          if (skipMapClickRef.current) {
            skipMapClickRef.current = false;
            return;
          }
          if (lotsRef.current.length > 0) return;
          if (closedRef.current) return;
          const current = pointsRef.current;
          if (current.length >= BARN_PLAN_BOUNDARY_MAX) return;
          const evt = raw as { latLng?: KakaoLatLng };
          const ll = evt.latLng;
          if (!ll) return;
          const next = { lat: ll.getLat(), lng: ll.getLng() };
          if (current.length >= BARN_PLAN_BOUNDARY_MIN) {
            const first = current[0]!;
            const proj = map.getProjection();
            const a = proj.containerPointFromCoords(
              new maps.LatLng(first.lat, first.lng),
            );
            const b = proj.containerPointFromCoords(ll);
            if (Math.hypot(a.x - b.x, a.y - b.y) <= 16) {
              onCloseRef.current();
              return;
            }
          }
          onPointsChangeRef.current([...current, next]);
        });
        mapRef.current = map;
        clickTarget = map;
        applyCamera(map, maps, true);
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) onFail();
      });

    const ro = new ResizeObserver(() => {
      const map = mapRef.current;
      if (map) map.relayout();
    });
    ro.observe(host);

    return () => {
      cancelled = true;
      ro.disconnect();
      for (const layerObj of overlaysRef.current) layerObj.setMap(null);
      overlaysRef.current = [];
      mapRef.current = null;
      mapsRef.current = null;
      void clickTarget;
    };
  }, [appKey, onFail]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps || !center) return;
    map.setCenter(new maps.LatLng(center.lat, center.lng));
    map.setLevel(leafletZoomToKakaoLevel(centerZoom));
  }, [center, centerZoom]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;
    map.setMapTypeId(layer === "sat" ? maps.MapTypeId.HYBRID : maps.MapTypeId.ROADMAP);
  }, [layer]);

  useEffect(() => {
    const map = mapRef.current;
    const host = hostRef.current;
    if (!map || !host) return;
    host.style.cursor = lots.length > 0 || closed ? "" : "crosshair";
  }, [closed, lots.length]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;
    for (const layerObj of overlaysRef.current) layerObj.setMap(null);
    overlaysRef.current = [];

    const primary = rgbToHex(readCssColor("--primary", "rgb(22, 101, 52)"));
    const muted = rgbToHex(readCssColor("--muted-foreground", "rgb(113, 113, 122)"));

    const remember = (obj: { setMap: (map: KakaoMap | null) => void }) => {
      obj.setMap(map);
      overlaysRef.current.push(obj);
    };

    const selected = new Set(selectedLotIds);
    const pickable = lots.length > 0;

    for (const lot of lots) {
      if (lot.ring.length < BARN_PLAN_BOUNDARY_MIN) continue;
      const on = selected.has(lot.id);
      const polygon = new maps.Polygon({
        path: toPath(maps, lot.ring),
        strokeWeight: on ? 2 : 1,
        strokeColor: on ? primary : muted,
        fillColor: on ? primary : muted,
        fillOpacity: on ? 0.38 : 0.06,
        zIndex: on ? 4 : 2,
        clickable: true,
      });
      remember(polygon);
      maps.event.addListener(polygon, "click", () => {
        skipMapClickRef.current = true;
        onToggleLotRef.current?.(lot.id);
      });
    }

    if (pickable) {
      return;
    }

    if (points.length === 0) {
      return;
    }

    if (closed && points.length >= BARN_PLAN_BOUNDARY_MIN) {
      remember(
        new maps.Polygon({
          path: toPath(maps, points),
          strokeWeight: 2,
          strokeColor: primary,
          fillColor: primary,
          fillOpacity: 0.22,
        }),
      );
    } else {
      remember(
        new maps.Polyline({
          path: toPath(maps, points),
          strokeWeight: 2,
          strokeColor: primary,
          strokeStyle: "dashed",
        }),
      );
    }

    const firstImg = vertexImage(maps, primary, primary);
    const restImg = vertexImage(maps, "#ffffff", primary);
    points.forEach((point, index) => {
      const marker = new maps.Marker({
        position: new maps.LatLng(point.lat, point.lng),
        image: index === 0 ? firstImg : restImg,
        draggable: closed,
        zIndex: 10,
      });
      remember(marker);
      maps.event.addListener(marker, "click", () => {
        if (closedRef.current) return;
        if (index === 0 && pointsRef.current.length >= BARN_PLAN_BOUNDARY_MIN) {
          onCloseRef.current();
        }
      });
      maps.event.addListener(marker, "dragend", () => {
        const ll = marker.getPosition();
        const next = pointsRef.current.map((p, i) =>
          i === index ? { lat: ll.getLat(), lng: ll.getLng() } : p,
        );
        onPointsChangeRef.current(next);
      });
    });
  }, [points, closed, lots, selectedLotIds, mapReady]);

  return (
    <div
      ref={hostRef}
      className="farm-plan-kakao absolute inset-0 h-full w-full"
      aria-label="농장 부지 지도"
      data-testid="farm-plan-site-map"
    />
  );
}
