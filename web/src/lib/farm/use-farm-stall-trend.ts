"use client";

import { fetchFarmTrendAllPeriodsAction } from "@/app/(dashboard)/farm/actions";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";

type StallTrendBundle = Record<TrendPeriodId, TrendPeriodData>;

/** map idle prefetch 공유 — SSR 이탈 후 클라이언트 hydrate */
const stallTrendCache = new Map<string, StallTrendBundle>();
const stallTrendInflight = new Map<string, Promise<StallTrendBundle>>();
const stallTrendApplyGen = new Map<string, number>();

export function peekFarmStallTrendCache(
  farmKey: FarmKey,
): StallTrendBundle | null {
  return stallTrendCache.get(farmKeyId(farmKey)) ?? null;
}

function bumpApplyGen(scopeId: string): number {
  const next = (stallTrendApplyGen.get(scopeId) ?? 0) + 1;
  stallTrendApplyGen.set(scopeId, next);
  return next;
}

function fetchStallTrendShared(farmKey: FarmKey): Promise<StallTrendBundle> {
  const scopeId = farmKeyId(farmKey);
  const cached = stallTrendCache.get(scopeId);
  if (cached) return Promise.resolve(cached);
  const pending = stallTrendInflight.get(scopeId);
  if (pending) return pending;

  const applyGen = bumpApplyGen(scopeId);
  const req = fetchFarmTrendAllPeriodsAction(farmKey).then((result) => {
    if (stallTrendApplyGen.get(scopeId) === applyGen) {
      stallTrendCache.set(scopeId, result);
    }
    return result;
  });

  stallTrendInflight.set(scopeId, req);
  void req.finally(() => {
    if (stallTrendInflight.get(scopeId) === req) {
      stallTrendInflight.delete(scopeId);
    }
  });
  return req;
}

/** LIVE 안정 후 idle — 그리드 히트맵용 stall trend (SSR critical path 이탈) */
export function prefetchFarmStallTrend(
  farmKey: FarmKey,
): Promise<StallTrendBundle> {
  return fetchStallTrendShared(farmKey);
}
