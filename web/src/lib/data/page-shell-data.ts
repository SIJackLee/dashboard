import "server-only";

import { cache } from "react";
import {
  filterReadingsByFarmKey,
  resolveActiveFarmKey,
  type FarmQueryParams,
} from "@/lib/auth/farm-access";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { deriveAlarmsFromReadings } from "@/lib/data/alarms";
import { getAlarmSettings } from "@/lib/data/alarm-settings";
import {
  summarizeControllers,
  toFarmOverview,
} from "@/lib/data/dashboard-summary";
import { getFarmOverviewSummaries } from "@/lib/data/farm-overview";
import { FIRMWARE_CTRL_COUNT } from "@/lib/data/iot-firmware";
import type { AlarmRow } from "@/lib/data/alarms";
import type { FarmKey } from "@/lib/data/farm-key";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import type { BarnReading, FarmOverview } from "@/lib/data/iot";
import {
  fetchFarmOverviewRows,
  fetchLiveReadings,
} from "@/lib/data/iot-live-fetch";

export type PageShellContext = {
  readings: BarnReading[];
  activeFarmKey: FarmKey | null;
  scopedReadings: BarnReading[];
  overview: FarmOverview;
  alarms: AlarmRow[];
  farmOptions: FarmKey[];
  farmSummaries: FarmSummaryRow[];
  isAdmin: boolean;
};

export const getPageShellContext = cache(
  async (searchParams: FarmQueryParams = {}): Promise<PageShellContext> => {
    const [alarmSettings, user] = await Promise.all([
      getAlarmSettings(),
      getCurrentUser(),
    ]);

    const activeFarmKey = user ? resolveActiveFarmKey(user, searchParams) : null;
    const isAdmin = Boolean(user?.isAdmin);

    if (isAdmin && !activeFarmKey) {
      const [overviewRows, farmSummaries] = await Promise.all([
        fetchFarmOverviewRows(),
        getFarmOverviewSummaries(),
      ]);
      const farmOptions = overviewRows.map((r) => ({
        lsindRegistNo: r.lsind_regist_no,
        itemCode: r.item_code,
      }));

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

      const overview: FarmOverview = {
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

      return {
        readings: [],
        activeFarmKey,
        scopedReadings: [],
        overview,
        alarms: [],
        farmOptions,
        farmSummaries,
        isAdmin: true,
      };
    }

    const readings = await fetchLiveReadings(
      activeFarmKey ? { farmKey: activeFarmKey } : {},
    );
    const scopedReadings = filterReadingsByFarmKey(readings, activeFarmKey);
    const overview = toFarmOverview(
      summarizeControllers(scopedReadings, FIRMWARE_CTRL_COUNT),
    );
    const alarms = deriveAlarmsFromReadings(scopedReadings, alarmSettings);

    let farmOptions: FarmKey[] = [];
    let farmSummaries: FarmSummaryRow[] = [];
    if (isAdmin) {
      const [overviewRows, overviewSummaries] = await Promise.all([
        fetchFarmOverviewRows(),
        getFarmOverviewSummaries(),
      ]);
      farmOptions = overviewRows.map((r) => ({
        lsindRegistNo: r.lsind_regist_no,
        itemCode: r.item_code,
      }));
      farmSummaries = overviewSummaries;
    }

    return {
      readings,
      activeFarmKey,
      scopedReadings,
      overview,
      alarms,
      farmOptions,
      farmSummaries,
      isAdmin,
    };
  },
);
