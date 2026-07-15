/**
 * 스포트라이트 투어 — 이벤트 기반 대기·성능 측정.
 */

import { FARM_TOUR_ACTION_DONE_EVENT } from "@/lib/onboarding/tour-steps";

export const TOUR_LAYOUT_IDLE_MS = 48;
export const TOUR_LAYOUT_TIMEOUT_MS = 720;
export const TOUR_GRID_ACTION_TIMEOUT_MS = 620;
export const TOUR_EXTRA_MIN_HEIGHT = 120;
export const TOUR_REVEAL_MAX_ATTEMPTS = 4;
export const TOUR_FIND_INTERVAL_MS = 50;
export const TOUR_READY_INTERVAL_MS = 50;

/** rAF 연속 대기 */
export function afterFrames(count = 2): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      n += 1;
      if (n >= count) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** ResizeObserver — 크기 변화가 idleMs 동안 없으면 resolve. */
export function waitForResizeSettle(
  el: Element,
  opts?: { idleMs?: number; timeoutMs?: number },
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const idleMs = opts?.idleMs ?? TOUR_LAYOUT_IDLE_MS;
  const timeoutMs = opts?.timeoutMs ?? TOUR_LAYOUT_TIMEOUT_MS;

  return new Promise((resolve) => {
    let idleTimer: number | undefined;
    const finish = () => {
      ro.disconnect();
      window.clearTimeout(hardTimeout);
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      resolve();
    };
    const hardTimeout = window.setTimeout(finish, timeoutMs);
    const ro = new ResizeObserver(() => {
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(finish, idleMs);
    });
    ro.observe(el);
    idleTimer = window.setTimeout(finish, idleMs);
  });
}

/** 툴팁 extra(anatomy/pills) 렌더·높이 안정 대기. */
export function waitForTooltipExtraReady(
  tooltip: HTMLElement,
  opts?: { minHeight?: number; timeoutMs?: number },
): Promise<void> {
  const minHeight = opts?.minHeight ?? TOUR_EXTRA_MIN_HEIGHT;
  const timeoutMs = opts?.timeoutMs ?? TOUR_LAYOUT_TIMEOUT_MS;

  if (tooltip.querySelector("[data-tour-extra]")) {
    const h = tooltip.getBoundingClientRect().height;
    if (h >= minHeight) {
      return waitForResizeSettle(tooltip, {
        idleMs: TOUR_LAYOUT_IDLE_MS,
        timeoutMs: Math.min(timeoutMs, 280),
      });
    }
  }

  return new Promise((resolve) => {
    let ro: ResizeObserver | null = null;
    const hardTimeout = window.setTimeout(() => {
      ro?.disconnect();
      resolve();
    }, timeoutMs);

    const done = () => {
      window.clearTimeout(hardTimeout);
      ro?.disconnect();
      void waitForResizeSettle(tooltip, {
        idleMs: TOUR_LAYOUT_IDLE_MS,
        timeoutMs: 200,
      }).then(resolve);
    };

    const check = () => {
      const extra = tooltip.querySelector("[data-tour-extra]");
      const h = tooltip.getBoundingClientRect().height;
      if (extra && h >= minHeight) done();
    };

    ro = new ResizeObserver(check);
    ro.observe(tooltip);
    check();
  });
}

/** 그리드 expand/collapse 완료 — farm-map에서 dispatch. */
export function waitForTourGridAction(
  action: "expand-first" | "collapse",
  timeoutMs = TOUR_GRID_ACTION_TIMEOUT_MS,
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(hardTimeout);
      window.removeEventListener(FARM_TOUR_ACTION_DONE_EVENT, onDone);
      resolve();
    };
    const hardTimeout = window.setTimeout(done, timeoutMs);
    const onDone = (e: Event) => {
      const detail = (e as CustomEvent<{ action?: string }>).detail;
      if (detail?.action === action) done();
    };
    window.addEventListener(FARM_TOUR_ACTION_DONE_EVENT, onDone);
  });
}

export function dispatchTourGridActionDone(
  action: "expand-first" | "collapse",
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(FARM_TOUR_ACTION_DONE_EVENT, { detail: { action } }),
  );
}

/** 스텝 hole-ready 시각 — audit 스크립트용. */
export function markTourStepReady(stepIdx: number): void {
  if (typeof window === "undefined") return;
  const key = `farm-tour-step-${stepIdx + 1}-ready`;
  performance.mark(key);
  document.documentElement.dataset.farmTourStep = String(stepIdx + 1);
  document.documentElement.dataset.farmTourSettling = "false";
}

export function markTourStepSettling(): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.farmTourSettling = "true";
}
