"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** 연속 router.refresh 간 최소 간격 — RSC POST 경합 완화 */
const REFRESH_GAP_MS = 320;
/** debounce — 짧은 시간 내 중복 refresh 병합 */
const DEBOUNCE_MS = 160;

let debounceTimer: number | undefined;
let refreshInFlight = false;
let refreshQueued = false;

/**
 * `/farm` 등 server action과 겹칠 때 `Unexpected end of JSON input` 완화.
 * refresh 호출을 debounce·직렬화한다.
 */
export function scheduleSafeRouterRefresh(
  router: Pick<AppRouterInstance, "refresh">,
): void {
  if (typeof window === "undefined") return;
  refreshQueued = true;
  if (debounceTimer != null) return;
  debounceTimer = window.setTimeout(() => {
    debounceTimer = undefined;
    if (!refreshQueued) return;
    refreshQueued = false;
    if (document.visibilityState === "hidden") return;
    if (refreshInFlight) {
      refreshQueued = true;
      scheduleSafeRouterRefresh(router);
      return;
    }
    refreshInFlight = true;
    try {
      router.refresh();
    } finally {
      window.setTimeout(() => {
        refreshInFlight = false;
        if (refreshQueued) scheduleSafeRouterRefresh(router);
      }, REFRESH_GAP_MS);
    }
  }, DEBOUNCE_MS);
}
