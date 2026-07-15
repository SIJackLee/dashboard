/**
 * 모바일 브라우저 주소창·하단 제어창 대응 — visualViewport 기준 투어 레이아웃.
 */

export const TOUR_MOBILE_SHEET_GAP = 8;
export const TOUR_SCROLL_MARGIN_TOP = 96;
/** TopBar 하단 ~ 스포트라이트 상단 최소 여백 */
export const TOUR_HEADER_BOTTOM_GAP = 12;
/** 스텝 진입 후 스크롤·레이아웃 안착 대기(ms) */
export const TOUR_MOBILE_SETTLE_MS = 360;
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

  return () => {
    window.removeEventListener("resize", handler);
    window.visualViewport?.removeEventListener("resize", handler);
    window.visualViewport?.removeEventListener("scroll", handler);
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
  return Math.min(viewport.height * 0.52, 340);
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
    viewport.browserChromeBottom +
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

/** anchor-top — 헤더 clearance와의 절대 오차(px). */
export function measureTourAnchorTopDrift(
  el: HTMLElement,
  tooltipHeight?: number | null,
): number {
  return measureTourTargetBandDrift(el, tooltipHeight, "anchor-top").topDrift;
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

/** @deprecated scrollTourTargetUntilBandAligned 사용 */
export function scrollTourTargetUntilAnchored(
  el: HTMLElement,
  options?: ScrollTourTargetOptions,
  maxAttempts = 4,
): void {
  scrollTourTargetUntilBandAligned(el, options, maxAttempts);
}

/** 타깃이 툴팁·헤더 사이 band를 벗어난 최대 오차(px). */
export function measureTourTargetAlignmentDrift(
  el: HTMLElement,
  tooltipHeight?: number | null,
  scrollPolicy?: TourScrollPolicy,
): number {
  return measureTourTargetBandDrift(el, tooltipHeight, scrollPolicy).drift;
}

/** 투어 시작 직후 주소창 접힘 유도 — 보조 수단(1회). */
export function stabilizeMobileBrowserViewport(): Promise<void> {
  if (typeof window === "undefined" || window.innerWidth >= 768) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    markTourProgrammaticScroll(240);
    window.scrollBy({ top: 1, behavior: "auto" });
    window.setTimeout(() => {
      markTourProgrammaticScroll(240);
      window.scrollBy({ top: -1, behavior: "auto" });
      syncTourViewportCssVars();
      window.setTimeout(() => {
        syncTourViewportCssVars();
        resolve();
      }, 320);
    }, 120);
  });
}

/** 투어 bottom sheet — 화면 최하단(safe-area + 브라우저 크롬). */
export function mobileTourSheetBottomCss(): string {
  return `calc(env(safe-area-inset-bottom, 0px) + ${TOUR_MOBILE_SHEET_GAP}px + var(--vv-browser-chrome-bottom, 0px))`;
}

export function isMobileTourSheet(): boolean {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

export function resolveTourStepSelector(
  selector: string,
  mobileSelector?: string,
): string {
  if (isMobileTourSheet() && mobileSelector) return mobileSelector;
  return selector;
}
