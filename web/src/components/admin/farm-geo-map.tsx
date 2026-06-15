"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import type { FarmMapPoint } from "@/lib/data/farm-geo-summary";
import {
  buildControllerHref,
  buildFarmAlarmsHref,
} from "@/lib/auth/farm-access";
import { farmKeyId } from "@/lib/data/farm-key";
import { FARM_GEO_MAP_SHELL } from "@/components/admin/farm-geo-map-shell";
import { FarmGeoMapLegend } from "@/components/admin/farm-geo-map-legend";
import {
  buildFarmMarkerIconSpec,
  buildFarmTooltipHtml,
  buildRegionMarkerIconSpec,
  buildRegionTooltipHtml,
} from "@/lib/geo/farm-map-markers";
import {
  maxInCohort,
  regionRiskLevel,
  totalControllerCount,
} from "@/lib/geo/farm-map-marker-scale";
import {
  aggregateBySido,
  aggregateBySigungu,
  applyViewForStage,
  farmsInSigungu,
  MAP_ZOOM_STAGE,
  shortSidoLabel,
  spreadFarmPointsForDisplay,
  sumControllerCount,
  zoomForStage,
  type MapZoomStage,
} from "@/lib/geo/farm-map-zoom";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import "./farm-geo-map.css";

type Props = {
  points: FarmMapPoint[];
  activeSido: string | null;
  onSelectSido?: (sido: string | null) => void;
  className?: string;
};

type LeafletModule = typeof import("leaflet");
type LeafletMarker = import("leaflet").Marker;

export function FarmGeoMap({
  points,
  activeSido,
  onSelectSido,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const sidoLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const sigunguLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const farmLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const sidoMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const sigunguMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const farmMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const sigunguScopeRef = useRef<string | null>(null);
  const farmScopeRef = useRef<string | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const stageRef = useRef<MapZoomStage>(0);
  const selectedSidoRef = useRef<string | null>(null);
  const selectedSigunguRef = useRef<string | null>(null);
  const suppressSnapRef = useRef(false);
  const stageSnapPendingRef = useRef(false);
  const internalNavRef = useRef(false);
  const lastZoomRef = useRef(zoomForStage(0));
  const renderMarkersRef = useRef<() => void>(() => {});
  const pointsRef = useRef(points);
  const { navigate, isPending } = useAppNavigate();
  const [stage, setStage] = useState<MapZoomStage>(0);
  const [liveZoom, setLiveZoom] = useState(zoomForStage(0));
  const [controllerAudit, setControllerAudit] = useState<{
    sigungu: number;
    farm: number;
  } | null>(null);
  const navigateToFarmAlarmsRef = useRef<(point: FarmMapPoint) => void>(() => {});
  const navigateToFarmControllersRef = useRef<(point: FarmMapPoint) => void>(
    () => {}
  );

  pointsRef.current = points;

  const applyStageStepRef = useRef<(direction: "in" | "out") => void>(() => {});

  const closeAllMapTooltips = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const cache of [
      sidoMarkersRef.current,
      sigunguMarkersRef.current,
      farmMarkersRef.current,
    ]) {
      for (const marker of cache.values()) {
        if (typeof marker.closeTooltip === "function") {
          marker.closeTooltip();
        }
      }
    }

    map.getContainer()?.querySelectorAll(".leaflet-tooltip").forEach((el) => {
      el.remove();
    });
  }, []);

  const navigateToFarmAlarms = useCallback(
    (point: FarmMapPoint) => {
      if (isPending) return;
      closeAllMapTooltips();
      navigate(buildFarmAlarmsHref(point.farmKey), {
        message: "알람 페이지로 이동 중…",
        sublabel: `${point.lsindRegistNo} · ${point.itemCode}`,
      });
    },
    [closeAllMapTooltips, isPending, navigate]
  );

  const navigateToFarmControllers = useCallback(
    (point: FarmMapPoint) => {
      if (isPending) return;
      closeAllMapTooltips();
      navigate(buildControllerHref({ farmKey: point.farmKey }), {
        message: "컨트롤러 페이지로 이동 중…",
        sublabel: `${point.lsindRegistNo} · ${point.itemCode}`,
      });
    },
    [closeAllMapTooltips, isPending, navigate]
  );

  navigateToFarmAlarmsRef.current = navigateToFarmAlarms;
  navigateToFarmControllersRef.current = navigateToFarmControllers;

  const syncMapDebugAttrs = useCallback((map: import("leaflet").Map) => {
    const el = containerRef.current;
    if (!el) return;
    const c = map.getCenter();
    el.dataset.mapCenter = `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
    el.dataset.mapZoom = String(map.getZoom());
    setLiveZoom(map.getZoom());
  }, []);

  const syncSigunguControllerAudit = useCallback(
    (sigunguRowSum: number | null, farmSum: number | null) => {
      const el = containerRef.current;
      if (!el) return;
      if (sigunguRowSum == null || farmSum == null) {
        delete el.dataset.sigunguControllerSum;
        delete el.dataset.farmControllerSum;
        delete el.dataset.controllerSumMatch;
        setControllerAudit(null);
        return;
      }
      el.dataset.sigunguControllerSum = String(sigunguRowSum);
      el.dataset.farmControllerSum = String(farmSum);
      el.dataset.controllerSumMatch = String(sigunguRowSum === farmSum);
      setControllerAudit({ sigungu: sigunguRowSum, farm: farmSum });
    },
    []
  );

  const currentSelection = useCallback(
    () => ({
      sido: selectedSidoRef.current,
      sigungu: selectedSigunguRef.current,
    }),
    []
  );

  const snapToStage = useCallback(
    (
      map: import("leaflet").Map,
      next: MapZoomStage,
      opts?: { center?: [number, number] }
    ) => {
      applyViewForStage(map, next, pointsRef.current, currentSelection(), {
        center: next === 2 || next === 3 ? undefined : opts?.center,
      });
    },
    [currentSelection]
  );

  const goToStage = useCallback(
    (
      L: LeafletModule,
      map: import("leaflet").Map,
      next: MapZoomStage,
      opts?: {
        center?: [number, number];
        skipRender?: boolean;
      }
    ) => {
      closeAllMapTooltips();
      stageRef.current = next;
      setStage(next);
      suppressSnapRef.current = true;

      let released = false;
      const releaseSnap = () => {
        if (released) return;
        released = true;
        suppressSnapRef.current = false;
        lastZoomRef.current = map.getZoom();
        syncMapDebugAttrs(map);
        if (!opts?.skipRender) {
          renderMarkersRef.current();
        }
      };

      if (opts?.center && next !== 2 && next !== 3) {
        applyViewForStage(map, next, pointsRef.current, currentSelection(), {
          center: opts.center,
        });
      } else {
        snapToStage(map, next, opts);
      }

      map.once("moveend", releaseSnap);
      window.setTimeout(releaseSnap, 500);
    },
    [closeAllMapTooltips, snapToStage, syncMapDebugAttrs, currentSelection]
  );

  const applyStageStep = useCallback(
    (direction: "in" | "out") => {
      const map = mapRef.current;
      if (!map || stageSnapPendingRef.current || suppressSnapRef.current) return;

      const prev = stageRef.current;
      let next: MapZoomStage;

      if (direction === "out") {
        next = Math.max(0, prev - 1) as MapZoomStage;
        if (next < 3) selectedSigunguRef.current = null;
        if (next <= 0) {
          selectedSidoRef.current = null;
        } else if (next === 1) {
          selectedSidoRef.current = null;
        }
      } else {
        next = Math.min(3, prev + 1) as MapZoomStage;
        if (next === 2 && !selectedSidoRef.current) return;
        if (
          next === 3 &&
          (!selectedSidoRef.current || !selectedSigunguRef.current)
        ) {
          return;
        }
      }

      if (next === prev) return;

      closeAllMapTooltips();
      internalNavRef.current = true;
      stageRef.current = next;
      setStage(next);
      if (next <= 1) onSelectSido?.(null);
      stageSnapPendingRef.current = true;
      suppressSnapRef.current = true;
      snapToStage(map, next);
      let released = false;
      const finishStep = () => {
        if (released) return;
        released = true;
        stageSnapPendingRef.current = false;
        suppressSnapRef.current = false;
        internalNavRef.current = false;
        lastZoomRef.current = map.getZoom();
        syncMapDebugAttrs(map);
        renderMarkersRef.current();
      };
      map.once("moveend", finishStep);
      window.setTimeout(finishStep, 500);
    },
    [closeAllMapTooltips, onSelectSido, snapToStage, syncMapDebugAttrs]
  );

  applyStageStepRef.current = applyStageStep;

  const purgeMarkers = useCallback(
    (
      cache: Map<string, LeafletMarker>,
      layer: import("leaflet").LayerGroup | null,
      keep: Set<string>
    ) => {
      for (const [key, marker] of cache) {
        if (!keep.has(key)) {
          layer?.removeLayer(marker);
          cache.delete(key);
        }
      }
    },
    []
  );

  const renderMarkers = useCallback(() => {
    const L = leafletRef.current;
    const sidoLayer = sidoLayerRef.current;
    const sigunguLayer = sigunguLayerRef.current;
    const farmLayer = farmLayerRef.current;
    const map = mapRef.current;
    if (!L || !map || !sidoLayer || !sigunguLayer || !farmLayer) return;

    const currentStage = stageRef.current;
    const sido = selectedSidoRef.current;
    const sigungu = selectedSigunguRef.current;
    const totalControllers = totalControllerCount(points);
    const showSido = currentStage <= 1;
    const showSigungu = currentStage === 2 && !!sido;
    const showFarm = currentStage === 3 && !!sido && !!sigungu;
    const regionStage =
      currentStage <= 1 ? (currentStage as MapZoomStage) : (2 as MapZoomStage);

    if (!showFarm) {
      syncSigunguControllerAudit(null, null);
    }

    const sidoKeys = new Set<string>();
    const sidoRows = aggregateBySido(points);
    const maxSidoControllers = maxInCohort(sidoRows.map((r) => r.controllerSum));
    for (const row of sidoRows) {
      sidoKeys.add(row.sido);
      const risk = regionRiskLevel({
        alarmSum: row.alarmSum,
        criticalSum: row.criticalSum,
        issueCount: row.issueCount,
        offlineSum: row.offlineSum,
      });
      const spec = buildRegionMarkerIconSpec({
        stage: regionStage,
        row: {
          title: shortSidoLabel(row.sido),
          controllerSum: row.controllerSum,
          alarmSum: row.alarmSum,
          criticalSum: row.criticalSum,
          offlineSum: row.offlineSum,
          issueCount: row.issueCount,
        },
        totalControllers,
        cohortMax: maxSidoControllers,
        visible: showSido,
      });
      let marker = sidoMarkersRef.current.get(row.sido);
      const icon = L.divIcon({
        html: spec.html,
        className: "",
        iconSize: [spec.w, spec.h],
        iconAnchor: [spec.anchorX, spec.anchorY],
      });
      const tooltipHtml = buildRegionTooltipHtml({
        title: row.sido,
        meta: `농장 ${row.farmCount} · 알람 ${row.alarmSum}`,
        controllerSum: row.controllerSum,
        farmCount: row.farmCount,
        alarmSum: row.alarmSum,
        risk,
        action:
          currentStage === 0
            ? "클릭 → 시·도 확대 (줌 2)"
            : "클릭 → 시·군·구 (줌 3)",
      });
      if (!marker) {
        marker = L.marker([row.lat, row.lng], { icon });
        marker.bindTooltip(tooltipHtml, {
          direction: "top",
          className: "farm-map-leaflet-tooltip",
        });
        marker.on("click", () => {
          selectedSidoRef.current = row.sido;
          selectedSigunguRef.current = null;
          onSelectSido?.(row.sido);
          const nextStage = stageRef.current === 0 ? 1 : 2;
          goToStage(L, map, nextStage as MapZoomStage, {
            center: nextStage === 2 ? undefined : [row.lat, row.lng],
          });
        });
        sidoLayer.addLayer(marker);
        sidoMarkersRef.current.set(row.sido, marker);
      } else {
        marker.setLatLng([row.lat, row.lng]);
        marker.setIcon(icon);
        marker.setTooltipContent(tooltipHtml);
      }
    }
    purgeMarkers(sidoMarkersRef.current, sidoLayer, sidoKeys);

    const sigunguScope = sido ?? null;
    if (sigunguScopeRef.current !== sigunguScope) {
      for (const [, marker] of sigunguMarkersRef.current) {
        sigunguLayer.removeLayer(marker);
      }
      sigunguMarkersRef.current.clear();
      sigunguScopeRef.current = sigunguScope;
    }

    const sigunguKeys = new Set<string>();
    if (sido) {
      const sigunguRows = aggregateBySigungu(points, sido);
      const maxSigunguControllers = maxInCohort(
        sigunguRows.map((r) => r.controllerSum)
      );
      for (const row of sigunguRows) {
        const key = `${row.sido}:${row.sigungu}`;
        sigunguKeys.add(key);
        const risk = regionRiskLevel({
          alarmSum: row.alarmSum,
          criticalSum: row.criticalSum,
          issueCount: row.issueCount,
          offlineSum: row.offlineSum,
        });
        const spec = buildRegionMarkerIconSpec({
          stage: 2,
          row: {
            title: row.sigungu,
            controllerSum: row.controllerSum,
            alarmSum: row.alarmSum,
            criticalSum: row.criticalSum,
            offlineSum: row.offlineSum,
            issueCount: row.issueCount,
          },
          totalControllers,
          cohortMax: maxSigunguControllers,
          visible: showSigungu,
        });
        let marker = sigunguMarkersRef.current.get(key);
        const icon = L.divIcon({
          html: spec.html,
          className: "",
          iconSize: [spec.w, spec.h],
          iconAnchor: [spec.anchorX, spec.anchorY],
        });
        const tooltipHtml = buildRegionTooltipHtml({
          title: `${row.sido} ${row.sigungu}`,
          meta: `농장 ${row.farmCount} · 알람 ${row.alarmSum}`,
          controllerSum: row.controllerSum,
          farmCount: row.farmCount,
          alarmSum: row.alarmSum,
          risk,
          action: "클릭 → 농장 (줌 4)",
        });
        if (!marker) {
          marker = L.marker([row.lat, row.lng], { icon });
          marker.bindTooltip(tooltipHtml, {
            direction: "top",
            className: "farm-map-leaflet-tooltip",
          });
          marker.on("click", () => {
            selectedSigunguRef.current = row.sigungu;
            goToStage(L, map, 3);
          });
          sigunguLayer.addLayer(marker);
          sigunguMarkersRef.current.set(key, marker);
        } else {
          marker.setLatLng([row.lat, row.lng]);
          marker.setIcon(icon);
          marker.setTooltipContent(tooltipHtml);
        }
      }
    }
    purgeMarkers(sigunguMarkersRef.current, sigunguLayer, sigunguKeys);

    const farmScope =
      sido && sigungu ? `${sido}:${sigungu}` : null;
    if (farmScopeRef.current !== farmScope) {
      for (const [, marker] of farmMarkersRef.current) {
        farmLayer.removeLayer(marker);
      }
      farmMarkersRef.current.clear();
      farmScopeRef.current = farmScope;
    }

    const farmKeys = new Set<string>();
    if (sido && sigungu) {
      const farmList = farmsInSigungu(points, sido, sigungu);
      const sigunguRow = aggregateBySigungu(points, sido).find(
        (r) => r.sigungu === sigungu
      );
      const farmCtrlSum = sumControllerCount(farmList);
      syncSigunguControllerAudit(
        sigunguRow?.controllerSum ?? null,
        showFarm ? farmCtrlSum : null
      );
      const displayCoords = spreadFarmPointsForDisplay(farmList);
      const maxFarmControllers = maxInCohort(
        farmList.map((p) => p.controllerCount)
      );
      for (const p of farmList) {
        const key = farmKeyId(p.farmKey);
        farmKeys.add(key);
        const pos = displayCoords.get(key) ?? { lat: p.lat, lng: p.lng };
        const pinMode = false;
        const spec = buildFarmMarkerIconSpec({
          point: p,
          totalControllers,
          cohortMax: maxFarmControllers,
          pinMode,
          splitNav: showFarm,
          visible: showFarm,
        });
        let marker = farmMarkersRef.current.get(key);
        const icon = L.divIcon({
          html: spec.html,
          className: "",
          iconSize: [spec.w, spec.h],
          iconAnchor: [spec.anchorX, spec.anchorY],
        });
        if (!marker) {
          marker = L.marker([pos.lat, pos.lng], {
            icon,
            farmPoint: p,
          });
          marker.bindTooltip(buildFarmTooltipHtml(p), {
            direction: "top",
            className: "farm-map-leaflet-tooltip",
          });
          farmLayer.addLayer(marker);
          farmMarkersRef.current.set(key, marker);
        } else {
          marker.setLatLng([pos.lat, pos.lng]);
          marker.setIcon(icon);
        }
      }
    }
    purgeMarkers(farmMarkersRef.current, farmLayer, farmKeys);
  }, [goToStage, onSelectSido, points, purgeMarkers, syncSigunguControllerAudit]);

  renderMarkersRef.current = renderMarkers;

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let wheelHandler: ((e: WheelEvent) => void) | null = null;
    let wheelTarget: HTMLElement | null = null;
    let farmNavClickHandler: ((e: MouseEvent) => void) | null = null;

    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current || mapRef.current) return;

      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        minZoom: 6,
        maxZoom: 16,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);

      sidoLayerRef.current = L.layerGroup().addTo(map);
      sigunguLayerRef.current = L.layerGroup().addTo(map);
      farmLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      applyViewForStage(map, 0, pointsRef.current, {
        sido: null,
        sigungu: null,
      }, { animate: false });

      const mapContainer = map.getContainer();
      wheelHandler = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        applyStageStepRef.current(e.deltaY > 0 ? "out" : "in");
      };
      wheelTarget = mapContainer;
      wheelTarget.addEventListener("wheel", wheelHandler, { passive: false });

      farmNavClickHandler = (e: MouseEvent) => {
        if (stageRef.current !== 3) return;
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const zone = target.closest("[data-farm-nav]") as HTMLElement | null;
        if (!zone) return;
        const card = zone.closest("[data-farm-key]") as HTMLElement | null;
        const keyId = card?.getAttribute("data-farm-key");
        if (!keyId) return;
        const point = pointsRef.current.find(
          (row) => farmKeyId(row.farmKey) === keyId
        );
        if (!point) return;

        e.preventDefault();
        e.stopPropagation();

        const nav = zone.getAttribute("data-farm-nav");
        if (nav === "controllers") {
          navigateToFarmControllersRef.current(point);
        } else if (nav === "alarms") {
          navigateToFarmAlarmsRef.current(point);
        }
      };
      mapContainer.addEventListener("click", farmNavClickHandler);

      map.on("zoomstart", closeAllMapTooltips);
      map.on("movestart", closeAllMapTooltips);

      map.on("zoomend", () => {
        if (
          suppressSnapRef.current ||
          stageSnapPendingRef.current ||
          internalNavRef.current
        ) {
          return;
        }

        const currentZoom = map.getZoom();
        const prevStage = stageRef.current;
        const zoomingOut = currentZoom < lastZoomRef.current;
        const zoomingIn = currentZoom > lastZoomRef.current;
        if (!zoomingIn && !zoomingOut) return;

        let detected = prevStage;
        if (zoomingOut) {
          detected = Math.max(0, prevStage - 1) as MapZoomStage;
          if (detected < 3) selectedSigunguRef.current = null;
          if (detected <= 0) selectedSidoRef.current = null;
          else if (detected === 1) selectedSidoRef.current = null;
        } else if (zoomingIn) {
          detected = Math.min(3, prevStage + 1) as MapZoomStage;
          if (detected === 2 && !selectedSidoRef.current) return;
          if (
            detected === 3 &&
            (!selectedSidoRef.current || !selectedSigunguRef.current)
          ) {
            return;
          }
        }

        if (detected === prevStage) return;

        stageRef.current = detected;
        setStage(detected);
        if (detected <= 1) onSelectSido?.(null);
        internalNavRef.current = true;
        stageSnapPendingRef.current = true;
        suppressSnapRef.current = true;
        snapToStage(map, detected);

        let released = false;
        const finishZoomSnap = () => {
          if (released) return;
          released = true;
          stageSnapPendingRef.current = false;
          suppressSnapRef.current = false;
          internalNavRef.current = false;
          lastZoomRef.current = map.getZoom();
          syncMapDebugAttrs(map);
          renderMarkersRef.current();
        };
        map.once("moveend", finishZoomSnap);
        window.setTimeout(finishZoomSnap, 500);
      });

      map.once("moveend", () => syncMapDebugAttrs(map));

      stageRef.current = 0;
      setStage(0);
      renderMarkersRef.current();

      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(containerRef.current);
      map.invalidateSize();
    }

    void init();

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (wheelHandler && wheelTarget) {
        wheelTarget.removeEventListener("wheel", wheelHandler);
      }
      if (farmNavClickHandler && wheelTarget) {
        wheelTarget.removeEventListener("click", farmNavClickHandler);
      }
      mapRef.current?.remove();
      mapRef.current = null;
      sidoLayerRef.current = null;
      sigunguLayerRef.current = null;
      farmLayerRef.current = null;
      sidoMarkersRef.current.clear();
      sigunguMarkersRef.current.clear();
      farmMarkersRef.current.clear();
      leafletRef.current = null;
    };
  }, [closeAllMapTooltips, onSelectSido, snapToStage, syncMapDebugAttrs]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (activeSido === null) {
      if (internalNavRef.current) return;
      if (stageRef.current === 0) return;
      selectedSidoRef.current = null;
      selectedSigunguRef.current = null;
      goToStage(L, map, 0);
      return;
    }

    if (internalNavRef.current) return;

    if (selectedSidoRef.current === activeSido && stageRef.current >= 2) return;

    selectedSidoRef.current = activeSido;
    selectedSigunguRef.current = null;
    goToStage(L, map, 2);
  }, [activeSido, goToStage]);

  if (points.length === 0) {
    return (
      <p
        className={cn(
          FARM_GEO_MAP_SHELL,
          "flex items-center justify-center bg-muted/30 px-5 text-center",
          dashboardUi.body,
          className
        )}
      >
        지도에 표시할 농장 위치가 없습니다. 설정 → 농장에서 주소를 등록하세요.
      </p>
    );
  }

  return (
    <div className={cn(FARM_GEO_MAP_SHELL, "relative", className)}>
      <div
        ref={containerRef}
        className="absolute inset-0 z-0"
        aria-label="전체 농장 지리 지도"
      />
      <div
        className={cn(
          "pointer-events-none absolute right-3 top-3 z-[1000] rounded-lg border border-emerald-200/80 bg-white/95 px-3 py-1.5 font-medium text-emerald-900",
          dashboardUi.tableMeta
        )}
      >
        줌 {stage + 1}/4 · {MAP_ZOOM_STAGE[stage].label} (Z{liveZoom})
      </div>
      <FarmGeoMapLegend
        stage={stage}
        sigunguControllerSum={controllerAudit?.sigungu}
        farmControllerSum={controllerAudit?.farm}
      />
    </div>
  );
}
