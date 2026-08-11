import { THERMO_CAPS, type ThermoValues } from "./types.ts";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function applyThermoCaps(values: ThermoValues): ThermoValues {
  let minVentPct = clamp(
    Math.round(values.minVentPct),
    THERMO_CAPS.ventMin,
    THERMO_CAPS.ventMax,
  );
  const maxVentPct = clamp(
    Math.round(values.maxVentPct),
    THERMO_CAPS.ventMin,
    THERMO_CAPS.ventMax,
  );
  if (minVentPct > maxVentPct) {
    minVentPct = maxVentPct;
  }
  const setpointTemp = Math.round(
    clamp(values.setpointTemp, THERMO_CAPS.setpointMin, THERMO_CAPS.setpointMax) *
      10,
  ) / 10;

  return {
    setpointTemp,
    tempDeviation: values.tempDeviation,
    minVentPct,
    maxVentPct,
  };
}

export function thermoValuesEqual(a: ThermoValues, b: ThermoValues): boolean {
  return (
    a.setpointTemp === b.setpointTemp &&
    a.tempDeviation === b.tempDeviation &&
    a.minVentPct === b.minVentPct &&
    a.maxVentPct === b.maxVentPct
  );
}

export function proposeRiseVent(current: ThermoValues): ThermoValues {
  return applyThermoCaps({
    ...current,
    minVentPct: current.minVentPct + 5,
    maxVentPct: current.maxVentPct + 10,
  });
}

export function proposeDropHeat(current: ThermoValues): ThermoValues {
  return applyThermoCaps({
    ...current,
    setpointTemp: current.setpointTemp - 1,
  });
}

export function proposeHumidVent(current: ThermoValues): ThermoValues {
  return applyThermoCaps({
    ...current,
    maxVentPct: current.maxVentPct + 10,
  });
}
