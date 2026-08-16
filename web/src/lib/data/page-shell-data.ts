import "server-only";

import { cache } from "react";
import {
  filterReadingsByFarmKey,
  resolveActiveFarmKey,
  type FarmQueryParams,
} from "@/lib/auth/farm-access";
import { getCurrentUser, canCommand } from "@/lib/auth/get-current-user";
import { fetchActiveModuleAlarms } from "@/lib/data/module-alarms";
import { mergeSituationAlarms, type AlarmRow } from "@/lib/data/alarms";
import {
  summarizeControllers,
  toFarmOverview,
} from "@/lib/data/dashboard-summary";
import { getAdminHubOverviewContext } from "@/lib/data/admin-hub-shell-data";
import { FIRMWARE_CTRL_COUNT } from "@/lib/data/iot-firmware";
import { farmKeyEq, type FarmKey } from "@/lib/data/farm-key";
import type { FarmLocationRow } from "@/lib/data/farm-location-shared";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import type { BarnReading, FarmOverview } from "@/lib/data/iot";
import {
  fetchLiveReadings,
} from "@/lib/data/iot-live-fetch";
import {
  getEditableFarmLocationOptions,
  type EditableFarmOption,
} from "@/lib/data/farm-location";

export type PageShellContext = {
  readings: BarnReading[];
  activeFarmKey: FarmKey | null;
  scopedReadings: BarnReading[];
  overview: FarmOverview;
  alarms: AlarmRow[];
  farmOptions: FarmKey[];
  farmSummaries: FarmSummaryRow[];
  hubLocations: FarmLocationRow[];
  isAdmin: boolean;
  farmLocationOptions: EditableFarmOption[];
  canEditLocation: boolean;
};

function applyAlarmCountsToSummaries(
  summaries: FarmSummaryRow[],
  alarms: AlarmRow[],
): FarmSummaryRow[] {
  if (alarms.length === 0) return summaries;
  return summaries.map((row) => {
    const farmAlarms = alarms.filter((a) => farmKeyEq(a.farmKey, row.farmKey));
    if (farmAlarms.length === 0) return row;
    return {
      ...row,
      alarmCount: farmAlarms.length,
      criticalCount: farmAlarms.filter((a) => a.severity === "critical").length,
    };
  });
}

export const getPageShellContext = cache(
  async (searchParams: FarmQueryParams = {}): Promise<PageShellContext> => {
    const user = await getCurrentUser();

    const activeFarmKey = user ? resolveActiveFarmKey(user, searchParams) : null;
    const isAdmin = Boolean(user?.isAdmin);

    if (isAdmin && !activeFarmKey) {
      const [hub, alarms] = await Promise.all([
        getAdminHubOverviewContext(),
        fetchActiveModuleAlarms(null, { limit: 100 }),
      ]);

      return {
        readings: [],
        activeFarmKey,
        scopedReadings: [],
        overview: hub.overview,
        alarms,
        farmOptions: hub.farmOptions,
        farmSummaries: applyAlarmCountsToSummaries(hub.farmSummaries, alarms),
        hubLocations: hub.locations,
        isAdmin: true,
        farmLocationOptions: [],
        canEditLocation: false,
      };
    }

    /** Admin 단일 농장 — global v_iot_farm_overview(타임아웃) 대신 hub 캐시 + scoped LIVE */
    if (isAdmin && activeFarmKey) {
      const [hub, readings, moduleAlarms] = await Promise.all([
        getAdminHubOverviewContext(),
        fetchLiveReadings({ farmKey: activeFarmKey }),
        fetchActiveModuleAlarms(activeFarmKey),
      ]);
      const scopedReadings = filterReadingsByFarmKey(readings, activeFarmKey);
      const overview = toFarmOverview(
        summarizeControllers(scopedReadings, FIRMWARE_CTRL_COUNT),
      );
      const alarms = mergeSituationAlarms(moduleAlarms, scopedReadings);

      return {
        readings,
        activeFarmKey,
        scopedReadings,
        overview,
        alarms,
        farmOptions: hub.farmOptions,
        farmSummaries: applyAlarmCountsToSummaries(hub.farmSummaries, alarms),
        hubLocations: hub.locations,
        isAdmin: true,
        farmLocationOptions: [],
        canEditLocation: false,
      };
    }

    const readings = await fetchLiveReadings(
      activeFarmKey ? { farmKey: activeFarmKey } : {},
    );
    const scopedReadings = filterReadingsByFarmKey(readings, activeFarmKey);
    const overview = toFarmOverview(
      summarizeControllers(scopedReadings, FIRMWARE_CTRL_COUNT),
    );
    const moduleAlarms = await fetchActiveModuleAlarms(activeFarmKey);
    const alarms = mergeSituationAlarms(moduleAlarms, scopedReadings);

    let farmLocationOptions: EditableFarmOption[] = [];
    const canEditLocation = user ? canCommand(user) : false;

    if (!isAdmin) {
      farmLocationOptions = await getEditableFarmLocationOptions();
    }

    return {
      readings,
      activeFarmKey,
      scopedReadings,
      overview,
      alarms,
      farmOptions: [] as FarmKey[],
      farmSummaries: [] as FarmSummaryRow[],
      hubLocations: [],
      isAdmin,
      farmLocationOptions,
      canEditLocation,
    };
  },
);
