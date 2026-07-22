"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDeferredLoading } from "@/lib/ui/use-deferred-loading";

/** 너무 짧은 busy flash 방지 */
const DEFAULT_MIN_BUSY_MS = 200;
/** hung promise 안전망 */
const DEFAULT_MAX_BUSY_MS = 12_000;

export function useSoftRefresh(
  onRefresh: () => void | Promise<void>,
  options?: {
    /** @deprecated 완료 연동으로 대체 — minBusyMs 사용 */
    busyMs?: number;
    minBusyMs?: number;
    maxBusyMs?: number;
  },
) {
  const minBusyMs =
    options?.minBusyMs ?? options?.busyMs ?? DEFAULT_MIN_BUSY_MS;
  const maxBusyMs = options?.maxBusyMs ?? DEFAULT_MAX_BUSY_MS;
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);
  const runGenRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const run = useCallback(() => {
    clearTimer();
    const gen = ++runGenRef.current;
    setBusy(true);
    const started = Date.now();

    const finish = () => {
      if (gen !== runGenRef.current) return;
      const elapsed = Date.now() - started;
      const remain = Math.max(0, minBusyMs - elapsed);
      clearTimer();
      if (remain === 0) {
        setBusy(false);
        return;
      }
      timerRef.current = window.setTimeout(() => {
        if (gen !== runGenRef.current) return;
        setBusy(false);
        timerRef.current = null;
      }, remain);
    };

    const maxTimer = window.setTimeout(() => {
      if (gen !== runGenRef.current) return;
      finish();
    }, maxBusyMs);

    void Promise.resolve()
      .then(() => onRefresh())
      .catch(() => {
        /* 호출측에서 처리 — busy만 종료 */
      })
      .finally(() => {
        window.clearTimeout(maxTimer);
        finish();
      });
  }, [clearTimer, maxBusyMs, minBusyMs, onRefresh]);

  const showProgress = useDeferredLoading(busy);

  return { run, busy, showProgress };
}
