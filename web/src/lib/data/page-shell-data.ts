import "server-only";

import { cache } from "react";
import {
  filterReadingsByFarmKey,
  resolveActiveFarmKey,
  type FarmQueryParams,
} from "@/lib/auth/farm-access";
import { getCurrentUser, canCommand } from "@/lib/auth/get-current-user";
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
import {
  adminHubOverviewCacheKey,
  devSimFarmKeys,
  discoverAdminHubFarmKeys,
  fetchAdminHubLiveReadings,
  loadAdminHubOverviewRows,
  overviewRowsToFarmKeys,
  resolveAdminHubFarmSummaries,
} from "@/lib/data/admin-hub-live";
import {
  getEditableFarmLocationOptions,
  getFarmLocations,
  type EditableFarmOption,
} from "@/lib/data/farm-location";
import {
  buildWeatherWarningsForLocations,
  fetchWeatherWarnCache,
  type WeatherWarningRow,
} from "@/lib/data/weather-warnings";
import { farmKeysFromAccess } from "@/lib/auth/farm-access";
import { farmKeyId } from "@/lib/data/farm-key";

export type PageShellContext = {
  readings: BarnReading[];
  activeFarmKey: FarmKey | null;
  scopedReadings: BarnReading[];
  overview: FarmOverview;
  alarms: AlarmRow[];
  weatherWarnings: WeatherWarningRow[];
  farmOptions: FarmKey[];
  farmSummaries: FarmSummaryRow[];
  isAdmin: boolean;
  farmLocationOptions: EditableFarmOption[];
  canEditLocation: boolean;
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
      const readings = await fetchAdminHubLiveReadings(null, hubFarmKeys);
      const farmSummaries = resolveAdminHubFarmSummaries(
        readings,
        [],
        overviewRows,
        [],
        hubFarmKeys,
      );
      const farmOptions =
        overviewRows.length > 0
          ? overviewRowsToFarmKeys(overviewRows)
          : hubFarmKeys;

      let overview: FarmOverview;
      if (overviewRows.length > 0) {
        const totalControllers = overviewRows.reduce(
          (s, r) => s + r.controller_count,
          0
        );
        const totalOffline = overviewRows.reduce(
          (s, r) => s + r.offline_count,
          0
        );
        const temps = overviewRows
          .map((r) => (r.avg_temp_c != null ? Number(r.avg_temp_c) : null))
          .filter((n): n is number => n != null);
        const humidities = overviewRows
          .map((r) =>
            r.avg_humidity_pct != null ? Number(r.avg_humidity_pct) : null
          )
          .filter((n): n is number => n != null);

        const avg = (nums: number[]) =>
          nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;

        overview = {
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
      } else {
        overview = toFarmOverview(
          summarizeControllers(readings, FIRMWARE_CTRL_COUNT)
        );
      }

      return {
        readings,
        activeFarmKey,
        scopedReadings: readings,
        overview,
        alarms: [],
        weatherWarnings: [],
        farmOptions,
        farmSummaries,
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
    const alarms = deriveAlarmsFromReadings(scopedReadings, alarmSettings);

    const [weatherCache, farmLocations] = await Promise.all([
      fetchWeatherWarnCache(),
      getFarmLocations(),
    ]);

    let scopedLocations = farmLocations;
    if (activeFarmKey) {
      const id = farmKeyId(activeFarmKey);
      scopedLocations = farmLocations.filter(
        (loc) => farmKeyId(loc.farmKey) === id
      );
    } else if (user && !isAdmin) {
      const allowed = new Set(
        farmKeysFromAccess(user).map((fk) => farmKeyId(fk))
      );
      scopedLocations = farmLocations.filter((loc) =>
        allowed.has(farmKeyId(loc.farmKey))
      );
    } else if (isAdmin && !activeFarmKey) {
      scopedLocations = [];
    }

    const weatherWarnings = buildWeatherWarningsForLocations(
      scopedLocations,
      weatherCache
    );

    let farmOptions: FarmKey[] = [];
    let farmSummaries: FarmSummaryRow[] = [];
    let farmLocationOptions: EditableFarmOption[] = [];
    const canEditLocation = user ? canCommand(user) : false;

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
    } else {
      farmLocationOptions = await getEditableFarmLocationOptions();
    }

    return {
      readings,
      activeFarmKey,
      scopedReadings,
      overview,
      alarms,
      weatherWarnings,
      farmOptions,
      farmSummaries,
      isAdmin,
      farmLocationOptions,
      canEditLocation,
    };
  },
);
