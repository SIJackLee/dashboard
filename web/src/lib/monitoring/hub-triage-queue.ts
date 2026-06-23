import type { AlarmRow } from "@/lib/data/alarms";
import type { ControllerReading } from "@/lib/data/iot";
import {
  farmKeyId,
  type FarmKey,
} from "@/lib/data/farm-key";
import {
  farmShortLabel,
  type FarmSummaryRow,
} from "@/lib/data/farm-summaries";
import {
  stallKeyFromReading,
} from "@/lib/data/reading-hierarchy";
import { normalizeStallTyCode } from "@/lib/data/stall-type";

export type WorstControllerPayload = {
  farmKey: FarmKey;
  spCode: string;
  stallKey: string;
  readingKey: string;
};

export type HubTriageFarm = {
  farmKey: FarmKey;
  farmId: string;
  label: string;
  alarmCount: number;
  rank: number;
};

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

export function buildHubTriageFarms(
  alarms: AlarmRow[],
  readings: ControllerReading[],
  farmSummaries: FarmSummaryRow[]
): HubTriageFarm[] {
  const map = new Map<
    string,
    { farmKey: FarmKey; alarmCount: number; bestAlarmRank: number; bestReadingRank: number }
  >();

  const ensure = (farmKey: FarmKey) => {
    const id = farmKeyId(farmKey);
    if (!map.has(id)) {
      map.set(id, {
        farmKey,
        alarmCount: 0,
        bestAlarmRank: 99,
        bestReadingRank: 99,
      });
    }
    return map.get(id)!;
  };

  for (const summary of farmSummaries) {
    ensure(summary.farmKey);
  }

  for (const reading of readings) {
    const row = ensure(reading.farmKey);
    row.bestReadingRank = Math.min(row.bestReadingRank, readingRank(reading));
  }

  for (const alarm of alarms) {
    const row = ensure(alarm.farmKey);
    row.alarmCount += 1;
    row.bestAlarmRank = Math.min(row.bestAlarmRank, alarmRank(alarm));
  }

  return [...map.values()]
    .filter((row) => row.alarmCount > 0 || row.bestReadingRank < 2)
    .map((row) => ({
      farmKey: row.farmKey,
      farmId: farmKeyId(row.farmKey),
      label: farmShortLabel(row.farmKey),
      alarmCount: row.alarmCount,
      rank: row.alarmCount > 0 ? row.bestAlarmRank : row.bestReadingRank + 10,
    }))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.alarmCount !== b.alarmCount) return b.alarmCount - a.alarmCount;
      return a.label.localeCompare(b.label, "ko");
    });
}

export function pickWorstControllerPayload(
  alarms: AlarmRow[],
  readings: ControllerReading[],
  farmKey: FarmKey
): WorstControllerPayload | null {
  const farmId = farmKeyId(farmKey);
  const farmAlarms = [...alarms]
    .filter((a) => farmKeyId(a.farmKey) === farmId)
    .sort((a, b) => {
      const byRank = alarmRank(a) - alarmRank(b);
      if (byRank !== 0) return byRank;
      return b.occurredAt.localeCompare(a.occurredAt);
    });

  for (const alarm of farmAlarms) {
    const reading = readings.find(
      (r) =>
        farmKeyId(r.farmKey) === farmId &&
        r.controllerKey === alarm.controllerKey
    );
    if (!reading) continue;
    const spCode = alarm.stallTyCode
      ? normalizeStallTyCode(alarm.stallTyCode)
      : normalizeStallTyCode(reading.stallTyCode);
    const stallKey =
      alarm.stallNo?.trim() || stallKeyFromReading(reading);
    return {
      farmKey,
      spCode,
      stallKey,
      readingKey: reading.key,
    };
  }

  const farmReadings = readings
    .filter((r) => farmKeyId(r.farmKey) === farmId)
    .sort((a, b) => readingRank(a) - readingRank(b));

  const reading = farmReadings[0];
  if (!reading) return null;

  return {
    farmKey,
    spCode: normalizeStallTyCode(reading.stallTyCode),
    stallKey: stallKeyFromReading(reading),
    readingKey: reading.key,
  };
}
