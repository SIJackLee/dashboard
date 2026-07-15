/**
 * 모바일 브라우저 주소창·하단 제어창 대응 — visualViewport 기준 투어 레이아웃.
 */

export const TOUR_MOBILE_SHEET_GAP = 8;
export const TOUR_SCROLL_MARGIN_TOP = 72;
/** dashboardUi.mobileBottomNavInset(4.5rem)과 동일 */
export const TOUR_MOBILE_APP_TAB_BAR_PX = 72;

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

export function subscribeTourViewport(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handler = () => {
    syncTourViewportCssVars();
    onChange();
  };

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
    TOUR_MOBILE_APP_TAB_BAR_PX +
    viewport.browserChromeBottom +
    TOUR_MOBILE_SHEET_GAP +
    16;
  const maxBottom = viewport.top + viewport.height - bottomReserve;
  return { headerClearance, maxBottom, viewport };
}

export function findTourScrollContainer(el: Element): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    if (node instanceof HTMLElement) {
      const style = getComputedStyle(node);
      if (
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight + 1
      ) {
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
  const scroller = findTourScrollContainer(el);
  if (scroller) {
    scroller.scrollBy({ top: delta, behavior });
  } else {
    window.scrollBy({ top: delta, behavior });
  }
}

export type ScrollTourTargetOptions = {
  align?: TourScrollAlign;
  tooltipHeight?: number | null;
};

function runMobileScrollAlignPasses(
  el: HTMLElement,
  alignFn: (behavior: ScrollBehavior) => void,
) {
  requestAnimationFrame(() => {
    alignFn("smooth");
    window.setTimeout(() => alignFn("smooth"), 280);
    window.setTimeout(() => alignFn("auto"), 520);
  });
}

/** 모바일 bottom sheet 툴팁 위에 대상이 보이도록 스크롤(main overflow 컨테이너 포함). */
export function scrollTourTargetIntoView(
  el: HTMLElement,
  mobileSheet: boolean,
  options?: ScrollTourTargetOptions,
) {
  if (!mobileSheet) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }

  const alignMode = options?.align ?? "fit-between";
  const tooltipHeight = resolveTooltipHeight(options?.tooltipHeight);
  const { headerClearance, maxBottom } = computeTourScrollBounds(tooltipHeight);

  if (alignMode === "anchor-top") {
    const alignTop = (behavior: ScrollBehavior) => {
      scrollTourContainerBy(
        el,
        el.getBoundingClientRect().top - headerClearance,
        behavior,
      );
    };
    runMobileScrollAlignPasses(el, alignTop);
    return;
  }

  const align = (behavior: ScrollBehavior = "auto") => {
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

  el.scrollIntoView({ block: "nearest", behavior: "auto" });
  runMobileScrollAlignPasses(el, align);
}

/** 투어 시작 직후 주소창 접힘 유도 — 보조 수단(1회). */
export function stabilizeMobileBrowserViewport(): Promise<void> {
  if (typeof window === "undefined" || window.innerWidth >= 768) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.scrollBy({ top: 1, behavior: "auto" });
    window.setTimeout(() => {
      window.scrollBy({ top: -1, behavior: "auto" });
      syncTourViewportCssVars();
      window.setTimeout(() => {
        syncTourViewportCssVars();
        resolve();
      }, 320);
    }, 120);
  });
}

export function mobileTourSheetBottomCss(): string {
  return `calc(4.5rem + env(safe-area-inset-bottom, 0px) + ${TOUR_MOBILE_SHEET_GAP}px + var(--vv-browser-chrome-bottom, 0px))`;
}
