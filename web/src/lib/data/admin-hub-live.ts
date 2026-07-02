import "server-only";

import type { AlarmRow } from "@/lib/data/alarms";
import { compareFarmKey, farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import type { FarmLocationRow } from "@/lib/data/farm-location";
import { buildFarmSummaries, type FarmSummaryRow } from "@/lib/data/farm-summaries";
import { buildFarmSummariesFromOverview } from "@/lib/data/farm-overview";
import type { BarnReading } from "@/lib/data/iot";
import {
  fetchFarmOverviewRows,
  fetchLiveReadings,
  type FarmOverviewDbRow,
} from "@/lib/data/iot-live-fetch";

const ADMIN_HUB_MAX_FARMS = 20;

/** dev sim_fleet 기본 농장 — global overview/LIVE 타임아웃 시 seed */
export function devSimFarmKeys(): FarmKey[] {
  return Array.from({ length: 10 }, (_, i) => ({
    lsindRegistNo: `FARM${String(i + 1).padStart(2, "0")}`,
    itemCode: "P00",
  }));
}

export function overviewRowsToFarmKeys(rows: FarmOverviewDbRow[]): FarmKey[] {
  return rows.map((r) => ({
    lsindRegistNo: r.lsind_regist_no,
    itemCode: r.item_code,
  }));
}

/** Admin 허브 farm key — overview · location · dev sim 순 */
export function discoverAdminHubFarmKeys(
  locations: Pick<FarmLocationRow, "farmKey">[],
  farmOptions: FarmKey[]
): FarmKey[] {
  const map = new Map<string, FarmKey>();
  for (const fk of farmOptions) map.set(farmKeyId(fk), fk);
  for (const loc of locations) map.set(farmKeyId(loc.farmKey), loc.farmKey);
  if (map.size > 0) return [...map.values()].sort(compareFarmKey);
  if (process.env.NODE_ENV === "development") return devSimFarmKeys();
  return [];
}

/**
 * Admin 허브 LIVE readings.
 * global `getLiveReadings({})`는 RLS 하에서 statement timeout → farm-scoped 병렬 조회.
 */
export async function fetchAdminHubLiveReadings(
  activeFarmKey: FarmKey | null,
  farmKeys: FarmKey[]
): Promise<BarnReading[]> {
  if (activeFarmKey) {
    return fetchLiveReadings({ farmKey: activeFarmKey });
  }
  const keys = farmKeys.slice(0, ADMIN_HUB_MAX_FARMS);
  if (keys.length === 0) return [];
  const batches = await Promise.all(
    keys.map((farmKey) => fetchLiveReadings({ farmKey }))
  );
  return batches.flat();
}

/** overview view 실패 시 LIVE readings 집계로 farmSummaries 대체 */
export function resolveAdminHubFarmSummaries(
  readings: BarnReading[],
  alarms: AlarmRow[],
  overviewRows: FarmOverviewDbRow[]
): FarmSummaryRow[] {
  if (overviewRows.length > 0) {
    return buildFarmSummariesFromOverview(overviewRows);
  }
  if (readings.length > 0) {
    return buildFarmSummaries(readings, alarms);
  }
  return [];
}

export async function loadAdminHubOverviewRows(): Promise<FarmOverviewDbRow[]> {
  try {
    return await fetchFarmOverviewRows();
  } catch {
    return [];
  }
}
