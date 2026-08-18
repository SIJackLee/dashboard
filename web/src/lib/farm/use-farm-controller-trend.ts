"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFarmControllerTrendPeriodAction } from "@/app/(dashboard)/farm/actions";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import {
  emptyTrendControllerPeriodData,
  isCompleteControllerTrendBundle,
  type TrendControllerPeriodData,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { sliceControllerTrendFromLonger } from "@/lib/data/trend-period-slice";
import {
  invalidateTimedCache,
  readTimedCache,
  writeTimedCache,
  type TimedCacheEntry,
} from "@/lib/farm/client-trend-cache";
import { startSharedInflight } from "@/lib/farm/shared-inflight";
import { useDeferredLoading } from "@/lib/ui/use-deferred-loading";

type TrendBundle = Record<TrendPeriodId, TrendControllerPeriodData>;

/** map/list 훅 인스턴스 간 공유 — 탭 전환 시 이중 fetch 방지 · TTL 90s */
const trendCache = new Map<string, TimedCacheEntry<TrendBundle>>();
const trendInflight = new Map<string, Promise<TrendBundle>>();
const trendRefreshInflight = new Map<string, Promise<TrendBundle>>();
const trendListeners = new Map<string, Set<(bundle: TrendBundle) => void>>();

export function peekFarmControllerTrendCache(
  farmKey: FarmKey,
): TrendBundle | null {
  return readTimedCache(trendCache, farmKeyId(farmKey));
}

export function invalidateFarmControllerTrendCache(farmKey: FarmKey): void {
  invalidateTimedCache(trendCache, farmKeyId(farmKey));
}

function readTrendCache(scopeId: string): TrendBundle | null {
  return readTimedCache(trendCache, scopeId);
}

function emptyBundle(): TrendBundle {
  return {
    "24h": emptyTrendControllerPeriodData("24h"),
    "7d": emptyTrendControllerPeriodData("7d"),
    "30d": emptyTrendControllerPeriodData("30d"),
  };
}

function notifyTrend(scopeId: string, bundle: TrendBundle): void {
  writeTimedCache(trendCache, scopeId, bundle);
  const listeners = trendListeners.get(scopeId);
  if (!listeners) return;
  for (const cb of listeners) cb(bundle);
}

export function subscribeFarmControllerTrend(
  scopeId: string,
  cb: (bundle: TrendBundle) => void,
): () => void {
  let set = trendListeners.get(scopeId);
  if (!set) {
    set = new Set();
    trendListeners.set(scopeId, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) trendListeners.delete(scopeId);
  };
}

async function loadProgressiveBundle(farmKey: FarmKey): Promise<TrendBundle> {
  const h24 = await fetchFarmControllerTrendPeriodAction(farmKey, "24h");
  const partial: TrendBundle = {
    ...emptyBundle(),
    "24h": h24,
  };
  notifyTrend(farmKeyId(farmKey), partial);

  const d30 = await fetchFarmControllerTrendPeriodAction(farmKey, "30d");
  const d7Slice = sliceControllerTrendFromLonger(d30, "7d");
  const h24Slice = sliceControllerTrendFromLonger(d30, "24h");
  const full: TrendBundle = {
    "24h":
      h24Slice && h24Slice.totalSamples > 0 ? h24Slice : h24,
    "7d": d7Slice ?? emptyTrendControllerPeriodData("7d"),
    "30d": d30,
  };
  notifyTrend(farmKeyId(farmKey), full);
  return full;
}

function fetchTrendShared(
  farmKey: FarmKey,
  scopeId: string,
  refresh: boolean,
): Promise<TrendBundle> {
  if (!refresh) {
    const cached = readTrendCache(scopeId);
    if (cached && isCompleteControllerTrendBundle(cached)) {
      return Promise.resolve(cached);
    }
  }

  const map = refresh ? trendRefreshInflight : trendInflight;
  return startSharedInflight(map, scopeId, () => loadProgressiveBundle(farmKey));
}

/** 로그인·농장 LIVE 이후 idle 시 호출 — 그래프 탭 대기 제거 */
export function prefetchFarmControllerTrend(farmKey: FarmKey): Promise<TrendBundle> {
  return fetchTrendShared(farmKey, farmKeyId(farmKey), false);
}

export function useFarmControllerTrend(params: {
  farmKey: FarmKey | null;
  enabled: boolean;
}) {
  const scopeId = params.farmKey ? farmKeyId(params.farmKey) : "";
  const active = params.enabled && Boolean(params.farmKey);
  const applyTokenRef = useRef(0);
  const [bundle, setBundle] = useState<{
    scopeId: string;
    data: TrendBundle;
  } | null>(() => {
    if (!scopeId) return null;
    const cached = readTrendCache(scopeId);
    return cached ? { scopeId, data: cached } : null;
  });
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (active && scopeId) {
    const cached = readTrendCache(scopeId);
    if (cached && bundle?.scopeId !== scopeId) {
      setBundle({ scopeId, data: cached });
      if (error) setError(false);
    }
  }

  useEffect(() => {
    if (!active || !params.farmKey) return;
    const token = ++applyTokenRef.current;
    const unsub = subscribeFarmControllerTrend(scopeId, (data) => {
      if (token !== applyTokenRef.current) return;
      setBundle({ scopeId, data });
      setError(false);
    });
    const cached = readTrendCache(scopeId);
    if (!isCompleteControllerTrendBundle(cached)) {
      void fetchTrendShared(params.farmKey, scopeId, false).catch(() => {
        if (token !== applyTokenRef.current) return;
        setError(true);
      });
    }
    return () => {
      unsub();
      applyTokenRef.current += 1;
    };
  }, [active, scopeId, params.farmKey]);

  const refresh = useCallback(() => {
    if (!params.farmKey) return Promise.resolve();
    const token = ++applyTokenRef.current;
    setRefreshing(true);
    return fetchTrendShared(params.farmKey, scopeId, true)
      .then((result) => {
        if (token !== applyTokenRef.current) return;
        setBundle({ scopeId, data: result });
        setError(false);
      })
      .catch(() => {
        if (token !== applyTokenRef.current) return;
        setError(true);
      })
      .finally(() => {
        if (token === applyTokenRef.current) setRefreshing(false);
      });
  }, [params.farmKey, scopeId]);

  const data = bundle?.scopeId === scopeId ? bundle.data : null;
  const initialPending = active && data === null && !error;
  const showInitialLoading = useDeferredLoading(initialPending);
  const showRefreshing = useDeferredLoading(refreshing);
  const isStale = refreshing && data !== null;

  return {
    data,
    loading: showInitialLoading,
    refreshing: showRefreshing,
    isStale,
    error: active && error,
    refresh,
  };
}
