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
import { getAdminHubOverviewContext } from "@/lib/data/admin-hub-shell-data";
import { FIRMWARE_CTRL_COUNT } from "@/lib/data/iot-firmware";
import type { AlarmRow } from "@/lib/data/alarms";
import type { FarmKey } from "@/lib/data/farm-key";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import type { BarnReading, FarmOverview } from "@/lib/data/iot";
import {
  fetchLiveReadings,
} from "@/lib/data/iot-live-fetch";
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
      const hub = await getAdminHubOverviewContext();

      return {
        readings: [],
        activeFarmKey,
        scopedReadings: [],
        overview: hub.overview,
        alarms: [],
        weatherWarnings: [],
        farmOptions: hub.farmOptions,
        farmSummaries: hub.farmSummaries,
        isAdmin: true,
        farmLocationOptions: [],
        canEditLocation: false,
      };
    }

    /** Admin 단일 농장 — global v_iot_farm_overview(타임아웃) 대신 hub 캐시 + scoped LIVE */
    if (isAdmin && activeFarmKey) {
      const [hub, readings, weatherCache, farmLocations] = await Promise.all([
        getAdminHubOverviewContext(),
        fetchLiveReadings({ farmKey: activeFarmKey }),
        fetchWeatherWarnCache(),
        getFarmLocations(),
      ]);
      const scopedReadings = filterReadingsByFarmKey(readings, activeFarmKey);
      const overview = toFarmOverview(
        summarizeControllers(scopedReadings, FIRMWARE_CTRL_COUNT),
      );
      const alarms = deriveAlarmsFromReadings(scopedReadings, alarmSettings);
      const id = farmKeyId(activeFarmKey);
      const scopedLocations = farmLocations.filter(
        (loc) => farmKeyId(loc.farmKey) === id,
      );
      const weatherWarnings = buildWeatherWarningsForLocations(
        scopedLocations,
        weatherCache,
      );

      return {
        readings,
        activeFarmKey,
        scopedReadings,
        overview,
        alarms,
        weatherWarnings,
        farmOptions: hub.farmOptions,
        farmSummaries: hub.farmSummaries,
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
      weatherWarnings,
      farmOptions: [] as FarmKey[],
      farmSummaries: [] as FarmSummaryRow[],
      isAdmin,
      farmLocationOptions,
      canEditLocation,
    };
  },
);
