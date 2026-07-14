"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appendFarmKeyParams } from "@/lib/data/farm-key";
import type { ControllerReading } from "@/lib/data/iot";
import { useDeferredLoading } from "@/lib/ui/use-deferred-loading";

type DetailState = {
  reading: ControllerReading | undefined;
  loading: boolean;
  showLoading: boolean;
  error: string | null;
};

/** 상세 LIVE 캐시 신선도(ms). 초과 시 재조회해 stale 값 재사용을 억제. */
const DETAIL_TTL_MS = 15_000;

type DetailCacheEntry = { value: ControllerReading; ts: number };

const detailCache = new Map<string, DetailCacheEntry>();
const inFlight = new Map<string, Promise<ControllerReading>>();

function detailCacheKey(base: ControllerReading): string {
  return base.key;
}

function getFreshCached(key: string): ControllerReading | undefined {
  const entry = detailCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts >= DETAIL_TTL_MS) return undefined;
  return entry.value;
}

function buildControllerDetailUrl(base: ControllerReading): string {
  const params = new URLSearchParams();
  appendFarmKeyParams(params, base.farmKey);
  params.set("module_uid", String(base.moduleUid));
  params.set("controller_key", base.controllerKey);
  return `/api/live/controller?${params.toString()}`;
}

async function fetchControllerDetail(base: ControllerReading): Promise<ControllerReading> {
  const key = detailCacheKey(base);
  const cached = getFreshCached(key);
  if (cached) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = fetch(buildControllerDetailUrl(base))
    .then(async (res) => {
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `http_${res.status}`);
      }
      return res.json() as Promise<ControllerReading>;
    })
    .then((full) => {
      detailCache.set(key, { value: full, ts: Date.now() });
      inFlight.delete(key);
      return full;
    })
    .catch((err) => {
      inFlight.delete(key);
      throw err;
    });

  inFlight.set(key, promise);
  return promise;
}

/** 그리드 drill 진입 전 상세 API 선로드 (캐시 공유). */
export function prefetchControllerDetail(base: ControllerReading | undefined): void {
  if (!base) return;
  const key = detailCacheKey(base);
  if (getFreshCached(key) || inFlight.has(key)) return;
  void fetchControllerDetail(base).catch(() => {
    /* prefetch — UI 에서 재시도 */
  });
}

/** 적용 후 LIVE thermo 재조회용 캐시 무효화 */
export function invalidateControllerDetail(base: ControllerReading | undefined): void {
  if (!base) return;
  detailCache.delete(detailCacheKey(base));
  inFlight.delete(detailCacheKey(base));
}

export function useControllerDetail(
  base: ControllerReading | undefined,
): DetailState & { refresh: () => void } {
  const [detail, setDetail] = useState<Partial<ControllerReading> | null>(() => {
    if (!base) return null;
    return getFreshCached(detailCacheKey(base)) ?? null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const silentRefreshRef = useRef(false);

  const refresh = useCallback(() => {
    if (!base) return;
    invalidateControllerDetail(base);
    silentRefreshRef.current = true;
    setRefreshTick((n) => n + 1);
  }, [base]);

  // 컨트롤러 전환 시 폴링 tick 초기화
  useEffect(() => {
    setRefreshTick(0);
    silentRefreshRef.current = false;
  }, [base?.key]);

  useEffect(() => {
    if (!base) {
      setDetail(null);
      setLoading(false);
      setError(null);
      return;
    }

    const key = detailCacheKey(base);
    const cached = refreshTick === 0 ? getFreshCached(key) : undefined;
    if (cached) {
      setDetail(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const silent = silentRefreshRef.current;
    if (!silent) setLoading(true);
    setError(null);

    // refresh 시 캐시 우회
    if (refreshTick > 0) {
      detailCache.delete(key);
      inFlight.delete(key);
    }

    fetchControllerDetail(base)
      .then((full) => {
        if (!cancelled) setDetail(full);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (!silent) setDetail(null);
          setError(err instanceof Error ? err.message : "fetch_failed");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          silentRefreshRef.current = false;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    base?.key,
    base?.farmKey.lsindRegistNo,
    base?.farmKey.itemCode,
    base?.moduleUid,
    base?.controllerKey,
    refreshTick,
  ]);

  const showLoading = useDeferredLoading(loading);

  if (!base) {
    return {
      reading: undefined,
      loading: false,
      showLoading: false,
      error: null,
      refresh,
    };
  }

  return {
    reading: detail ? { ...base, ...detail } : base,
    loading,
    showLoading,
    error,
    refresh,
  };
}
