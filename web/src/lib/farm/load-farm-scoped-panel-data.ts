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

  const scopedReadings = filterReadingsByFarmKey(readings, farmKey);
  const thermoSettingsForFarm = mergeThermoSettingsMaps(
    commandThermoMap,
    buildThermoSettingsFromReadings(scopedReadings)
  );

  const scopedLayoutPrefs = filterBarnLayoutPrefsForFarm(layoutPrefs, farmKey);

  const { snapshots: barnSnapshots, layoutsToPersist } = buildAutoBarnMap(
    scopedReadings,
    scopedLayoutPrefs
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
    farmKey,
    readings: scopedReadings,
    barnSnapshots,
    gridCols: gridSize.cols,
    gridRows: gridSize.rows,
    trendByPeriod,
    controller: {
      readings: scopedReadings,
      thermoSettings: thermoSettingsForFarm,
      commands: history,
      canCommand,
      alarmSettings,
    },
  };
}
