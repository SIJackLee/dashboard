/**
 * 모바일 브라우저 주소창·하단 제어창 대응 — visualViewport 기준 투어 레이아웃.
 */

export const TOUR_MOBILE_SHEET_GAP = 8;
export const TOUR_SCROLL_MARGIN_TOP = 72;
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

export type TourScrollAlign = "anchor-top" | "fit-between";

export type TourScrollPolicy =
  | "none"
  | "fit-between"
  | "anchor-top"
  | "anchor-card-top";

export function resolveTourScrollPolicy(step: {
  scrollPolicy?: TourScrollPolicy;
  scrollAlign?: TourScrollAlign;
}): TourScrollPolicy {
  if (step.scrollPolicy) return step.scrollPolicy;
  if (step.scrollAlign) return step.scrollAlign;
  return "fit-between";
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

export function computeTourScrollBounds(tooltipHeight: number) {
  const viewport = getTourViewport();
  const headerClearance = Math.max(
    TOUR_SCROLL_MARGIN_TOP,
    viewport.top + 12,
  );
  const bottomReserve =
    tooltipHeight +
    viewport.browserChromeBottom +
    TOUR_MOBILE_SHEET_GAP +
    16;
  const maxBottom = viewport.top + viewport.height - bottomReserve;
  return { headerClearance, maxBottom, viewport };
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
  align?: TourScrollAlign;
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

  const policy = options?.scrollPolicy ?? options?.align ?? "fit-between";
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
  const { headerClearance } = computeTourScrollBounds(
    resolveTooltipHeight(tooltipHeight),
  );
  return Math.abs(el.getBoundingClientRect().top - headerClearance);
}

/** anchor-top — drift가 임계 이하가 될 때까지 반복 정렬. */
export function scrollTourTargetUntilAnchored(
  el: HTMLElement,
  options?: ScrollTourTargetOptions,
  maxAttempts = 4,
): void {
  const policy = options?.scrollPolicy ?? options?.align ?? "fit-between";
  if (policy !== "anchor-top" && policy !== "anchor-card-top") {
    scrollTourTargetIntoView(el, true, options);
    return;
  }

  const tooltipHeight = resolveTooltipHeight(options?.tooltipHeight);
  const { headerClearance } = computeTourScrollBounds(tooltipHeight);

  for (let i = 0; i < maxAttempts; i += 1) {
    if (measureTourAnchorTopDrift(el, tooltipHeight) < TOUR_REALIGN_DRIFT_THRESHOLD) {
      return;
    }
    scrollTourContainerToAnchorTop(el, headerClearance);
  }
}

/** 타깃이 툴팁·헤더 사이에 들어오지 못한 경우 양수(px). */
export function measureTourTargetAlignmentDrift(
  el: HTMLElement,
  tooltipHeight?: number | null,
  scrollPolicy?: TourScrollPolicy,
): number {
  if (scrollPolicy === "anchor-top" || scrollPolicy === "anchor-card-top") {
    return measureTourAnchorTopDrift(el, tooltipHeight);
  }

  const tipH = resolveTooltipHeight(tooltipHeight);
  const { headerClearance, maxBottom } = computeTourScrollBounds(tipH);
  const rect = el.getBoundingClientRect();
  const topDrift = Math.max(0, headerClearance - rect.top);
  const bottomDrift = Math.max(0, rect.bottom - maxBottom);
  return Math.max(topDrift, bottomDrift);
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
