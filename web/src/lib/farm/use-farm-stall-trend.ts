"use client";

import { fetchFarmTrendAllPeriodsAction } from "@/app/(dashboard)/farm/actions";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import {
  invalidateTimedCache,
  readTimedCache,
  writeTimedCache,
  type TimedCacheEntry,
} from "@/lib/farm/client-trend-cache";

type StallTrendBundle = Record<TrendPeriodId, TrendPeriodData>;

/** map idle prefetch 공유 — SSR 이탈 후 클라이언트 hydrate · TTL 90s */
const stallTrendCache = new Map<string, TimedCacheEntry<StallTrendBundle>>();
const stallTrendInflight = new Map<string, Promise<StallTrendBundle>>();
const stallTrendApplyGen = new Map<string, number>();

export function peekFarmStallTrendCache(
  farmKey: FarmKey,
): StallTrendBundle | null {
  return readTimedCache(stallTrendCache, farmKeyId(farmKey));
}

/** 농장 전환·강제 갱신 시 해당 scope 클라 캐시 제거 */
export function invalidateFarmStallTrendCache(farmKey: FarmKey): void {
  invalidateTimedCache(stallTrendCache, farmKeyId(farmKey));
}

function bumpApplyGen(scopeId: string): number {
  const next = (stallTrendApplyGen.get(scopeId) ?? 0) + 1;
  stallTrendApplyGen.set(scopeId, next);
  return next;
}

function fetchStallTrendShared(farmKey: FarmKey): Promise<StallTrendBundle> {
  const scopeId = farmKeyId(farmKey);
  const cached = readTimedCache(stallTrendCache, scopeId);
  if (cached) return Promise.resolve(cached);
  const pending = stallTrendInflight.get(scopeId);
  if (pending) return pending;

  const applyGen = bumpApplyGen(scopeId);
  const req = fetchFarmTrendAllPeriodsAction(farmKey).then((result) => {
    if (stallTrendApplyGen.get(scopeId) === applyGen) {
      writeTimedCache(stallTrendCache, scopeId, result);
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
