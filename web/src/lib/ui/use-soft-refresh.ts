"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDeferredLoading } from "@/lib/ui/use-deferred-loading";

const DEFAULT_BUSY_MS = 2500;

export function useSoftRefresh(
  onRefresh: () => void,
  options?: { busyMs?: number },
) {
  const busyMs = options?.busyMs ?? DEFAULT_BUSY_MS;
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const run = useCallback(() => {
    clearTimer();
    setBusy(true);
    onRefresh();
    timerRef.current = window.setTimeout(() => {
      setBusy(false);
      timerRef.current = null;
    }, busyMs);
  }, [busyMs, clearTimer, onRefresh]);

  const showProgress = useDeferredLoading(busy);

  return { run, busy, showProgress };
}
