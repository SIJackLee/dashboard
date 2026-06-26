import type { FarmLocationRow } from "@/lib/data/farm-location";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { isFarmHealthy } from "@/lib/data/farm-summaries";

export type FarmMapPoint = {
  farmKey: FarmKey;
  label: string;
  lat: number;
  lng: number;
  sido: string;
  sigungu: string;
  lsindRegistNo: string;
  itemCode: string;
  controllerCount: number;
  alarmCount: number;
  criticalCount: number;
  offlineCount: number;
  healthy: boolean;
};

export type SidoClusterSummary = {
  sido: string;
  farmCount: number;
  controllerCount: number;
  alarmCount: number;
  issueCount: number;
  farms: FarmMapPoint[];
};

export function buildFarmMapPoints(
  farms: FarmSummaryRow[],
  locations: FarmLocationRow[],
  labelFn: (farm: FarmSummaryRow) => string
): FarmMapPoint[] {
  const locById = new Map(
    locations.map((l) => [farmKeyId(l.farmKey), l] as const)
  );
  const points: FarmMapPoint[] = [];

  for (const farm of farms) {
    const loc = locById.get(farmKeyId(farm.farmKey));
    if (!loc) continue;
    points.push({
      farmKey: farm.farmKey,
      label: labelFn(farm),
      lat: Number(loc.lat),
      lng: Number(loc.lng),
      sido: loc.sido,
      sigungu: loc.sigungu,
      lsindRegistNo: farm.farmKey.lsindRegistNo,
      itemCode: farm.farmKey.itemCode,
      controllerCount: farm.controllerCount,
      alarmCount: farm.alarmCount,
      criticalCount: farm.criticalCount,
      offlineCount: farm.offlineCount,
      healthy: isFarmHealthy(farm),
    });
  }

  return points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

/** Farmer scoped map — location만 있어도 pin 생성 */
export function farmMapPointFromLocation(
  location: FarmLocationRow,
  label: string,
  summary?: Pick<
    FarmSummaryRow,
    "controllerCount" | "alarmCount" | "criticalCount" | "offlineCount"
  >
): FarmMapPoint {
  const controllerCount = summary?.controllerCount ?? 0;
  const alarmCount = summary?.alarmCount ?? 0;
  const criticalCount = summary?.criticalCount ?? 0;
  const offlineCount = summary?.offlineCount ?? 0;
  const healthy =
    controllerCount === 0 ||
    (offlineCount === 0 && alarmCount === 0 && criticalCount === 0);

  return {
    farmKey: location.farmKey,
    label,
    lat: Number(location.lat),
    lng: Number(location.lng),
    sido: location.sido,
    sigungu: location.sigungu,
    lsindRegistNo: location.farmKey.lsindRegistNo,
    itemCode: location.farmKey.itemCode,
    controllerCount,
    alarmCount,
    criticalCount,
    offlineCount,
    healthy,
  };
}

export function clusterBySido(points: FarmMapPoint[]): SidoClusterSummary[] {
  const map = new Map<string, SidoClusterSummary>();

  for (const p of points) {
    let row = map.get(p.sido);
    if (!row) {
      row = {
        sido: p.sido,
        farmCount: 0,
        controllerCount: 0,
        alarmCount: 0,
        issueCount: 0,
        farms: [],
      };
      map.set(p.sido, row);
    }
    row.farmCount += 1;
    row.controllerCount += p.controllerCount;
    row.alarmCount += p.alarmCount;
    if (!p.healthy) row.issueCount += 1;
    row.farms.push(p);
  }

  return [...map.values()].sort((a, b) => {
    if (b.alarmCount !== a.alarmCount) return b.alarmCount - a.alarmCount;
    return a.sido.localeCompare(b.sido, "ko");
  });
}

export function pointsWithoutLocation(
  farms: FarmSummaryRow[],
  locations: FarmLocationRow[]
): FarmSummaryRow[] {
  const located = new Set(locations.map((l) => farmKeyId(l.farmKey)));
  return farms.filter((f) => !located.has(farmKeyId(f.farmKey)));
}
