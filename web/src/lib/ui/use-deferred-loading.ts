"use client";

import { useEffect, useState } from "react";

export const DEFERRED_LOADING_MS = 200;

/** 빠른 fetch 시 spinner flash를 줄이기 위해 delay 후에만 true */
export function useDeferredLoading(
  active: boolean,
  delayMs = DEFERRED_LOADING_MS,
): boolean {
  const [pastDelay, setPastDelay] = useState(false);

  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => setPastDelay(true), delayMs);
    return () => {
      window.clearTimeout(id);
      setPastDelay(false);
    };
  }, [active, delayMs]);

  return active && pastDelay;
}
