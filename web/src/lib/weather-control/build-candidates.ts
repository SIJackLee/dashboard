import {
  buildThermoSettingsFromReadings,
  buildThermoSettingsMap,
  mergeThermoSettingsMaps,
  thermoSettingsKey,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import type { ThermoCommand } from "@/lib/data/commands";
import type { BarnReading } from "@/lib/data/iot";
import type { FarmKey } from "@/lib/data/farm-key";
import type { ControllerCandidate } from "@/lib/weather-control/types";

function settingsForReading(
  merged: Record<string, ControllerThermoSettings>,
  farmKey: FarmKey,
  moduleUid: number,
  controllerKey: string,
): ControllerThermoSettings | null {
  const base = thermoSettingsKey(farmKey, moduleUid, controllerKey);
  return merged[base] ?? merged[thermoSettingsKey(farmKey, moduleUid, controllerKey, "A")] ?? null;
}

export function buildControllerCandidates(
  readings: BarnReading[],
  commands: ThermoCommand[],
): ControllerCandidate[] {
  const commandMap = buildThermoSettingsMap(commands);
  const liveMap = buildThermoSettingsFromReadings(readings);
  const merged = mergeThermoSettingsMaps(commandMap, liveMap);

  const out: ControllerCandidate[] = [];
  for (const r of readings) {
    if (r.status === "offline") continue;
    const settings = settingsForReading(
      merged,
      r.farmKey,
      r.moduleUid,
      r.controllerKey,
    );
    if (!settings) continue;

    out.push({
      farmKey: r.farmKey,
      moduleUid: r.moduleUid,
      controllerKey: r.controllerKey,
      stallTyCode: r.stallTyCode ?? r.controllerKey.split(":")[0] ?? "SP01",
      stallNo: r.stallNo ?? r.controllerKey.split(":")[1] ?? "01",
      eqpmnNo: r.eqpmnNo,
      label: r.label,
      tempC: r.tempC,
      humidityPct: r.humidityPct,
      status: r.status,
      current: {
        setpointTemp: settings.setpointTemp,
        tempDeviation: settings.tempDeviation,
        minVentPct: settings.minVentPct,
        maxVentPct: settings.maxVentPct,
      },
      settingsSource: settings.source,
      liveReceivedAt: r.receivedAt,
    });
  }
  return out;
}
