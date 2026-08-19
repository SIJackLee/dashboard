"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchFarmControllerTrendPeriodAction,
  fetchFarmControllerTrendWindowAction,
} from "@/app/(dashboard)/farm/actions";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { expandCompactControllerPeriod } from "@/lib/data/farm-trend-compact";
import {
  emptyTrendControllerPeriodData,
  isCompleteControllerTrendBundle,
  type TrendControllerPeriodData,
  type TrendPeriodId,
  type TrendWindow15m,
} from "@/lib/data/farm-trend-types";
import {
  sliceControllerTrendByTime,
  sliceControllerTrendFromLonger,
} from "@/lib/data/trend-period-slice";
import {
  alignTrendWindow15m,
  window15mCovers,
} from "@/lib/farm/trend-brush-coverage";
import {
  invalidateTimedCache,
  readTimedCache,
  writeTimedCache,
  type TimedCacheEntry,
} from "@/lib/farm/client-trend-cache";
import { startSharedInflight } from "@/lib/farm/shared-inflight";
import { useDeferredLoading } from "@/lib/ui/use-deferred-loading";

type TrendBundle = Record<TrendPeriodId, TrendControllerPeriodData>;

type TrendSnapshot = {
  bundle: TrendBundle;
  window15m: TrendWindow15m | null;
};

/** map/list 훅 인스턴스 간 공유 — 탭 전환 시 이중 fetch 방지 · TTL 90s */
const trendCache = new Map<string, TimedCacheEntry<TrendSnapshot>>();
const trendInflight = new Map<string, Promise<TrendSnapshot>>();
const trendRefreshInflight = new Map<string, Promise<TrendSnapshot>>();
const trendWindowInflight = new Map<string, Promise<TrendSnapshot>>();
const trendListeners = new Map<string, Set<(snap: TrendSnapshot) => void>>();

export function peekFarmControllerTrendCache(
  farmKey: FarmKey,
): TrendBundle | null {
  return readTimedCache(trendCache, farmKeyId(farmKey))?.bundle ?? null;
}

export function invalidateFarmControllerTrendCache(farmKey: FarmKey): void {
  invalidateTimedCache(trendCache, farmKeyId(farmKey));
}

function readTrendCache(scopeId: string): TrendSnapshot | null {
  return readTimedCache(trendCache, scopeId);
}

function emptyBundle(): TrendBundle {
  return {
    "24h": emptyTrendControllerPeriodData("24h"),
    "7d": emptyTrendControllerPeriodData("7d"),
    "30d": emptyTrendControllerPeriodData("30d"),
  };
}

function emptySnapshot(): TrendSnapshot {
  return { bundle: emptyBundle(), window15m: null };
}

function notifyTrend(scopeId: string, snap: TrendSnapshot): void {
  writeTimedCache(trendCache, scopeId, snap);
  const listeners = trendListeners.get(scopeId);
  if (!listeners) return;
  for (const cb of listeners) cb(snap);
}

export function subscribeFarmControllerTrend(
  scopeId: string,
  cb: (bundle: TrendBundle) => void,
): () => void {
  const wrapped = (snap: TrendSnapshot) => cb(snap.bundle);
  let set = trendListeners.get(scopeId);
  if (!set) {
    set = new Set();
    trendListeners.set(scopeId, set);
  }
  set.add(wrapped);
  return () => {
    set!.delete(wrapped);
    if (set!.size === 0) trendListeners.delete(scopeId);
  };
}

function subscribeTrendSnapshot(
  scopeId: string,
  cb: (snap: TrendSnapshot) => void,
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

async function fetchPeriod(
  farmKey: FarmKey,
  period: TrendPeriodId,
): Promise<TrendControllerPeriodData> {
  const compact = await fetchFarmControllerTrendPeriodAction(farmKey, period);
  return expandCompactControllerPeriod(compact);
}

function periodTimeRange(
  data: TrendControllerPeriodData | null | undefined,
): { fromMs: number; toMs: number } | null {
  if (!data || data.bucketAts.length < 1) return null;
  const first = Date.parse(data.bucketAts[0] ?? "");
  const last = Date.parse(data.bucketAts[data.bucketAts.length - 1] ?? "");
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  const stride =
    data.bucketAts.length > 1
      ? Math.max(1, (last - first) / (data.bucketAts.length - 1))
      : 15 * 60 * 1000;
  return { fromMs: first, toMs: last + stride };
}

function windowFrom24h(
  h24: TrendControllerPeriodData,
  fromMs: number,
  toMs: number,
): TrendWindow15m | null {
  const cover = periodTimeRange(h24);
  if (!cover || !window15mCovers(cover, fromMs, toMs)) return null;
  const data = sliceControllerTrendByTime(h24, fromMs, toMs);
  if (!data || data.categories.length < 2) return null;
  return { fromMs, toMs, data };
}

async function loadProgressiveBundle(farmKey: FarmKey): Promise<TrendSnapshot> {
  const scopeId = farmKeyId(farmKey);
  const prev = readTrendCache(scopeId) ?? emptySnapshot();

  const h24 = await fetchPeriod(farmKey, "24h");
  let snap: TrendSnapshot = {
    bundle: {
      ...prev.bundle,
      "24h": h24,
    },
    window15m: prev.window15m,
  };
  notifyTrend(scopeId, snap);

  try {
    const d30 = await fetchPeriod(farmKey, "30d");
    const d7Slice = sliceControllerTrendFromLonger(d30, "7d");
    snap = {
      bundle: {
        "24h": h24,
        "7d":
          d7Slice && d7Slice.totalSamples > 0
            ? d7Slice
            : emptyTrendControllerPeriodData("7d"),
        "30d": d30,
      },
      window15m: prev.window15m,
    };
    notifyTrend(scopeId, snap);
  } catch {
    notifyTrend(scopeId, snap);
  }

  return snap;
}

async function loadWindow15m(
  farmKey: FarmKey,
  fromMs: number,
  toMs: number,
): Promise<TrendSnapshot> {
  const scopeId = farmKeyId(farmKey);
  const prev = readTrendCache(scopeId) ?? emptySnapshot();
  if (window15mCovers(prev.window15m, fromMs, toMs)) return prev;

  const local = windowFrom24h(prev.bundle["24h"], fromMs, toMs);
  if (local) {
    const snap = { ...prev, window15m: local };
    notifyTrend(scopeId, snap);
    return snap;
  }

  try {
    const compact = await fetchFarmControllerTrendWindowAction(
      farmKey,
      fromMs,
      toMs,
    );
    const data = expandCompactControllerPeriod(compact);
    const snap: TrendSnapshot = {
      ...prev,
      window15m: { fromMs, toMs, data },
    };
    notifyTrend(scopeId, snap);
    return snap;
  } catch {
    return prev;
  }
}

function fetchTrendShared(
  farmKey: FarmKey,
  scopeId: string,
  refresh: boolean,
): Promise<TrendSnapshot> {
  if (!refresh) {
    const cached = readTrendCache(scopeId);
    if (cached && isCompleteControllerTrendBundle(cached.bundle)) {
      return Promise.resolve(cached);
    }
  }

  const map = refresh ? trendRefreshInflight : trendInflight;
  return startSharedInflight(map, scopeId, () => loadProgressiveBundle(farmKey));
}

function fetchWindow15mShared(
  farmKey: FarmKey,
  fromMs: number,
  toMs: number,
): Promise<TrendSnapshot> {
  const scopeId = farmKeyId(farmKey);
  const cached = readTrendCache(scopeId);
  if (window15mCovers(cached?.window15m, fromMs, toMs)) {
    return Promise.resolve(cached!);
  }
  const local = cached ? windowFrom24h(cached.bundle["24h"], fromMs, toMs) : null;
  if (local && cached) {
    const snap = { ...cached, window15m: local };
    notifyTrend(scopeId, snap);
    return Promise.resolve(snap);
  }
  const key = `${scopeId}:${fromMs}:${toMs}`;
  return startSharedInflight(trendWindowInflight, key, () =>
    loadWindow15m(farmKey, fromMs, toMs),
  );
}

/** 로그인·농장 LIVE 이후 idle 시 호출 — 그래프 탭 대기 제거 */
export function prefetchFarmControllerTrend(farmKey: FarmKey): Promise<TrendBundle> {
  return fetchTrendShared(farmKey, farmKeyId(farmKey), false).then(
    (snap) => snap.bundle,
  );
}

export function useFarmControllerTrend(params: {
  farmKey: FarmKey | null;
  enabled: boolean;
}) {
  const scopeId = params.farmKey ? farmKeyId(params.farmKey) : "";
  const active = params.enabled && Boolean(params.farmKey);
  const applyTokenRef = useRef(0);
  const [snap, setSnap] = useState<{
    scopeId: string;
    data: TrendSnapshot;
  } | null>(() => {
    if (!scopeId) return null;
    const cached = readTrendCache(scopeId);
    return cached ? { scopeId, data: cached } : null;
  });
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [window15mLoading, setWindow15mLoading] = useState(false);

  if (active && scopeId) {
    const cached = readTrendCache(scopeId);
    if (cached && snap?.scopeId !== scopeId) {
      setSnap({ scopeId, data: cached });
      if (error) setError(false);
    }
  }

  useEffect(() => {
    if (!active || !params.farmKey) return;
    const token = ++applyTokenRef.current;
    const unsub = subscribeTrendSnapshot(scopeId, (data) => {
      if (token !== applyTokenRef.current) return;
      setSnap({ scopeId, data });
      setError(false);
    });
    const cached = readTrendCache(scopeId);
    if (!isCompleteControllerTrendBundle(cached?.bundle)) {
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

  const ensureWindow15m = useCallback(
    (fromMs: number, toMs: number) => {
      if (!params.farmKey) return Promise.resolve();
      const aligned = alignTrendWindow15m(fromMs, toMs);
      const cached = readTrendCache(scopeId);
      if (window15mCovers(cached?.window15m, aligned.fromMs, aligned.toMs)) {
        return Promise.resolve();
      }
      const token = applyTokenRef.current;
      setWindow15mLoading(true);
      return fetchWindow15mShared(
        params.farmKey,
        aligned.fromMs,
        aligned.toMs,
      )
        .then((result) => {
          if (token !== applyTokenRef.current) return;
          setSnap({ scopeId, data: result });
        })
        .catch(() => {
          if (token !== applyTokenRef.current) return;
          setError(true);
        })
        .finally(() => {
          if (token === applyTokenRef.current) setWindow15mLoading(false);
        });
    },
    [params.farmKey, scopeId],
  );

  const refresh = useCallback(() => {
    if (!params.farmKey) return Promise.resolve();
    const token = ++applyTokenRef.current;
    setRefreshing(true);
    return fetchTrendShared(params.farmKey, scopeId, true)
      .then((result) => {
        if (token !== applyTokenRef.current) return;
        setSnap({ scopeId, data: result });
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

  const data = snap?.scopeId === scopeId ? snap.data.bundle : null;
  const window15m =
    snap?.scopeId === scopeId ? snap.data.window15m : null;
  const initialPending = active && data === null && !error;
  const showInitialLoading = useDeferredLoading(initialPending);
  const showRefreshing = useDeferredLoading(refreshing);
  const isStale = refreshing && data !== null;
  const extending =
    active &&
    Boolean(data) &&
    !isCompleteControllerTrendBundle(data) &&
    !error;

  return {
    data,
    window15m,
    loading: showInitialLoading,
    extending,
    window15mLoading,
    refreshing: showRefreshing,
    isStale,
    error: active && error,
    refresh,
    ensureWindow15m,
  };
}
