import { compareControllerKeys } from "@/lib/data/controller-key";
import type { ControllerCandidate } from "@/lib/weather-control/types";

function headroomScore(
  tempC: number | null,
  setpoint: number,
  deviation: number,
): number {
  if (tempC == null) return Number.POSITIVE_INFINITY;
  const ceiling = setpoint + deviation;
  return ceiling - tempC;
}

export function pickController(
  candidates: ControllerCandidate[],
  targetControllerKey?: string | null,
): ControllerCandidate | null {
  const online = candidates.filter((c) => c.status !== "offline");
  if (online.length === 0) return null;

  if (targetControllerKey?.trim()) {
    const hit = online.find((c) => c.controllerKey === targetControllerKey);
    return hit ?? null;
  }

  const eligible = online.filter((c) => c.settingsSource !== "pending");
  const pool = eligible.length > 0 ? eligible : [];

  if (pool.length === 0) return null;

  pool.sort((a, b) => {
    const ha = headroomScore(
      a.tempC,
      a.current.setpointTemp,
      a.current.tempDeviation,
    );
    const hb = headroomScore(
      b.tempC,
      b.current.setpointTemp,
      b.current.tempDeviation,
    );
    if (ha !== hb) return ha - hb;
    return compareControllerKeys(a.controllerKey, b.controllerKey);
  });

  return pool[0] ?? null;
}
