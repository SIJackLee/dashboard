"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchFarmControllerTrendAllPeriodsAction } from "@/app/(dashboard)/farm/actions";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { useDeferredLoading } from "@/lib/ui/use-deferred-loading";

type TrendBundle = Record<TrendPeriodId, TrendControllerPeriodData>;

/** map/list 훅 인스턴스 간 공유 — 탭 전환 시 이중 fetch 방지 */
const trendCache = new Map<string, TrendBundle>();
const trendInflight = new Map<string, Promise<TrendBundle>>();

function readTrendCache(scopeId: string): TrendBundle | null {
  return trendCache.get(scopeId) ?? null;
}

function fetchTrendShared(
  farmKey: FarmKey,
  scopeId: string,
  refresh: boolean,
): Promise<TrendBundle> {
  if (!refresh) {
    const cached = trendCache.get(scopeId);
    if (cached) return Promise.resolve(cached);
    const pending = trendInflight.get(scopeId);
    if (pending) return pending;
  }

  const req = fetchFarmControllerTrendAllPeriodsAction(farmKey, {
    refresh: refresh || undefined,
  }).then((result) => {
    trendCache.set(scopeId, result);
    return result;
  });

  if (!refresh) {
    trendInflight.set(scopeId, req);
    void req.finally(() => {
      if (trendInflight.get(scopeId) === req) trendInflight.delete(scopeId);
    });
  }

  return req;
}

export function useFarmControllerTrend(params: {
  farmKey: FarmKey | null;
  enabled: boolean;
}) {
  const scopeId = params.farmKey ? farmKeyId(params.farmKey) : "";
  const active = params.enabled && Boolean(params.farmKey);
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

  // Cache hit — sync during render (lazy init covers first mount)
  if (active && scopeId) {
    const cached = readTrendCache(scopeId);
    if (cached && bundle?.scopeId !== scopeId) {
      setBundle({ scopeId, data: cached });
      if (error) setError(false);
    }
  }

  useEffect(() => {
    if (!active || !params.farmKey) return;
    if (readTrendCache(scopeId)) return;
    let cancelled = false;
    void fetchTrendShared(params.farmKey, scopeId, false)
      .then((result) => {
        if (!cancelled) {
          setBundle({ scopeId, data: result });
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [active, scopeId, params.farmKey]);

  const refresh = useCallback(() => {
    if (!params.farmKey) return Promise.resolve();
    setRefreshing(true);
    return fetchTrendShared(params.farmKey, scopeId, true)
      .then((result) => {
        setBundle({ scopeId, data: result });
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setRefreshing(false));
  }, [params.farmKey, scopeId]);

  // enabled=false여도 캐시는 유지 — 투어 pause 등으로 active가 꺼져도
  // 이미 받은 controllerTrend를 null로 지우지 않는다.
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
