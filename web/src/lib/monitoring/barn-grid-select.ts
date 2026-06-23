import type { AlarmRow } from "@/lib/data/alarms";
import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import { farmKeyId } from "@/lib/data/farm-key";
import type { BarnMapSnapshot, ControllerReading } from "@/lib/data/iot";
import {
  stallKeyFromReading,
} from "@/lib/data/reading-hierarchy";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import type { ControllerSelectPayload } from "@/components/ops/hierarchy-alarm-tree";

function alarmRank(alarm: AlarmRow): number {
  if (alarm.severity === "critical") return 0;
  if (alarm.alarmType === "통신 두절") return 2;
  return 1;
}

function readingRank(reading: ControllerReading): number {
  if (reading.status === "offline") return 0;
  if (reading.status === "caution") return 1;
  return 2;
}

export function readingsForBarnSnapshot(
  snapshot: BarnMapSnapshot,
  readings: ControllerReading[]
): ControllerReading[] {
  const entry = parseBarnCatalogKey(snapshot.meta.id);
  if (!entry) return [];
  const ty = normalizeStallTyCode(entry.stallTyCode);
  return readings.filter(
    (r) =>
      farmKeyId(r.farmKey) === farmKeyId(entry.farmKey) &&
      r.moduleUid === entry.moduleUid &&
      normalizeStallTyCode(r.stallTyCode) === ty
  );
}

export function pickControllerForBarn(
  snapshot: BarnMapSnapshot,
  readings: ControllerReading[],
  alarms: AlarmRow[]
): ControllerSelectPayload | null {
  const entry = parseBarnCatalogKey(snapshot.meta.id);
  if (!entry) return null;

  const scope = readingsForBarnSnapshot(snapshot, readings);
  if (scope.length === 0) return null;

  const farmId = farmKeyId(entry.farmKey);
  const spAlarms = alarms
    .filter(
      (a) =>
        farmKeyId(a.farmKey) === farmId &&
        normalizeStallTyCode(a.stallTyCode) === normalizeStallTyCode(entry.stallTyCode)
    )
    .sort((a, b) => {
      const byRank = alarmRank(a) - alarmRank(b);
      if (byRank !== 0) return byRank;
      return b.occurredAt.localeCompare(a.occurredAt);
    });

  for (const alarm of spAlarms) {
    const reading = scope.find((r) => r.controllerKey === alarm.controllerKey);
    if (!reading) continue;
    return {
      farmKey: entry.farmKey,
      spCode: normalizeStallTyCode(entry.stallTyCode),
      stallKey: alarm.stallNo?.trim() || stallKeyFromReading(reading),
      readingKey: reading.key,
    };
  }

  const reading = [...scope].sort((a, b) => readingRank(a) - readingRank(b))[0];
  return {
    farmKey: entry.farmKey,
    spCode: normalizeStallTyCode(entry.stallTyCode),
    stallKey: stallKeyFromReading(reading),
    readingKey: reading.key,
  };
}

export function barnCatalogKeyForSelection(
  snapshot: BarnMapSnapshot
): string | null {
  return snapshot.meta.id;
}

export function isBarnSelected(
  snapshot: BarnMapSnapshot,
  spCode: string,
  farmId: string
): boolean {
  const entry = parseBarnCatalogKey(snapshot.meta.id);
  if (!entry) return false;
  return (
    farmKeyId(entry.farmKey) === farmId &&
    normalizeStallTyCode(entry.stallTyCode) === normalizeStallTyCode(spCode)
  );
}
