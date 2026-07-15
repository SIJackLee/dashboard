import type { HealthStatus } from "@/lib/admin/health/types";
import {
  CONTROLLER_STALE_CRITICAL_MIN,
  CONTROLLER_STALE_WARN_MIN,
  UPLINK_ROUND_SEC,
} from "@/lib/admin/health/constants";

const WARN_SEC = CONTROLLER_STALE_WARN_MIN * 60;
const CRITICAL_SEC = CONTROLLER_STALE_CRITICAL_MIN * 60;

function controllerCountClamped(n: number): number {
  return Math.max(1, Math.min(50, n));
}

/** 모듈 내 컨트롤러 순환 슬롯 간격(초) — 48C 가정 시 ≈6.25s. 헬스 판정과 별개. */
function gapSec(controllerCount: number): number {
  return UPLINK_ROUND_SEC / controllerCountClamped(controllerCount);
}

/**
 * 동일 컨트롤러 last seen 경과(초) → 상태.
 * 목표: 컨트롤러당 5분(UPLINK_ROUND_SEC) 주기.
 * warn: 10분 초과 · critical: 30분 초과.
 */
export function evaluateStaleness(ageSec: number | null): HealthStatus {
  if (ageSec === null || !Number.isFinite(ageSec)) return "unknown";

  if (ageSec <= WARN_SEC) return "ok";
  if (ageSec <= CRITICAL_SEC) return "warn";
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
