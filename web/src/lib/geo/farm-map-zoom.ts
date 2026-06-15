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

/** Z1/4 전국 — 본토+제주 타이트 (동해·서해·북쪽 여백 최소화) */
export const NATIONAL_VIEW_BOUNDS = {
  southWest: [33.0, 126.5] as [number, number],
  northEast: [38.05, 129.0] as [number, number],
};

/** Z1/4 고정 줌 */
export const NATIONAL_VIEW_ZOOM = 8;

export const KOREA_SOUTH_CENTER: [number, number] = [36.2, 127.8];
export const FARM_FOCUS_ZOOM = 14;

/** Z11 고정 대신 fitBounds — 군·구 단계 최대 줌 상한 */
export const SIGUNGU_VIEW_MAX_ZOOM = 12;
/** Z13 고정 대신 fitBounds — 농장 단계 최대 줌 상한 */
export const FARM_VIEW_MAX_ZOOM = 15;

export function zoomForStage(stage: MapZoomStage): number {
  return MAP_ZOOM_STAGE[stage].zoom;
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
  setView: (
    center: [number, number],
    zoom: number,
    options?: { animate?: boolean; duration?: number }
  ) => void;
};

/** Z1/4 전국 뷰 — 타이트 bounds로 중심 산출 후 Z8 고정 */
export function applyNationalView(
  map: SetViewMap,
  opts?: { animate?: boolean }
): void {
  const animate = opts?.animate ?? true;
  const bounds: [[number, number], [number, number]] = [
    NATIONAL_VIEW_BOUNDS.southWest,
    NATIONAL_VIEW_BOUNDS.northEast,
  ];

  map.fitBounds(bounds, {
    padding: [32, 32],
    maxZoom: NATIONAL_VIEW_ZOOM,
    animate: false,
  });

  const { lat, lng } = map.getCenter();
  map.setView([lat, lng], NATIONAL_VIEW_ZOOM, {
    animate,
    duration: 0.25,
  });
}

export function stageFromZoom(
  zoom: number,
  selection?: MapSelection
): MapZoomStage {
  if (selection?.sigungu) {
    if (zoom <= NATIONAL_VIEW_ZOOM) return 0;
    if (zoom <= 10) return 2;
    return 3;
  }
  if (selection?.sido) {
    if (zoom <= NATIONAL_VIEW_ZOOM) return 0;
    if (zoom <= 10) return 1;
    return 2;
  }
  if (zoom <= NATIONAL_VIEW_ZOOM) return 0;
  if (zoom <= 10) return 1;
  if (zoom <= 12) return 2;
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
  opts?: { animate?: boolean; padding?: [number, number] }
): void {
  if (farms.length === 0) return;

  const coords = farms.map((p) => {
    const d = displayCoords.get(farmKeyId(p.farmKey));
    return d ?? { lat: p.lat, lng: p.lng };
  });
  const raw = boundsForPoints(coords);
  if (!raw) return;

  map.fitBounds(expandBounds(raw, farms.length === 1 ? 0.06 : 0.04), {
    padding: opts?.padding ?? [56, 56],
    maxZoom: FARM_VIEW_MAX_ZOOM,
    animate: opts?.animate ?? true,
    duration: 0.3,
  });
}

/** Z3/4 군·구 — 해당 시·도 내 모든 클러스터가 보이도록 fitBounds (가변 줌) */
export function applySigunguView(
  map: FitBoundsMap,
  points: FarmMapPoint[],
  sido: string,
  opts?: { animate?: boolean; padding?: [number, number] }
): void {
  const inSido = points.filter((p) => p.sido === sido);
  const raw = boundsForPoints(inSido);
  if (!raw) return;

  map.fitBounds(expandBounds(raw), {
    padding: opts?.padding ?? [52, 52],
    maxZoom: SIGUNGU_VIEW_MAX_ZOOM,
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
  }
): void {
  const animate = opts?.animate ?? true;

  if (stage === 0) {
    applyNationalView(map, { animate });
    return;
  }

  if (stage === 2 && selection.sido) {
    applySigunguView(map, points, selection.sido, { animate });
    return;
  }

  if (stage === 3 && selection.sido && selection.sigungu) {
    const farms = farmsInSigungu(
      points,
      selection.sido,
      selection.sigungu
    );
    const displayCoords =
      opts?.farmDisplayCoords ?? spreadFarmPointsForDisplay(farms);
    applyFarmView(map, farms, displayCoords, { animate });
    return;
  }

  const center =
    opts?.center ??
    resolveStageAnchor(stage, map.getCenter(), points, selection);

  map.setView(center, zoomForStage(stage), {
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
