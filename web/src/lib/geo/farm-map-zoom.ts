import type { FarmMapPoint } from "@/lib/data/farm-geo-summary";
import { farmKeyId } from "@/lib/data/farm-key";

/** 4단계 줌: 0=전국 · 1=시·도 · 2=군·구 · 3=농장 */
export type MapZoomStage = 0 | 1 | 2 | 3;

export type MapSelection = {
  sido: string | null;
  sigungu: string | null;
};

export const MAP_ZOOM_STAGE = {
  0: { zoom: 8, label: "전국", marker: "sido" as const },
  1: { zoom: 9, label: "시·도", marker: "sido" as const },
  2: { zoom: 11, label: "시·군·구", marker: "sigungu" as const },
  3: { zoom: 13, label: "농장", marker: "farm" as const },
} as const;

/** 남한 전역 (레거시·참조) */
export const KOREA_SOUTH_BOUNDS = {
  southWest: [33.0, 124.6] as [number, number],
  northEast: [38.8, 131.2] as [number, number],
};

/** Z1/4 전국 — 본토+제주 (제주 남서단 포함) */
export const NATIONAL_VIEW_BOUNDS = {
  southWest: [32.7, 125.5] as [number, number],
  northEast: [38.05, 129.0] as [number, number],
};

/** Z1/4 고정 줌 (레거시·기본 참조) */
export const NATIONAL_VIEW_ZOOM = 8;

/** 줌·패딩 보정 기준 컨테이너 짧은 변 (px) */
export const MAP_VIEWPORT_REFERENCE_PX = 720;

export type MapViewportContext = {
  sizePx: number;
};

/** Leaflet 컨테이너 짧은 변 */
export function mapViewportSize(container: {
  clientWidth: number;
  clientHeight: number;
}): number {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w <= 0 || h <= 0) return MAP_VIEWPORT_REFERENCE_PX;
  return Math.min(w, h);
}

/** 작은 정사각형 허브 지도일수록 줌 아웃(음수 오프셋) */
export function viewportZoomOffset(sizePx: number): number {
  if (sizePx < 400) return -2;
  if (sizePx < 560) return -1;
  if (sizePx > 960) return 1;
  if (sizePx > 1200) return 2;
  return 0;
}

export function fitPaddingForViewport(sizePx: number): [number, number] {
  const pad = Math.round(Math.max(16, Math.min(52, sizePx * 0.07)));
  return [pad, pad];
}

export function nationalFitPadding(sizePx: number): [number, number] {
  const pad = Math.round(Math.max(10, Math.min(32, sizePx * 0.045)));
  return [pad, pad];
}

export function spreadRadiusForViewport(sizePx: number): number {
  const offset = viewportZoomOffset(sizePx);
  const base = 0.012;
  return base * Math.pow(0.82, -offset);
}

export function zoomForStage(
  stage: MapZoomStage,
  viewport?: MapViewportContext
): number {
  const base = MAP_ZOOM_STAGE[stage].zoom;
  if (!viewport) return base;
  const offset = viewportZoomOffset(viewport.sizePx);
  const floor: Record<MapZoomStage, number> = { 0: 6, 1: 7, 2: 9, 3: 11 };
  const cap: Record<MapZoomStage, number> = { 0: 9, 1: 10, 2: 12, 3: 14 };
  return Math.max(floor[stage], Math.min(cap[stage], base + offset));
}

export const KOREA_SOUTH_CENTER: [number, number] = [36.2, 127.8];
export const FARM_FOCUS_ZOOM = 14;

/** Z11 고정 대신 fitBounds — 군·구 단계 최대 줌 상한 */
export const SIGUNGU_VIEW_MAX_ZOOM = 12;
/** Z13 고정 대신 fitBounds — 농장 단계 최대 줌 상한 */
export const FARM_VIEW_MAX_ZOOM = 15;

export function nationalMaxZoomForViewport(sizePx: number): number {
  return zoomForStage(0, { sizePx });
}

/** 허브 정사각형 등 컨테이너별 전국 단계 목표 줌 */
export function nationalTargetZoomForViewport(sizePx: number): number {
  if (sizePx < 360) return 5;
  if (sizePx < 420) return 6;
  if (sizePx < 640) return 7;
  if (sizePx < 900) return 8;
  return 8;
}

export function sigunguMaxZoomForViewport(sizePx: number): number {
  return Math.max(
    9,
    Math.min(SIGUNGU_VIEW_MAX_ZOOM, SIGUNGU_VIEW_MAX_ZOOM + viewportZoomOffset(sizePx))
  );
}

export function farmMaxZoomForViewport(sizePx: number): number {
  return Math.max(
    12,
    Math.min(FARM_VIEW_MAX_ZOOM, FARM_VIEW_MAX_ZOOM + viewportZoomOffset(sizePx))
  );
}

export function nationalZoomThreshold(viewport?: MapViewportContext): number {
  return viewport
    ? nationalTargetZoomForViewport(viewport.sizePx)
    : NATIONAL_VIEW_ZOOM;
}

type FitBoundsMap = {
  fitBounds: (
    bounds: [[number, number], [number, number]],
    options?: {
      padding?: [number, number];
      maxZoom?: number;
      animate?: boolean;
      duration?: number;
    }
  ) => void;
};

type SetViewMap = FitBoundsMap & {
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  setView: (
    center: [number, number],
    zoom: number,
    options?: { animate?: boolean; duration?: number }
  ) => void;
};

/** Z1/4 전국 뷰 — 컨테이너 크기에 맞춰 fitBounds 줌 사용 */
export function applyNationalView(
  map: SetViewMap,
  opts?: { animate?: boolean; viewport?: MapViewportContext }
): void {
  const animate = opts?.animate ?? true;
  const sizePx = opts?.viewport?.sizePx ?? MAP_VIEWPORT_REFERENCE_PX;
  const targetZoom = nationalTargetZoomForViewport(sizePx);
  const bounds: [[number, number], [number, number]] = [
    NATIONAL_VIEW_BOUNDS.southWest,
    NATIONAL_VIEW_BOUNDS.northEast,
  ];

  map.fitBounds(bounds, {
    padding: nationalFitPadding(sizePx),
    maxZoom: targetZoom,
    animate: false,
  });

  const { lat, lng } = map.getCenter();
  const fittedZoom = map.getZoom();
  map.setView([lat, lng], Math.max(fittedZoom, targetZoom), {
    animate,
    duration: 0.25,
  });
}

export function stageFromZoom(
  zoom: number,
  selection?: MapSelection,
  viewport?: MapViewportContext
): MapZoomStage {
  const z0 = nationalZoomThreshold(viewport);
  const z1 = zoomForStage(1, viewport);
  const z2 = sigunguMaxZoomForViewport(viewport?.sizePx ?? MAP_VIEWPORT_REFERENCE_PX);

  if (selection?.sigungu) {
    if (zoom <= z0) return 0;
    if (zoom <= z1 + 1) return 2;
    return 3;
  }
  if (selection?.sido) {
    if (zoom <= z0) return 0;
    if (zoom <= z1) return 1;
    return 2;
  }
  if (zoom <= z0) return 0;
  if (zoom <= z1) return 1;
  if (zoom <= z2) return 2;
  return 3;
}

export function shortSidoLabel(sido: string): string {
  return sido.replace(/특별자치도|특별자치시|광역시|도$/g, "");
}

export type SidoMarkerData = {
  sido: string;
  lat: number;
  lng: number;
  farmCount: number;
  controllerSum: number;
  alarmSum: number;
  criticalSum: number;
  offlineSum: number;
  issueCount: number;
};

export type SigunguMarkerData = {
  sido: string;
  sigungu: string;
  lat: number;
  lng: number;
  farmCount: number;
  controllerSum: number;
  alarmSum: number;
  criticalSum: number;
  offlineSum: number;
  issueCount: number;
};

function centroid(points: FarmMapPoint[]): { lat: number; lng: number } {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

export function aggregateBySido(points: FarmMapPoint[]): SidoMarkerData[] {
  const map = new Map<string, FarmMapPoint[]>();
  for (const p of points) {
    const list = map.get(p.sido) ?? [];
    list.push(p);
    map.set(p.sido, list);
  }

  return [...map.entries()]
    .map(([sido, farms]) => {
      const { lat, lng } = centroid(farms);
      return {
        sido,
        lat,
        lng,
        farmCount: farms.length,
        controllerSum: farms.reduce((n, f) => n + f.controllerCount, 0),
        alarmSum: farms.reduce((n, f) => n + f.alarmCount, 0),
        criticalSum: farms.reduce((n, f) => n + f.criticalCount, 0),
        offlineSum: farms.reduce((n, f) => n + f.offlineCount, 0),
        issueCount: farms.filter((f) => !f.healthy).length,
      };
    })
    .sort((a, b) => b.alarmSum - a.alarmSum || a.sido.localeCompare(b.sido, "ko"));
}

export function aggregateBySigungu(
  points: FarmMapPoint[],
  sido: string
): SigunguMarkerData[] {
  const map = new Map<string, FarmMapPoint[]>();
  for (const p of points) {
    if (p.sido !== sido) continue;
    const key = p.sigungu;
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }

  return [...map.entries()]
    .map(([sigungu, farms]) => {
      const { lat, lng } = centroid(farms);
      return {
        sido,
        sigungu,
        lat,
        lng,
        farmCount: farms.length,
        controllerSum: farms.reduce((n, f) => n + f.controllerCount, 0),
        alarmSum: farms.reduce((n, f) => n + f.alarmCount, 0),
        criticalSum: farms.reduce((n, f) => n + f.criticalCount, 0),
        offlineSum: farms.reduce((n, f) => n + f.offlineCount, 0),
        issueCount: farms.filter((f) => !f.healthy).length,
      };
    })
    .sort(
      (a, b) =>
        b.alarmSum - a.alarmSum || a.sigungu.localeCompare(b.sigungu, "ko")
    );
}

export function farmsInSigungu(
  points: FarmMapPoint[],
  sido: string,
  sigungu: string
): FarmMapPoint[] {
  return points.filter((p) => p.sido === sido && p.sigungu === sigungu);
}

export function boundsForPoints(
  points: Pick<FarmMapPoint, "lat" | "lng">[]
): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;
  let minLat = points[0]!.lat;
  let maxLat = points[0]!.lat;
  let minLng = points[0]!.lng;
  let maxLng = points[0]!.lng;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

export function expandBounds(
  bounds: [[number, number], [number, number]],
  minSpanDeg = 0.12
): [[number, number], [number, number]] {
  const [[minLat, minLng], [maxLat, maxLng]] = bounds;
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const latPad = Math.max(0, (minSpanDeg - latSpan) / 2);
  const lngPad = Math.max(0, (minSpanDeg - lngSpan) / 2);
  return [
    [minLat - latPad, minLng - lngPad],
    [maxLat + latPad, maxLng + lngPad],
  ];
}

export function sumControllerCount(
  points: Pick<FarmMapPoint, "controllerCount">[]
): number {
  return points.reduce((s, p) => s + p.controllerCount, 0);
}

/** 군·구 내 농장 — 중심 기준 원형 배치 (Z4 전 농장·전 컨트롤러 수 가시화) */
export function spreadFarmPointsForDisplay(
  farms: FarmMapPoint[],
  opts?: { radiusDeg?: number }
): Map<string, { lat: number; lng: number }> {
  const out = new Map<string, { lat: number; lng: number }>();
  if (farms.length === 0) return out;

  if (farms.length === 1) {
    const p = farms[0]!;
    out.set(farmKeyId(p.farmKey), { lat: p.lat, lng: p.lng });
    return out;
  }

  const centerLat = farms.reduce((s, p) => s + p.lat, 0) / farms.length;
  const centerLng = farms.reduce((s, p) => s + p.lng, 0) / farms.length;
  const baseRadius = opts?.radiusDeg ?? 0.012;
  const radius = Math.max(baseRadius, 0.008 + farms.length * 0.002);
  const sorted = [...farms].sort((a, b) =>
    farmKeyId(a.farmKey).localeCompare(farmKeyId(b.farmKey))
  );

  sorted.forEach((p, i) => {
    const angle = (2 * Math.PI * i) / sorted.length - Math.PI / 2;
    out.set(farmKeyId(p.farmKey), {
      lat: centerLat + radius * Math.sin(angle),
      lng: centerLng + radius * Math.cos(angle),
    });
  });
  return out;
}

/** Z4/4 농장 — 군·구 내 모든 농장 마커가 보이도록 fitBounds (가변 줌) */
export function applyFarmView(
  map: FitBoundsMap,
  farms: FarmMapPoint[],
  displayCoords: Map<string, { lat: number; lng: number }>,
  opts?: {
    animate?: boolean;
    padding?: [number, number];
    viewport?: MapViewportContext;
  }
): void {
  if (farms.length === 0) return;

  const sizePx = opts?.viewport?.sizePx ?? MAP_VIEWPORT_REFERENCE_PX;
  const coords = farms.map((p) => {
    const d = displayCoords.get(farmKeyId(p.farmKey));
    return d ?? { lat: p.lat, lng: p.lng };
  });
  const raw = boundsForPoints(coords);
  if (!raw) return;

  map.fitBounds(expandBounds(raw, farms.length === 1 ? 0.06 : 0.04), {
    padding: opts?.padding ?? fitPaddingForViewport(sizePx),
    maxZoom: farmMaxZoomForViewport(sizePx),
    animate: opts?.animate ?? true,
    duration: 0.3,
  });
}

/** Z3/4 군·구 — 해당 시·도 내 모든 클러스터가 보이도록 fitBounds (가변 줌) */
export function applySigunguView(
  map: FitBoundsMap,
  points: FarmMapPoint[],
  sido: string,
  opts?: {
    animate?: boolean;
    padding?: [number, number];
    viewport?: MapViewportContext;
  }
): void {
  const sizePx = opts?.viewport?.sizePx ?? MAP_VIEWPORT_REFERENCE_PX;
  const inSido = points.filter((p) => p.sido === sido);
  const raw = boundsForPoints(inSido);
  if (!raw) return;

  map.fitBounds(expandBounds(raw), {
    padding: opts?.padding ?? fitPaddingForViewport(sizePx),
    maxZoom: sigunguMaxZoomForViewport(sizePx),
    animate: opts?.animate ?? true,
    duration: 0.3,
  });
}

/** 단계별 지도 뷰 — Z3/4·Z4/4 fitBounds, 나머지는 고정 줌 */
export function applyViewForStage(
  map: SetViewMap,
  stage: MapZoomStage,
  points: FarmMapPoint[],
  selection: MapSelection,
  opts?: {
    center?: [number, number];
    animate?: boolean;
    farmDisplayCoords?: Map<string, { lat: number; lng: number }>;
    viewport?: MapViewportContext;
  }
): void {
  const animate = opts?.animate ?? true;
  const viewport = opts?.viewport;

  if (stage === 0) {
    applyNationalView(map, { animate, viewport });
    return;
  }

  if (stage === 2 && selection.sido) {
    applySigunguView(map, points, selection.sido, { animate, viewport });
    return;
  }

  if (stage === 3 && selection.sido && selection.sigungu) {
    const farms = farmsInSigungu(
      points,
      selection.sido,
      selection.sigungu
    );
    const sizePx = viewport?.sizePx ?? MAP_VIEWPORT_REFERENCE_PX;
    const displayCoords =
      opts?.farmDisplayCoords ??
      spreadFarmPointsForDisplay(farms, {
        radiusDeg: spreadRadiusForViewport(sizePx),
      });
    applyFarmView(map, farms, displayCoords, { animate, viewport });
    return;
  }

  const center =
    opts?.center ??
    resolveStageAnchor(stage, map.getCenter(), points, selection);

  map.setView(center, zoomForStage(stage, viewport), {
    animate,
    duration: 0.25,
  });
}

type LatLngLike = { lat: number; lng: number };

function distSq(a: LatLngLike, b: LatLngLike): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

/** 뷰포트 중심에 가장 가까운 클러스터 좌표 (줌 앵커) */
export function nearestClusterCenter(
  viewportCenter: LatLngLike,
  candidates: LatLngLike[]
): [number, number] {
  if (candidates.length === 0) {
    return [KOREA_SOUTH_CENTER[0], KOREA_SOUTH_CENTER[1]];
  }
  let best = candidates[0]!;
  let bestD = distSq(viewportCenter, best);
  for (const c of candidates.slice(1)) {
    const d = distSq(viewportCenter, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return [best.lat, best.lng];
}

/** 단계별 표시 클러스터 중 뷰포트 중앙에 가장 가까운 좌표 (Z8 전국은 고정 뷰) */
export function resolveStageAnchor(
  stage: MapZoomStage,
  viewportCenter: LatLngLike,
  points: FarmMapPoint[],
  selection: { sido: string | null; sigungu: string | null }
): [number, number] {
  if (stage === 0) {
    return [KOREA_SOUTH_CENTER[0], KOREA_SOUTH_CENTER[1]];
  }
  if (stage === 1) {
    return nearestClusterCenter(viewportCenter, aggregateBySido(points));
  }
  if (stage === 2) {
    if (selection.sido) {
      return nearestClusterCenter(
        viewportCenter,
        aggregateBySigungu(points, selection.sido)
      );
    }
    return nearestClusterCenter(viewportCenter, aggregateBySido(points));
  }
  if (selection.sido && selection.sigungu) {
    return nearestClusterCenter(
      viewportCenter,
      farmsInSigungu(points, selection.sido, selection.sigungu)
    );
  }
  return [KOREA_SOUTH_CENTER[0], KOREA_SOUTH_CENTER[1]];
}
