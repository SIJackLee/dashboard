import "server-only";

import { cache } from "react";
import {
  adminHubOverviewCacheKey,
  devSimFarmKeys,
  discoverAdminHubFarmKeys,
  loadAdminHubOverviewRows,
  overviewRowsToFarmKeys,
  resolveAdminHubFarmSummaries,
} from "@/lib/data/admin-hub-live";
import type { FarmOverviewDbRow } from "@/lib/data/iot-live-fetch";
import type { FarmKey } from "@/lib/data/farm-key";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import type { FarmOverview } from "@/lib/data/iot";

export type AdminHubOverviewContext = {
  overview: FarmOverview;
  farmOptions: FarmKey[];
  farmSummaries: FarmSummaryRow[];
};

function overviewFromRows(overviewRows: FarmOverviewDbRow[]): FarmOverview {
  const totalControllers = overviewRows.reduce(
    (s, r) => s + r.controller_count,
    0,
  );
  const totalOffline = overviewRows.reduce(
    (s, r) => s + r.offline_count,
    0,
  );
  const temps = overviewRows
    .map((r) => (r.avg_temp_c != null ? Number(r.avg_temp_c) : null))
    .filter((n): n is number => n != null);
  const humidities = overviewRows
    .map((r) =>
      r.avg_humidity_pct != null ? Number(r.avg_humidity_pct) : null,
    )
    .filter((n): n is number => n != null);

  const avg = (nums: number[]) =>
    nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;

  return {
    farmCount: overviewRows.length,
    moduleCount: 0,
    controllerCount: totalControllers,
    connectedCount: totalControllers - totalOffline,
    expectedControllerCount: totalControllers,
    offlineCount: totalOffline,
    avgTempC: avg(temps),
    avgHumidityPct: avg(humidities),
    avgFanSupply: null,
    avgFanExhaust: null,
    avgFanIntake: null,
    receipts: [],
  };
}

function emptyHubOverview(farmCount: number): FarmOverview {
  return {
    farmCount,
    moduleCount: 0,
    controllerCount: 0,
    connectedCount: 0,
    expectedControllerCount: 0,
    offlineCount: 0,
    avgTempC: null,
    avgHumidityPct: null,
    avgFanSupply: null,
    avgFanExhaust: null,
    avgFanIntake: null,
    receipts: [],
  };
}

/** Admin 전국 허브 — overview·summaries만 (LIVE 병렬 조회 생략) */
export const getAdminHubOverviewContext = cache(
  async (): Promise<AdminHubOverviewContext> => {
    const seedKeys = discoverAdminHubFarmKeys(
      [],
      process.env.NODE_ENV === "development" ? devSimFarmKeys() : [],
    );
    const overviewRows = await loadAdminHubOverviewRows(
      adminHubOverviewCacheKey(seedKeys),
    );
    const hubFarmKeys = discoverAdminHubFarmKeys(
      [],
      overviewRows.length > 0
        ? overviewRowsToFarmKeys(overviewRows)
        : seedKeys,
    );
    const farmOptions =
      overviewRows.length > 0
        ? overviewRowsToFarmKeys(overviewRows)
        : hubFarmKeys;
    const farmSummaries = resolveAdminHubFarmSummaries(
      [],
      [],
      overviewRows,
      [],
      hubFarmKeys,
    );
    const overview =
      overviewRows.length > 0
        ? overviewFromRows(overviewRows)
        : emptyHubOverview(hubFarmKeys.length);

    return { overview, farmOptions, farmSummaries };
  },
);
