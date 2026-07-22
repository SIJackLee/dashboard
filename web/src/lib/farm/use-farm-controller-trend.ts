"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchFarmControllerTrendAllPeriodsAction } from "@/app/(dashboard)/farm/actions";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import type { TrendControllerPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import { useDeferredLoading } from "@/lib/ui/use-deferred-loading";

export function useFarmControllerTrend(params: {
  farmKey: FarmKey | null;
  enabled: boolean;
}) {
  const scopeId = params.farmKey ? farmKeyId(params.farmKey) : "";
  const active = params.enabled && Boolean(params.farmKey);
  const [bundle, setBundle] = useState<{
    scopeId: string;
    data: Record<TrendPeriodId, TrendControllerPeriodData>;
  } | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!active || !params.farmKey) return;
    let cancelled = false;
    void fetchFarmControllerTrendAllPeriodsAction(params.farmKey)
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
    return fetchFarmControllerTrendAllPeriodsAction(params.farmKey, {
      refresh: true,
    })
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
