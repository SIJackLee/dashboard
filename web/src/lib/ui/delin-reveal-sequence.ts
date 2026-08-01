/**
 * DELIN 스테이지 리빌 시퀀스 — 캔버스 비트( morph → chart → drag → scope )에 맞춤.
 * 한 번에 붙지 않고 천천히 순차 전환.
 */

export type DelinRevealBeat =
  | "idle"
  | "dock"
  | "chart"
  | "scopeDemo"
  | "ready";

/** ms — reduced-motion이면 즉시 ready */
export const DELIN_REVEAL_MS = {
  /** 도킹 애니 길이 (CSS --motion-aria-dock-duration 과 동기) */
  dock: 1400,
  /** 도킹 후 차트 등장 전 여유 */
  afterDockHold: 450,
  /** 차트 scale-up (CSS --motion-aria-reveal-duration 과 동기) */
  chartReveal: 1100,
  /** 차트 등장 후 스코프 데모 전 여유 */
  afterChartHold: 550,
  /** 클릭-드래그 스코프 시연 */
  scopeDemo: 3200,
} as const;

export const DELIN_REVEAL_LABEL: Record<
  Exclude<DelinRevealBeat, "idle">,
  string
> = {
  dock: "입력 도크 옆으로 이동 중…",
  chart: "차트 여는 중…",
  scopeDemo: "클릭·드래그로 스코프 중…",
  ready: "스코프 확정 · 조작 가능",
};

/** dock 캡션 — 추이 대기 시 AriaAnswerStage에서 별도 문구 */

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** dock 시작 → chart 비트까지 */
export function msUntilChartBeat(): number {
  return DELIN_REVEAL_MS.dock + DELIN_REVEAL_MS.afterDockHold;
}

/** chart 시작 → scopeDemo까지 (chart 비트 진입 시점 기준) */
export function msUntilScopeDemoBeat(): number {
  return DELIN_REVEAL_MS.chartReveal + DELIN_REVEAL_MS.afterChartHold;
}
