import { filterReadingsByFarmKey } from "@/lib/auth/farm-access";
import {
  buildThermoSettingsFromReadings,
  mergeThermoSettingsMaps,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import {
  getBarnLayoutPrefs,
  mergeBarnLayouts,
  type BarnLayoutPrefs,
} from "@/lib/data/barn-meta";
import {
  buildAutoBarnMap,
  filterBarnLayoutPrefsForFarm,
  gridDimensionsForBarnMap,
} from "@/lib/data/barn-map";
import type { ThermoCommand } from "@/lib/data/commands";
import { getThermoCommandHistory, getThermoSettingsMap } from "@/lib/data/commands";
import { getAlarmSettings } from "@/lib/data/alarm-settings";
import type { AlarmSettings } from "@/lib/data/alarms";
import { getFarmTrendAllPeriods } from "@/lib/data/farm-trend-history";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import type { FarmKey } from "@/lib/data/farm-key";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import { getLiveReadings } from "@/lib/data/iot";

export type FarmScopedPanelData = {
  farmKey: FarmKey;
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  trendByPeriod: Record<TrendPeriodId, TrendPeriodData>;
  controller: ControllerGridData;
};

/** soft refresh / ACK 폴링 — LIVE(+layout)만. settings·trend 제외 */
export type FarmScopedLiveData = {
  farmKey: FarmKey;
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
};

async function buildScopedBarnMap(
  farmKey: FarmKey,
  readings: BarnReading[],
  layoutPrefs: BarnLayoutPrefs,
): Promise<{
  scopedReadings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
}> {
  const scopedReadings = filterReadingsByFarmKey(readings, farmKey);
  const scopedLayoutPrefs = filterBarnLayoutPrefsForFarm(layoutPrefs, farmKey);

  const { snapshots: barnSnapshots, layoutsToPersist } = buildAutoBarnMap(
    scopedReadings,
    scopedLayoutPrefs,
  );

  if (Object.keys(layoutsToPersist).length > 0) {
    await mergeBarnLayouts(layoutsToPersist);
  }

  const mergedLayouts = {
    ...scopedLayoutPrefs.layouts,
    ...layoutsToPersist,
  };
  const gridSize = gridDimensionsForBarnMap(barnSnapshots, mergedLayouts);

  return {
    scopedReadings,
    barnSnapshots,
    gridCols: gridSize.cols,
    gridRows: gridSize.rows,
  };
}

/** LIVE tier only — soft refresh / command confirm용 */
export async function loadFarmScopedLiveData(params: {
  farmKey: FarmKey;
  layoutPrefs?: BarnLayoutPrefs;
}): Promise<FarmScopedLiveData> {
  const { farmKey } = params;
  const [readings, layoutPrefs] = await Promise.all([
    getLiveReadings({ farmKey }),
    params.layoutPrefs
      ? Promise.resolve(params.layoutPrefs)
      : getBarnLayoutPrefs(),
  ]);

  const map = await buildScopedBarnMap(farmKey, readings, layoutPrefs);
  return {
    farmKey,
    readings: map.scopedReadings,
    barnSnapshots: map.barnSnapshots,
    gridCols: map.gridCols,
    gridRows: map.gridRows,
  };
}

export async function loadFarmScopedPanelData(params: {
  farmKey: FarmKey;
  commandThermoMap?: Record<string, ControllerThermoSettings>;
  history?: ThermoCommand[];
  alarmSettings?: AlarmSettings;
  layoutPrefs?: BarnLayoutPrefs;
  canCommand: boolean;
}): Promise<FarmScopedPanelData> {
  const { farmKey, canCommand } = params;

  const [readings, layoutPrefs, alarmSettings, trendByPeriod, commandThermoMap, history] =
    await Promise.all([
      getLiveReadings({ farmKey }),
      params.layoutPrefs
        ? Promise.resolve(params.layoutPrefs)
        : getBarnLayoutPrefs(),
      params.alarmSettings
        ? Promise.resolve(params.alarmSettings)
        : getAlarmSettings(),
      getFarmTrendAllPeriods({ farmKey }),
      params.commandThermoMap
        ? Promise.resolve(params.commandThermoMap)
        : getThermoSettingsMap(500),
      params.history ? Promise.resolve(params.history) : getThermoCommandHistory(100),
    ]);

  const map = await buildScopedBarnMap(farmKey, readings, layoutPrefs);
  const thermoSettingsForFarm = mergeThermoSettingsMaps(
    commandThermoMap,
    buildThermoSettingsFromReadings(map.scopedReadings),
  );

  return {
    farmKey,
    readings: map.scopedReadings,
    barnSnapshots: map.barnSnapshots,
    gridCols: map.gridCols,
    gridRows: map.gridRows,
    trendByPeriod,
    controller: {
      readings: map.scopedReadings,
      thermoSettings: thermoSettingsForFarm,
      commands: history,
      canCommand,
      alarmSettings,
    },
  };
}
