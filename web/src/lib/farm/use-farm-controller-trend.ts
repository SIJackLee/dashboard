"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchFarmControllerTrendAllPeriodsAction } from "@/app/(dashboard)/farm/actions";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import type { TrendControllerPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";

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
    if (!params.farmKey) return;
    setRefreshing(true);
    void fetchFarmControllerTrendAllPeriodsAction(params.farmKey, { refresh: true })
      .then((result) => {
        setBundle({ scopeId, data: result });
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setRefreshing(false));
  }, [params.farmKey, scopeId]);

  const data =
    active && bundle?.scopeId === scopeId ? bundle.data : null;
  const loading = active && (data === null || refreshing) && !error;

  return {
    data,
    loading,
    error: active && error,
    refresh,
  };
}
