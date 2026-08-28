import type { FarmHubView } from "@/lib/farm/farm-view-url";

/** keep-alive 대상 — map은 항상 마운트 */
export type FarmHubKeepAlivePanel = "list" | "chart";

/**
 * 이탈 후 언마운트까지 대기.
 * - list: BarnTable·enrich 캐시 가치 있음
 * - chart: DOM/시리즈 무겁고 URL(`chart*`)로 복구 가능
 */
export const FARM_HUB_KEEPALIVE_TTL_MS: Record<FarmHubKeepAlivePanel, number> =
  {
    list: 5 * 60_000,
    chart: 3 * 60_000,
  };

export const FARM_HUB_KEEPALIVE_PANELS: readonly FarmHubKeepAlivePanel[] = [
  "list",
  "chart",
] as const;

export function isFarmHubKeepAlivePanel(
  view: FarmHubView,
): view is FarmHubKeepAlivePanel {
  return view === "list" || view === "chart";
}

/** 탭 전환 시 이탈/복귀 시각 맵 갱신 */
export function nextPanelInactiveSince(
  prev: Partial<Record<FarmHubKeepAlivePanel, number>>,
  from: FarmHubView,
  to: FarmHubView,
  now: number,
): Partial<Record<FarmHubKeepAlivePanel, number>> {
  if (from === to) return prev;
  const next = { ...prev };
  if (isFarmHubKeepAlivePanel(from)) next[from] = now;
  if (isFarmHubKeepAlivePanel(to)) delete next[to];
  return next;
}

/** 슬라이드·활성 탭이면 언마운트 보류 */
export function canUnmountKeepAlivePanel(
  panel: FarmHubKeepAlivePanel,
  activeView: FarmHubView,
  slide: { from: FarmHubView; to: FarmHubView } | null,
): boolean {
  if (activeView === panel) return false;
  if (slide && (slide.from === panel || slide.to === panel)) return false;
  return true;
}

/** TTL까지 남은 ms (이미 지났으면 0) */
export function keepAliveRemainingMs(
  leftAt: number,
  now: number,
  ttlMs: number,
): number {
  return Math.max(0, ttlMs - (now - leftAt));
}

/** 농장 전환 직후 — 활성 탭만 keep */
export function keepAliveFlagsForActiveView(activeView: FarmHubView): {
  list: boolean;
  chart: boolean;
} {
  return {
    list: activeView === "list",
    chart: activeView === "chart",
  };
}

/**
 * keep-alive로 DOM은 남아 있어도 LIVE·enrich·패널 폴링은 활성 탭만.
 * map은 상시 마운트이므로 activeView===map 일 때만 “맵 측” 백그라운드 채움.
 */
export function isFarmHubPanelLiveActive(
  activeView: FarmHubView,
  panel: FarmHubView,
): boolean {
  return activeView === panel;
}
