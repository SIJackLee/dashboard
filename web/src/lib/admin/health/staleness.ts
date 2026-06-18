import type { HealthStatus } from "@/lib/admin/health/types";
import { UPLINK_ROUND_SEC } from "@/lib/admin/health/constants";

export function controllerCountClamped(n: number): number {
  return Math.max(1, Math.min(50, n));
}

export function gapSec(controllerCount: number): number {
  return UPLINK_ROUND_SEC / controllerCountClamped(controllerCount);
}

/** Age since last received (seconds). */
export function evaluateStaleness(
  ageSec: number | null,
  controllerCount: number
): HealthStatus {
  if (ageSec === null || !Number.isFinite(ageSec)) return "unknown";

  const gap = gapSec(controllerCount);
  if (ageSec <= gap * 1.2) return "ok";
  if (ageSec <= UPLINK_ROUND_SEC * 1.5) return "warn";
  return "critical";
}

export function ageSecFromIso(iso: string | null, nowMs = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (nowMs - t) / 1000);
}

export function ageMinFromIso(iso: string | null, nowMs = Date.now()): number | null {
  const sec = ageSecFromIso(iso, nowMs);
  if (sec === null) return null;
  return sec / 60;
}

export function worstStatus(statuses: HealthStatus[]): HealthStatus {
  const rank: Record<HealthStatus, number> = {
    critical: 4,
    warn: 3,
    unknown: 2,
    ok: 1,
    not_implemented: 0,
  };
  let worst: HealthStatus = "ok";
  for (const s of statuses) {
    if (rank[s] > rank[worst]) worst = s;
  }
  return worst;
}
