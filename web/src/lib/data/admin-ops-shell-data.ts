import "server-only";

import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  adminHubOverviewCacheKey,
  devSimFarmKeys,
  discoverAdminHubFarmKeys,
  loadAdminHubOverviewRows,
} from "@/lib/data/admin-hub-live";
import type { FarmOverview } from "@/lib/data/iot";

export type AdminOpsShellContext = {
  overview: FarmOverview;
};

/** 운영 페이지 TopBar — overview 집계만 (LIVE 병렬 조회 생략) */
export const getAdminOpsShellContext = cache(
  async (): Promise<AdminOpsShellContext> => {
    const user = await getCurrentUser();
    const isAdmin = Boolean(user?.isAdmin);

    if (!isAdmin) {
      return {
        overview: {
          farmCount: 0,
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
        },
      };
    }

    const seedKeys = discoverAdminHubFarmKeys(
      [],
      process.env.NODE_ENV === "development" ? devSimFarmKeys() : [],
    );
    const overviewRows = await loadAdminHubOverviewRows(
      adminHubOverviewCacheKey(seedKeys),
    );

    if (overviewRows.length > 0) {
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
        overview: {
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
        },
      };
    }

    const hubFarmKeys = discoverAdminHubFarmKeys([], seedKeys);
    return {
      overview: {
        farmCount: hubFarmKeys.length,
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
      },
    };
  },
);
