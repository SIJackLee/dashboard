import type { ControllerCandidate } from "./types.ts";

function headroomScore(
  tempC: number | null,
  setpoint: number,
  deviation: number,
): number {
  if (tempC == null) return Number.POSITIVE_INFINITY;
  return setpoint + deviation - tempC;
}

export function pickController(
  candidates: ControllerCandidate[],
  targetControllerKey?: string | null,
): ControllerCandidate | null {
  const online = candidates.filter((c) => c.status !== "offline");
  if (online.length === 0) return null;

  if (targetControllerKey?.trim()) {
    return online.find((c) => c.controllerKey === targetControllerKey) ?? null;
  }

  const pool = online.filter((c) => c.settingsSource !== "pending");
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
    return a.controllerKey.localeCompare(b.controllerKey, "ko", {
      numeric: true,
    });
  });

  return pool[0] ?? null;
}
