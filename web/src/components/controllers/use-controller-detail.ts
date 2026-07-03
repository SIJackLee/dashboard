"use client";

import { useEffect, useState } from "react";
import { appendFarmKeyParams } from "@/lib/data/farm-key";
import type { ControllerReading } from "@/lib/data/iot";
import { useDeferredLoading } from "@/lib/ui/use-deferred-loading";

type DetailState = {
  reading: ControllerReading | undefined;
  loading: boolean;
  showLoading: boolean;
  error: string | null;
};

const detailCache = new Map<string, ControllerReading>();
const inFlight = new Map<string, Promise<ControllerReading>>();

function detailCacheKey(base: ControllerReading): string {
  return base.key;
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
  const cached = detailCache.get(key);
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
      detailCache.set(key, full);
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
  if (detailCache.has(key) || inFlight.has(key)) return;
  void fetchControllerDetail(base).catch(() => {
    /* prefetch — UI 에서 재시도 */
  });
}

export function useControllerDetail(
  base: ControllerReading | undefined,
): DetailState {
  const [detail, setDetail] = useState<Partial<ControllerReading> | null>(() => {
    if (!base) return null;
    return detailCache.get(detailCacheKey(base)) ?? null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base) {
      setDetail(null);
      setLoading(false);
      setError(null);
      return;
    }

    const key = detailCacheKey(base);
    const cached = detailCache.get(key);
    if (cached) {
      setDetail(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchControllerDetail(base)
      .then((full) => {
        if (!cancelled) setDetail(full);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDetail(null);
          setError(err instanceof Error ? err.message : "fetch_failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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
  ]);

  const showLoading = useDeferredLoading(loading);

  if (!base) {
    return { reading: undefined, loading: false, showLoading: false, error: null };
  }

  return {
    reading: detail ? { ...base, ...detail } : base,
    loading,
    showLoading,
    error,
  };
}
