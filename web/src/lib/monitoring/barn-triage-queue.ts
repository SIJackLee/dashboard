import type { AlarmRow } from "@/lib/data/alarms";
import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import { farmKeyId } from "@/lib/data/farm-key";
import type { BarnMapSnapshot, ControllerReading } from "@/lib/data/iot";
import { formatStallTypeLabel, normalizeStallTyCode } from "@/lib/data/stall-type";
import { readingsForBarnSnapshot } from "@/lib/monitoring/barn-grid-select";

export type BarnTriageItem = {
  catalogKey: string;
  snapshot: BarnMapSnapshot;
  label: string;
  alarmCount: number;
  rank: number;
};

function statusRank(status: BarnMapSnapshot["status"]): number {
  if (status === "offline") return 0;
  if (status === "caution") return 1;
  return 2;
}

function barnTriageItemFromSnapshot(
  snapshot: BarnMapSnapshot,
  alarms: AlarmRow[],
  readings: ControllerReading[]
): BarnTriageItem {
  const entry = parseBarnCatalogKey(snapshot.meta.id);
  const scope = readingsForBarnSnapshot(snapshot, readings);
  const farmId = entry ? farmKeyId(entry.farmKey) : "";
  const spCode = entry ? normalizeStallTyCode(entry.stallTyCode) : "";
  const alarmCount = alarms.filter(
    (a) =>
      farmKeyId(a.farmKey) === farmId &&
      normalizeStallTyCode(a.stallTyCode) === spCode
  ).length;
  const rank =
    alarmCount > 0
      ? 0
      : statusRank(snapshot.status) +
        (scope.some((r) => r.status !== "normal") ? 0 : 10);

  return {
    catalogKey: snapshot.meta.id,
    snapshot,
    label: entry ? formatStallTypeLabel(spCode) : snapshot.meta.name,
    alarmCount,
    rank,
  };
}

function sortSnapshotsByGrid(
  snapshots: BarnMapSnapshot[]
): BarnMapSnapshot[] {
  return [...snapshots].sort((a, b) => {
    const rowDiff = a.meta.grid.row - b.meta.grid.row;
    if (rowDiff !== 0) return rowDiff;
    return a.meta.grid.col - b.meta.grid.col;
  });
}

/** 이상·오프라인 우선 — 초기 자동 선택용 */
export function buildBarnTriageQueue(
  snapshots: BarnMapSnapshot[],
  alarms: AlarmRow[],
  readings: ControllerReading[]
): BarnTriageItem[] {
  return snapshots
    .map((snapshot) => barnTriageItemFromSnapshot(snapshot, alarms, readings))
    .filter((item) => item.rank < 10 || item.alarmCount > 0)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.alarmCount !== b.alarmCount) return b.alarmCount - a.alarmCount;
      return a.label.localeCompare(b.label, "ko");
    });
}

/** 그리드 순서 1→N — 좌우 flick·prev/next 일관 경로 */
export function buildBarnNavQueue(
  snapshots: BarnMapSnapshot[],
  alarms: AlarmRow[],
  readings: ControllerReading[]
): BarnTriageItem[] {
  return sortSnapshotsByGrid(snapshots).map((snapshot) =>
    barnTriageItemFromSnapshot(snapshot, alarms, readings)
  );
}
