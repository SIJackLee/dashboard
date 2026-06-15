import type { FarmMapPoint } from "@/lib/data/farm-geo-summary";
import { farmKeyId } from "@/lib/data/farm-key";
import type { MapZoomStage } from "@/lib/geo/farm-map-zoom";

/** 06 · 임계값 펄스 */
export const PULSE_ALARM_THRESHOLD = 16;

/** 위험도 4단계 — normal · caution · warning · critical */
export type MapRiskLevel = "normal" | "caution" | "warning" | "critical";

export const RISK_STYLE: Record<
  MapRiskLevel,
  { fill: string; border: string; text: string; bgAlpha: number }
> = {
  normal: { fill: "#059669", border: "#047857", text: "#ffffff", bgAlpha: 0.42 },
  caution: { fill: "#ca8a04", border: "#a16207", text: "#ffffff", bgAlpha: 0.48 },
  warning: { fill: "#d97706", border: "#b45309", text: "#ffffff", bgAlpha: 0.52 },
  critical: { fill: "#dc2626", border: "#b91c1c", text: "#ffffff", bgAlpha: 0.58 },
};

const STAGE_BOUNDS: Record<
  MapZoomStage,
  { min: number; max: number; fontMin: number; fontMax: number; labelMin: number; labelMax: number }
> = {
  0: { min: 22, max: 58, fontMin: 9, fontMax: 16, labelMin: 7, labelMax: 10 },
  1: { min: 28, max: 64, fontMin: 10, fontMax: 17, labelMin: 8, labelMax: 11 },
  2: { min: 24, max: 56, fontMin: 9, fontMax: 16, labelMin: 8, labelMax: 10 },
  3: { min: 22, max: 52, fontMin: 8, fontMax: 14, labelMin: 7, labelMax: 9 },
};

export function totalControllerCount(points: FarmMapPoint[]): number {
  return points.reduce((s, p) => s + p.controllerCount, 0);
}

export function maxFarmControllerCount(points: FarmMapPoint[]): number {
  return points.reduce((m, p) => Math.max(m, p.controllerCount), 1);
}

/** 동일 줌 단계 내 최대 지역 컨트롤러 수 (크기 정규화용) */
export function maxInCohort(values: number[]): number {
  if (values.length === 0) return 1;
  return Math.max(...values, 1);
}

/**
 * 전체 대비 지역 컨트롤러 비율 → 마커 반경·글자 크기.
 * cohortMax: 현재 단계 마커 중 최대 지역 컨트롤러 수 — 전체 대비 비율을 화면 크기 범위에 선형 매핑.
 */
export function scaledMarkerMetrics(
  regionalControllerCount: number,
  totalControllerCount: number,
  stage: MapZoomStage,
  cohortMax?: number
): { size: number; fontSize: number; labelSize: number; shareOfTotal: number } {
  const b = STAGE_BOUNDS[stage];
  const total = Math.max(totalControllerCount, 1);
  const maxRegional = Math.max(cohortMax ?? total, 1);
  const shareOfTotal = regionalControllerCount / total;
  const maxShareOfTotal = maxRegional / total;
  const t = Math.min(
    1,
    maxShareOfTotal > 0 ? shareOfTotal / maxShareOfTotal : 0
  );
  return {
    size: Math.round(b.min + (b.max - b.min) * t),
    fontSize: Math.round((b.fontMin + (b.fontMax - b.fontMin) * t) * 10) / 10,
    labelSize: Math.round((b.labelMin + (b.labelMax - b.labelMin) * t) * 10) / 10,
    shareOfTotal,
  };
}

export function regionRiskLevel(opts: {
  alarmSum: number;
  criticalSum: number;
  issueCount: number;
  offlineSum: number;
}): MapRiskLevel {
  const { alarmSum, criticalSum, issueCount, offlineSum } = opts;
  if (criticalSum > 0 || alarmSum >= PULSE_ALARM_THRESHOLD * 2) return "critical";
  if (alarmSum > 0) return "warning";
  if (offlineSum > 0 || issueCount > 0) return "caution";
  return "normal";
}

export function farmRiskLevel(point: FarmMapPoint): MapRiskLevel {
  if (point.criticalCount > 0 || point.alarmCount >= PULSE_ALARM_THRESHOLD) {
    return "critical";
  }
  if (point.alarmCount > 0) return "warning";
  if (point.offlineCount > 0 || !point.healthy) return "caution";
  return "normal";
}

/** Z13 — 좌표 근접 시 핀(컴팩트) 모드 */
export function detectOverlappingFarmIds(
  farms: FarmMapPoint[],
  thresholdDeg = 0.012
): Set<string> {
  const overlap = new Set<string>();
  const th2 = thresholdDeg * thresholdDeg;
  for (let i = 0; i < farms.length; i++) {
    for (let j = i + 1; j < farms.length; j++) {
      const a = farms[i]!;
      const b = farms[j]!;
      const dLat = a.lat - b.lat;
      const dLng = a.lng - b.lng;
      if (dLat * dLat + dLng * dLng < th2) {
        overlap.add(farmKeyId(a.farmKey));
        overlap.add(farmKeyId(b.farmKey));
      }
    }
  }
  return overlap;
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
