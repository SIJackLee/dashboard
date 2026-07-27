/**
 * 모바일 브라우저 주소창·하단 제어창 대응 — visualViewport 기준 투어 레이아웃.
 */

import { isMobileLayoutActive } from "@/lib/ui/mobile-layout";
import {
  getViewportPreviewMode,
  isViewportCompact,
  subscribeViewportPreview,
} from "@/lib/ui/viewport-preview-store";

export const TOUR_MOBILE_SHEET_GAP = 8;
export const TOUR_SCROLL_MARGIN_TOP = 96;
/** TopBar 하단 ~ 스포트라이트 상단 최소 여백 */
export const TOUR_HEADER_BOTTOM_GAP = 12;
/** 스텝 진입 후 스크롤·레이아웃 fallback 대기(ms) — 이벤트 대기 실패 시. */
export const TOUR_MOBILE_SETTLE_MS = 80;
/** visualViewport resize debounce(ms) */
export const TOUR_VIEWPORT_RESIZE_DEBOUNCE_MS = 320;
/** 프로그램 스크롤 직후 vv.resize 무시(ms) — iOS 주소창 피드백 루프 차단 */
export const TOUR_PROGRAMMATIC_SCROLL_GUARD_MS = 520;
/** 재스크롤 허용 최소 정렬 오차(px) */
export const TOUR_REALIGN_DRIFT_THRESHOLD = 12;

let programmaticScrollUntil = 0;

export function markTourProgrammaticScroll(
  ms = TOUR_PROGRAMMATIC_SCROLL_GUARD_MS,
): void {
  programmaticScrollUntil = performance.now() + ms;
}

export function isTourProgrammaticScrollGuarded(): boolean {
  return performance.now() < programmaticScrollUntil;
}

export type TourViewportMetrics = {
  top: number;
  left: number;
  height: number;
  width: number;
  layoutHeight: number;
  layoutWidth: number;
  browserChromeTop: number;
  browserChromeBottom: number;
};

export type TourScrollPolicy =
  | "none"
  | "fit-between"
  | "anchor-top"
  | "anchor-card-top";

/** 상·하단 band 정렬 오차 — drift = max(topDrift, bottomDrift). */
export type TourTargetBandDrift = {
  topDrift: number;
  bottomDrift: number;
  drift: number;
  headerClearance: number;
  maxBottom: number;
};

export function resolveTourScrollPolicy(step: {
  scrollPolicy?: TourScrollPolicy;
}): TourScrollPolicy {
  return step.scrollPolicy ?? "fit-between";
}

export type TourPortalBounds = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const MOBILE_PREVIEW_BOTTOM_NAV_PX = 72;

/** PC 모바일 토글 — [data-mobile-preview-frame] 안에서 투어 UI를 그릴 때 */
export function isMobilePreviewFrame(): boolean {
  if (typeof document === "undefined") return false;
  if (!isViewportCompact(getViewportPreviewMode())) return false;
  return document.querySelector("[data-mobile-preview-frame]") !== null;
}

export function getTourPortalBounds(): TourPortalBounds | null {
  if (!isMobilePreviewFrame()) return null;
  const vp = getTourViewport();
  return {
    top: vp.top,
    left: vp.left,
    width: vp.width,
    height: vp.height,
  };
}

export function toTourLocalRect(rect: {
  top: number;
  left: number;
  width: number;
  height: number;
}): { top: number; left: number; width: number; height: number } {
  const bounds = getTourPortalBounds();
  if (!bounds) return rect;
  return {
    top: rect.top - bounds.top,
    left: rect.left - bounds.left,
    width: rect.width,
    height: rect.height,
  };
}

function getTourBottomChrome(viewport = getTourViewport()): number {
  if (isMobilePreviewFrame()) return MOBILE_PREVIEW_BOTTOM_NAV_PX;
  return viewport.browserChromeBottom;
}

export function getTourViewport(): TourViewportMetrics {
  if (typeof window === "undefined") {
    return {
      top: 0,
      left: 0,
      height: 800,
      width: 390,
      layoutHeight: 800,
      layoutWidth: 390,
      browserChromeTop: 0,
      browserChromeBottom: 0,
    };
  }

  const previewFrame = document.querySelector("[data-mobile-preview-frame]");
  if (previewFrame && isMobileLayoutActive()) {
    const rect = previewFrame.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      height: rect.height,
      width: rect.width,
      layoutHeight: rect.height,
      layoutWidth: rect.width,
      browserChromeTop: 0,
      browserChromeBottom: 0,
    };
  }

  const vv = window.visualViewport;
  const layoutHeight = window.innerHeight;
  const layoutWidth = window.innerWidth;

  if (!vv) {
    return {
      top: 0,
      left: 0,
      height: layoutHeight,
      width: layoutWidth,
      layoutHeight,
      layoutWidth,
      browserChromeTop: 0,
      browserChromeBottom: 0,
    };
  }

  const browserChromeTop = Math.max(0, vv.offsetTop);
  const browserChromeBottom = Math.max(
    0,
    layoutHeight - vv.offsetTop - vv.height,
  );

  return {
    top: vv.offsetTop,
    left: vv.offsetLeft,
    height: vv.height,
    width: vv.width,
    layoutHeight,
    layoutWidth,
    browserChromeTop,
    browserChromeBottom,
  };
}

export function syncTourViewportCssVars(viewport = getTourViewport()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--vvh", `${viewport.height}px`);
  root.style.setProperty("--vv-offset-top", `${viewport.top}px`);
  root.style.setProperty(
    "--vv-browser-chrome-bottom",
    `${viewport.browserChromeBottom}px`,
  );
}

/** CSS 변수만 동기 — scroll/resize마다 호출, 재스크롤 없음. */
export function subscribeTourViewportCssSync(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handler = () => syncTourViewportCssVars();
  syncTourViewportCssVars();
  window.addEventListener("resize", handler);
  window.visualViewport?.addEventListener("resize", handler);
  window.visualViewport?.addEventListener("scroll", handler);
  const unsubPreview = subscribeViewportPreview(handler);

  return () => {
    window.removeEventListener("resize", handler);
    window.visualViewport?.removeEventListener("resize", handler);
    window.visualViewport?.removeEventListener("scroll", handler);
    unsubPreview();
  };
}

/** 주소창 높이 변화 등 — debounce 후 1회 재스크롤. */
export function subscribeTourViewportResize(
  onResize: () => void,
  debounceMs = TOUR_VIEWPORT_RESIZE_DEBOUNCE_MS,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  let timer: number | undefined;
  const handler = () => {
    syncTourViewportCssVars();
    if (isTourProgrammaticScrollGuarded()) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(onResize, debounceMs);
  };

  window.addEventListener("resize", handler);
  window.visualViewport?.addEventListener("resize", handler);

  return () => {
    window.clearTimeout(timer);
    window.removeEventListener("resize", handler);
    window.visualViewport?.removeEventListener("resize", handler);
  };
}

export function estimateMobileTooltipHeight(
  viewport = getTourViewport(),
): number {
  return Math.min(viewport.height * 0.58, 360);
}

export function resolveTooltipHeight(
  measured: number | null | undefined,
  viewport = getTourViewport(),
): number {
  if (measured != null && measured > 0) return measured;
  return estimateMobileTooltipHeight(viewport);
}

/** TopBar 실제 하단 + 여백 — 모바일 헤더 높이 반영. */
export function measureHeaderClearance(viewport = getTourViewport()): number {
  if (typeof document !== "undefined") {
    const header = document.querySelector("header[data-app-header]");
    if (header instanceof HTMLElement) {
      const bottom = header.getBoundingClientRect().bottom;
      if (bottom > 0) {
        return Math.max(
          TOUR_SCROLL_MARGIN_TOP,
          bottom + TOUR_HEADER_BOTTOM_GAP,
        );
      }
    }
  }
  return Math.max(TOUR_SCROLL_MARGIN_TOP, viewport.top + TOUR_HEADER_BOTTOM_GAP);
}

export function computeTourScrollBounds(tooltipHeight: number) {
  const viewport = getTourViewport();
  const headerClearance = measureHeaderClearance(viewport);
  const bottomReserve =
    tooltipHeight +
    getTourBottomChrome(viewport) +
    TOUR_MOBILE_SHEET_GAP +
    16;
  const maxBottom = viewport.top + viewport.height - bottomReserve;
  return { headerClearance, maxBottom, viewport };
}

/** 목록 뷰 진입 시 스크롤 위치 초기화 — 7/8 스텝 타깃 일관성. */
export function resetTourScrollContainers(): void {
  if (typeof document === "undefined") return;
  const main = document.querySelector("main");
  if (main instanceof HTMLElement) {
    markTourProgrammaticScroll();
    main.scrollTop = 0;
  }
  if (document.scrollingElement instanceof HTMLElement) {
    markTourProgrammaticScroll();
    document.scrollingElement.scrollTop = 0;
  }
}

export function findTourScrollContainer(el: Element): HTMLElement | null {
  if (typeof document !== "undefined") {
    const main = document.querySelector("main");
    if (main instanceof HTMLElement && main.contains(el)) {
      const mainStyle = getComputedStyle(main);
      if (mainStyle.overflowY === "auto" || mainStyle.overflowY === "scroll") {
        return main;
      }
    }
  }

  let node = el.parentElement;
  while (node) {
    if (node instanceof HTMLElement) {
      const style = getComputedStyle(node);
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        return node;
      }
    }
    node = node.parentElement;
  }
  return document.scrollingElement instanceof HTMLElement
    ? document.scrollingElement
    : null;
}

export function scrollTourContainerBy(
  el: Element,
  delta: number,
  behavior: ScrollBehavior,
) {
  if (Math.abs(delta) < 1) return;
  markTourProgrammaticScroll();
  const scroller = findTourScrollContainer(el);
  if (scroller) {
    scroller.scrollBy({ top: delta, behavior });
  } else {
    window.scrollBy({ top: delta, behavior });
  }
}

/** anchor-top — scrollTop 절대값으로 1회 정렬(연속 scrollBy 누적 오차 방지). */
export function scrollTourContainerToAnchorTop(
  el: Element,
  headerClearance: number,
): boolean {
  const scroller = findTourScrollContainer(el);
  if (!scroller) return false;

  const elTop = el.getBoundingClientRect().top;
  const targetScrollTop = Math.max(0, scroller.scrollTop + elTop - headerClearance);

  if (Math.abs(scroller.scrollTop - targetScrollTop) < 1) return true;

  markTourProgrammaticScroll();
  scroller.scrollTop = targetScrollTop;
  return true;
}

export type ScrollTourTargetOptions = {
  scrollPolicy?: TourScrollPolicy;
  tooltipHeight?: number | null;
};

/** 모바일 — instant(auto) 1회만. PC — center smooth. */
export function scrollTourTargetIntoView(
  el: HTMLElement,
  mobileSheet: boolean,
  options?: ScrollTourTargetOptions,
) {
  if (!mobileSheet) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }

  const policy = options?.scrollPolicy ?? "fit-between";
  if (policy === "none") return;

  const tooltipHeight = resolveTooltipHeight(options?.tooltipHeight);
  const { headerClearance, maxBottom } = computeTourScrollBounds(tooltipHeight);
  const behavior: ScrollBehavior = "auto";

  if (policy === "anchor-top" || policy === "anchor-card-top") {
    scrollTourContainerToAnchorTop(el, headerClearance);
    return;
  }

  const align = () => {
    const rect = el.getBoundingClientRect();
    const targetH = rect.height;
    const desiredTop =
      targetH > maxBottom - headerClearance - 24
        ? headerClearance
        : Math.max(headerClearance, maxBottom - targetH - 12);

    scrollTourContainerBy(el, rect.top - desiredTop, behavior);

    const after = el.getBoundingClientRect();
    if (after.bottom > maxBottom - 8) {
      scrollTourContainerBy(el, after.bottom - maxBottom + 12, behavior);
    }
  };

  // 모바일 — scrollIntoView는 vv.resize를 유발해 피드백 루프를 만들 수 있어 수동 정렬만 사용.
  align();
}

/** 상·하단 scroll band와 타깃 rect 오차. anchor-top은 top만 검사. */
export function measureTourTargetBandDrift(
  el: HTMLElement,
  tooltipHeight?: number | null,
  scrollPolicy?: TourScrollPolicy,
): TourTargetBandDrift {
  const tipH = resolveTooltipHeight(tooltipHeight);
  const { headerClearance, maxBottom } = computeTourScrollBounds(tipH);
  const rect = el.getBoundingClientRect();

  if (scrollPolicy === "anchor-top" || scrollPolicy === "anchor-card-top") {
    const topDrift = Math.abs(rect.top - headerClearance);
    return { topDrift, bottomDrift: 0, drift: topDrift, headerClearance, maxBottom };
  }

  const topDrift = Math.max(0, headerClearance - rect.top);
  const bottomDrift = Math.max(0, rect.bottom - maxBottom);
  return {
    topDrift,
    bottomDrift,
    drift: Math.max(topDrift, bottomDrift),
    headerClearance,
    maxBottom,
  };
}

export function isTourTargetBandAligned(
  el: HTMLElement,
  tooltipHeight?: number | null,
  scrollPolicy?: TourScrollPolicy,
  threshold = TOUR_REALIGN_DRIFT_THRESHOLD,
): boolean {
  return (
    measureTourTargetBandDrift(el, tooltipHeight, scrollPolicy).drift < threshold
  );
}

/** fit-between·anchor-top — band drift가 임계 이하가 될 때까지 반복 정렬. */
export function scrollTourTargetUntilBandAligned(
  el: HTMLElement,
  options?: ScrollTourTargetOptions,
  maxAttempts = 6,
): void {
  const policy = options?.scrollPolicy ?? "fit-between";
  if (policy === "none") return;

  for (let i = 0; i < maxAttempts; i += 1) {
    if (isTourTargetBandAligned(el, options?.tooltipHeight, policy)) return;

    if (policy === "anchor-top" || policy === "anchor-card-top") {
      const { headerClearance } = computeTourScrollBounds(
        resolveTooltipHeight(options?.tooltipHeight),
      );
      scrollTourContainerToAnchorTop(el, headerClearance);
    } else {
      scrollTourTargetIntoView(el, true, options);
    }
  }
}

/** 투어 시작 직후 주소창 접힘 유도 — 보조 수단(1회). */
export function stabilizeMobileBrowserViewport(): Promise<void> {
  if (typeof window === "undefined" || !isMobileLayoutActive()) {
    return Promise.resolve();
  }

  if (isMobilePreviewFrame()) {
    syncTourViewportCssVars();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    markTourProgrammaticScroll(160);
    window.scrollBy({ top: 1, behavior: "auto" });
    window.setTimeout(() => {
      markTourProgrammaticScroll(160);
      window.scrollBy({ top: -1, behavior: "auto" });
      syncTourViewportCssVars();
      window.setTimeout(() => {
        syncTourViewportCssVars();
        resolve();
      }, 100);
    }, 50);
  });
}

/** 투어 bottom sheet — 화면 최하단(safe-area + 브라우저 크롬·하단 네비). */
export function mobileTourSheetBottomCss(): string {
  if (isMobilePreviewFrame()) {
    return `calc(env(safe-area-inset-bottom, 0px) + ${TOUR_MOBILE_SHEET_GAP}px + ${MOBILE_PREVIEW_BOTTOM_NAV_PX}px)`;
  }
  return `calc(env(safe-area-inset-bottom, 0px) + ${TOUR_MOBILE_SHEET_GAP}px + var(--vv-browser-chrome-bottom, 0px))`;
}

export function isMobileTourSheet(): boolean {
  return isMobileLayoutActive();
}

export function resolveTourStepSelector(
  selector: string,
  mobileSelector?: string,
): string {
  if (isMobileTourSheet() && mobileSelector) return mobileSelector;
  return selector;
}

/**
 * offsetParent===null(fixed 등)을 가시로 오인하지 않도록 getBoundingClientRect 기준.
 * 스크롤로 아직 안 보이는 타깃도 "존재"로 인정(크기만 확인).
 */
export function isTourElementPresent(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (typeof el.checkVisibility === "function") {
    try {
      if (
        !el.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        })
      ) {
        return false;
      }
    } catch {
      /* Safari 구버전 옵션 미지원 */
    }
  }
  const style = getComputedStyle(el);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number(style.opacity) === 0
  ) {
    return false;
  }
  const r = el.getBoundingClientRect();
  return r.width >= 2 && r.height >= 2;
}

/** 셀렉터 매치 중 뷰포트 교차 면적이 가장 큰 요소(없으면 첫 present). */
export function findBestTourTarget(selector: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const candidates: HTMLElement[] = [];
  for (const node of document.querySelectorAll(selector)) {
    if (isTourElementPresent(node)) candidates.push(node as HTMLElement);
  }
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const vv = getTourViewport();
  const viewTop = vv.top;
  const viewBottom = vv.top + vv.height;
  const viewLeft = vv.left;
  const viewRight = vv.left + vv.width;

  let best = candidates[0];
  let bestScore = -1;
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    const ih = Math.max(
      0,
      Math.min(r.bottom, viewBottom) - Math.max(r.top, viewTop),
    );
    const iw = Math.max(
      0,
      Math.min(r.right, viewRight) - Math.max(r.left, viewLeft),
    );
    const score = ih * iw > 0 ? ih * iw : r.width * r.height * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

export function countPresentTourTargets(selector: string): number {
  if (typeof document === "undefined") return 0;
  let n = 0;
  for (const node of document.querySelectorAll(selector)) {
    if (isTourElementPresent(node)) n += 1;
  }
  return n;
}

/** 스크롤 anchor — mobileScrollSelector가 있으면 스포트라이트와 분리. */
export function resolveTourScrollTarget(
  spotlightEl: HTMLElement,
  mobileScrollSelector?: string,
): HTMLElement {
  if (!isMobileTourSheet() || !mobileScrollSelector) return spotlightEl;
  return findBestTourTarget(mobileScrollSelector) ?? spotlightEl;
}

export type TourTooltipPlacement = {
  style: {
    left?: number | string;
    right?: number | string;
    top?: number | string;
    bottom?: number | string;
    width?: number | string;
    maxHeight?: number | string;
    transform?: string;
  };
  /** 하단 도킹 — 큰 타깃·공간 부족 시 */
  docked: boolean;
};

/**
 * 설명 카드가 뷰포트 밖으로 잘리지 않게 배치.
 * hole이 크거나 상·하 여백이 부족하면 하단 도킹.
 */
export function placeTourTooltip(opts: {
  hole: { top: number; left: number; width: number; height: number } | null;
  vw: number;
  vh: number;
  tooltipW: number;
  mobileSheet: boolean;
  mobileSheetBottom: string;
}): TourTooltipPlacement {
  const { hole, vw, vh, tooltipW, mobileSheet, mobileSheetBottom } = opts;

  if (mobileSheet) {
    return {
      style: {
        left: 8,
        right: 8,
        bottom: mobileSheetBottom,
        maxHeight: "min(58dvh, calc(var(--vvh, 58dvh) * 0.58))",
      },
      docked: true,
    };
  }

  const gap = 12;
  const edge = 12;
  const maxH = Math.min(Math.round(vh * 0.42), 400);
  const clampLeft = (raw: number) =>
    Math.min(Math.max(raw, edge), Math.max(edge, vw - tooltipW - edge));

  if (!hole) {
    return {
      style: {
        left: "50%",
        top: "42%",
        transform: "translate(-50%, -50%)",
        width: tooltipW,
        maxHeight: maxH,
      },
      docked: true,
    };
  }

  const spaceBelow = vh - (hole.top + hole.height) - gap;
  const spaceAbove = hole.top - gap;
  const holeLarge = hole.height > vh * 0.42;
  const preferDock = holeLarge || (spaceBelow < 200 && spaceAbove < 200);

  if (preferDock) {
    return {
      style: {
        left: clampLeft((vw - tooltipW) / 2),
        bottom: edge,
        width: tooltipW,
        maxHeight: maxH,
      },
      docked: true,
    };
  }

  if (spaceBelow >= Math.min(220, maxH) || spaceBelow >= spaceAbove) {
    const top = Math.min(hole.top + hole.height + gap, vh - maxH - edge);
    return {
      style: {
        left: clampLeft(hole.left),
        top: Math.max(edge, top),
        width: tooltipW,
        maxHeight: Math.min(maxH, Math.max(160, vh - Math.max(edge, top) - edge)),
      },
      docked: false,
    };
  }

  const bottom = Math.max(edge, vh - hole.top + gap);
  return {
    style: {
      left: clampLeft(hole.left),
      bottom,
      width: tooltipW,
      maxHeight: Math.min(maxH, Math.max(160, vh - bottom - edge)),
    },
    docked: false,
  };
}
