"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  FARM_TOUR_ACTION_EVENT,
  FARM_TOUR_ACTIVE_EVENT,
  FARM_TOUR_RESTART_EVENT,
  FARM_TOUR_RESTART_FLAG,
  TOUR_READY_SELECTOR,
  TOUR_STEPS,
  type TourStepDef,
  type TourView,
} from "@/lib/onboarding/tour-steps";
import {
  afterFrames,
  markTourStepReady,
  markTourStepSettling,
  TOUR_FIND_INTERVAL_MS,
  TOUR_READY_INTERVAL_MS,
  TOUR_REVEAL_MAX_ATTEMPTS,
  waitForTooltipExtraReady,
  waitForTourGridAction,
} from "@/lib/onboarding/tour-timing";
import type { TourGridAction } from "@/lib/onboarding/tour-grid-actions";
import {
  markOnboardingTourDoneAction,
  shouldShowOnboardingTourAction,
} from "@/app/(dashboard)/farm/onboarding-actions";
import { GaugeAnatomy, HeaderIconsGuide, PanelPillsGuide } from "@/components/onboarding/tour-guides";
import {
  getTourViewport,
  getTourPortalBounds,
  toTourLocalRect,
  mobileTourSheetBottomCss,
  isTourTargetBandAligned,
  measureTourTargetBandDrift,
  resetTourScrollContainers,
  resolveTourScrollPolicy,
  resolveTourScrollTarget,
  resolveTourStepSelector,
  scrollTourTargetIntoView,
  scrollTourTargetUntilBandAligned,
  stabilizeMobileBrowserViewport,
  isMobileTourSheet,
  subscribeTourViewportCssSync,
  subscribeTourViewportResize,
  TOUR_MOBILE_SETTLE_MS,
  TOUR_REALIGN_DRIFT_THRESHOLD,
  type TourScrollPolicy,
} from "@/lib/onboarding/tour-viewport";
import { subscribeViewportPreview } from "@/lib/ui/viewport-preview-store";

type Rect = { top: number; left: number; width: number; height: number };

const HOLE_PAD = 6;
const TOOLTIP_W = 440;
const TOOLTIP_W_MOBILE = 400;
const FIND_RETRIES = 24;
const READY_RETRIES = 60;

function isTourTargetVisible(selector: string): boolean {
  return findVisibleTourTarget(selector) !== null;
}

/** display:none·lg:hidden 등으로 숨긴 첫 매치를 건너뛰고 실제 보이는 대상을 반환. */
function findVisibleTourTarget(selector: string): Element | null {
  for (const el of document.querySelectorAll(selector)) {
    if ((el as HTMLElement).offsetParent !== null) return el;
  }
  return null;
}

import { cn } from "@/lib/utils";

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return toTourLocalRect({
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
  });
}

function getStepSpotlightSelector(step: TourStepDef): string {
  return resolveTourStepSelector(step.selector, step.mobileSelector);
}

function dispatchGridAction(action: TourGridAction) {
  window.dispatchEvent(
    new CustomEvent(FARM_TOUR_ACTION_EVENT, { detail: { action } }),
  );
}

function setFarmTourActive(active: boolean): void {
  window.dispatchEvent(
    new CustomEvent(FARM_TOUR_ACTIVE_EVENT, { detail: { active } }),
  );
}

/**
 * 스포트라이트 투어 오버레이 — 대상 요소를 밝게 남기고 나머지를 어둡게 처리.
 * 스텝마다 뷰 전환(preAction)·확대 상세 열기를 수행하고 대상 요소를 폴링으로 찾는다.
 * 대상이 없는 스텝(데이터 없음 등)은 진행 방향으로 자동 건너뛴다.
 */
function TourOverlay({
  initialView,
  setView,
  onFinish,
}: {
  initialView: TourView;
  setView: (v: TourView) => void;
  onFinish: (completed: boolean) => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [accentRect, setAccentRect] = useState<Rect | null>(null);
  const [holeReady, setHoleReady] = useState(false);
  const [settling, setSettling] = useState(false);
  const dirRef = useRef<1 | -1>(1);
  const stepGenRef = useRef(0);
  const tooltipRealignedRef = useRef(false);
  const targetRef = useRef<Element | null>(null);
  const accentRef = useRef<Element | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [viewportReady, setViewportReady] = useState(false);
  const [portalBounds, setPortalBounds] = useState<ReturnType<
    typeof getTourPortalBounds
  >>(() => (typeof window !== "undefined" ? getTourPortalBounds() : null));
  const step = TOUR_STEPS[stepIdx];
  const scrollPolicy: TourScrollPolicy = resolveTourScrollPolicy(step);
  const scrollEnabled = scrollPolicy !== "none";

  const getTooltipHeight = useCallback(
    () => tooltipRef.current?.getBoundingClientRect().height ?? null,
    [],
  );

  const measureTargets = useCallback(() => {
    if (targetRef.current) setRect(measure(targetRef.current));
    if (accentRef.current) setAccentRect(measure(accentRef.current));
    else setAccentRect(null);
  }, []);

  const runTargetScrollOnce = useCallback(() => {
    const spotlight = targetRef.current as HTMLElement | null;
    if (!spotlight || !isMobileTourSheet() || !scrollEnabled) return;
    const scrollEl = resolveTourScrollTarget(
      spotlight,
      step.mobileScrollSelector,
    );
    scrollTourTargetUntilBandAligned(
      scrollEl,
      {
        scrollPolicy,
        tooltipHeight: getTooltipHeight(),
      },
      3,
    );
  }, [scrollPolicy, scrollEnabled, getTooltipHeight, step.mobileScrollSelector]);

  const finish = useCallback(
    (completed: boolean) => {
      dispatchGridAction("collapse");
      setView(initialView);
      onFinish(completed);
    },
    [initialView, setView, onFinish],
  );

  const goTo = useCallback(
    (next: number, dir: 1 | -1) => {
      dirRef.current = dir;
      if (next < 0) return;
      if (next >= TOUR_STEPS.length) {
        finish(true);
        return;
      }
      stepGenRef.current += 1;
      tooltipRealignedRef.current = false;
      markTourStepSettling();
      setSettling(true);
      setStepIdx(next);
    },
    [finish],
  );

  // P2 — 투어 시작 시 모바일 브라우저 주소창 안정화(1회).
  useEffect(() => {
    let cancelled = false;
    const markReady = () => {
      if (!cancelled) setViewportReady(true);
    };
    if (typeof window === "undefined" || !isMobileTourSheet()) {
      markReady();
      return () => {
        cancelled = true;
      };
    }
    void stabilizeMobileBrowserViewport().then(markReady);
    return () => {
      cancelled = true;
    };
  }, []);

  // 모바일 프리뷰 프레임 경계 — 토글·리사이즈 시 투어 오버레이 재정렬
  useEffect(() => {
    const sync = () => {
      setPortalBounds(getTourPortalBounds());
      measureTargets();
    };
    sync();
    const unsub = subscribeViewportPreview(sync);
    window.addEventListener("resize", sync);
    return () => {
      unsub();
      window.removeEventListener("resize", sync);
    };
  }, [measureTargets]);

  // 스텝 진입 — 이벤트 기반 layout settle → scroll 1회 → hole 표시.
  useEffect(() => {
    if (!viewportReady) return;
    const stepGen = stepGenRef.current;
    let cancelled = false;
    let attempts = 0;
    const timers: number[] = [];
    const spotlightSelector = getStepSpotlightSelector(step);
    const prevStep = stepIdx > 0 ? TOUR_STEPS[stepIdx - 1] : null;

    targetRef.current = null;
    accentRef.current = null;

    const schedule = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const stepScrollPolicy = resolveTourScrollPolicy(step);
    const stepScrollEnabled = stepScrollPolicy !== "none";

    const scrollTargetOnce = (scrollEl: HTMLElement) => {
      if (!stepScrollEnabled || !isMobileTourSheet()) return;
      scrollTourTargetUntilBandAligned(
        scrollEl,
        {
          scrollPolicy: stepScrollPolicy,
          tooltipHeight: getTooltipHeight(),
        },
        3,
      );
    };

    const resolveScrollEl = (spotlightEl: HTMLElement) =>
      resolveTourScrollTarget(spotlightEl, step.mobileScrollSelector);

    const completeStep = (el: HTMLElement) => {
      if (cancelled || stepGenRef.current !== stepGen || targetRef.current !== el) {
        return;
      }
      measureTargets();
      setSettling(false);
      setHoleReady(true);
      markTourStepReady(stepIdx);
    };

    const revealHole = async (spotlightEl: HTMLElement) => {
      const scrollEl = resolveScrollEl(spotlightEl);
      for (let attempt = 0; attempt < TOUR_REVEAL_MAX_ATTEMPTS; attempt += 1) {
        if (
          cancelled ||
          stepGenRef.current !== stepGen ||
          targetRef.current !== spotlightEl
        ) {
          return;
        }
        if (stepScrollEnabled) scrollTargetOnce(scrollEl);
        await afterFrames(1);
        const band = measureTourTargetBandDrift(
          scrollEl,
          getTooltipHeight(),
          stepScrollPolicy,
        );
        if (band.drift < TOUR_REALIGN_DRIFT_THRESHOLD) {
          completeStep(spotlightEl);
          return;
        }
      }
      completeStep(spotlightEl);
    };

    const finalizeMobileStep = async (el: HTMLElement) => {
      if (cancelled || stepGenRef.current !== stepGen) return;
      setSettling(true);
      markTourStepSettling();

      try {
        if (step.gridAction) {
          await waitForTourGridAction(step.gridAction);
        } else if (prevStep?.view !== step.view) {
          await afterFrames(2);
        } else {
          await afterFrames(1);
        }

        if (step.extra && tooltipRef.current) {
          await waitForTooltipExtraReady(tooltipRef.current);
        }

        if (!stepScrollEnabled) {
          completeStep(el);
          return;
        }

        await revealHole(el);
      } catch {
        completeStep(el);
      }
    };

    const finalizeDesktopStep = async (el: HTMLElement) => {
      if (cancelled || stepGenRef.current !== stepGen) return;
      scrollTourTargetIntoView(el, false);
      await afterFrames(2);
      completeStep(el);
    };

    const runStepEntry = () => {
      if (cancelled || stepGenRef.current !== stepGen) return;
      setView(step.view);
      if (step.view === "list" && prevStep?.view !== "list") {
        resetTourScrollContainers();
      }
      if (step.gridAction) dispatchGridAction(step.gridAction);
    };

    const locate = () => {
      if (cancelled || stepGenRef.current !== stepGen) return;
      const isMobileSheet = isMobileTourSheet();
      const el = findVisibleTourTarget(spotlightSelector);
      if (el && (el as HTMLElement).offsetParent !== null) {
        targetRef.current = el;
        if (step.accentSelector) {
          const useMobileAlt =
            isMobileSheet && Boolean(step.mobileSelector);
          if (!useMobileAlt) {
            accentRef.current =
              el.querySelector(step.accentSelector) ??
              document.querySelector(step.accentSelector);
          } else {
            accentRef.current = null;
          }
        } else {
          accentRef.current = null;
        }

        void (isMobileSheet
          ? finalizeMobileStep(el as HTMLElement)
          : finalizeDesktopStep(el as HTMLElement));
        return;
      }
      if (step.skipIfMissing) {
        const next = stepIdx + dirRef.current;
        if (next < 0 || next >= TOUR_STEPS.length) finish(true);
        else setStepIdx(next);
        return;
      }
      attempts += 1;
      if (attempts >= FIND_RETRIES) {
        const next = stepIdx + dirRef.current;
        if (next < 0 || next >= TOUR_STEPS.length) finish(true);
        else setStepIdx(next);
        return;
      }
      schedule(locate, TOUR_FIND_INTERVAL_MS);
    };

    schedule(() => {
      runStepEntry();
    }, 0);

    requestAnimationFrame(() => {
      if (!cancelled && stepGenRef.current === stepGen) locate();
    });

    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
  }, [
    stepIdx,
    step,
    setView,
    finish,
    viewportReady,
    measureTargets,
    getTooltipHeight,
  ]);

  // scroll → rect만(rAF). resize → drift 임계 초과 시 1회 재스크롤.
  useEffect(() => {
    let raf = 0;
    let tooltipResizeTimer: number | undefined;
    let realignSettleTimer: number | undefined;
    const effectGen = stepGenRef.current;

    const onScrollMeasure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measureTargets);
    };

    const realignMobileTargetIfNeeded = (force = false) => {
      const spotlight = targetRef.current as HTMLElement | null;
      if (!spotlight || !isMobileTourSheet() || !scrollEnabled) return false;
      const scrollEl = resolveTourScrollTarget(
        spotlight,
        step.mobileScrollSelector,
      );
      const drift = measureTourTargetBandDrift(
        scrollEl,
        getTooltipHeight(),
        scrollPolicy,
      ).drift;
      if (!force && drift < TOUR_REALIGN_DRIFT_THRESHOLD) return false;
      setSettling(true);
      runTargetScrollOnce();
      window.clearTimeout(realignSettleTimer);
      realignSettleTimer = window.setTimeout(() => {
        if (stepGenRef.current !== effectGen) return;
        measureTargets();
        setSettling(false);
      }, TOUR_MOBILE_SETTLE_MS);
      return true;
    };

    const onTooltipResize = () => {
      if (!isMobileTourSheet()) return;
      window.clearTimeout(tooltipResizeTimer);
      tooltipResizeTimer = window.setTimeout(() => {
        if (!scrollEnabled) {
          measureTargets();
          return;
        }
        if (!holeReady || settling) {
          const el = targetRef.current as HTMLElement | null;
          if (el && realignMobileTargetIfNeeded(true)) return;
        }
        if (holeReady && !tooltipRealignedRef.current) {
          if (realignMobileTargetIfNeeded(true)) {
            tooltipRealignedRef.current = true;
          }
        } else if (holeReady) {
          measureTargets();
        }
      }, 120);
    };

    window.addEventListener("scroll", onScrollMeasure, true);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        const fromTooltip = entries.some(
          (entry) => entry.target === tooltipRef.current,
        );
        if (fromTooltip) onTooltipResize();
        else onScrollMeasure();
      });
      if (targetRef.current) ro.observe(targetRef.current);
      if (accentRef.current) ro.observe(accentRef.current);
      if (tooltipRef.current) ro.observe(tooltipRef.current);
    }

    const unsubCss = subscribeTourViewportCssSync();
    const unsubResize = subscribeTourViewportResize(() => {
      if (!holeReady || !targetRef.current || !isMobileTourSheet()) return;
      realignMobileTargetIfNeeded(false);
    });

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(tooltipResizeTimer);
      window.clearTimeout(realignSettleTimer);
      window.removeEventListener("scroll", onScrollMeasure, true);
      ro?.disconnect();
      unsubCss();
      unsubResize();
    };
  }, [stepIdx, holeReady, measureTargets, runTargetScrollOnce, getTooltipHeight, scrollEnabled, scrollPolicy]);

  // Esc — 건너뛰기(완료 저장).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
      else if (e.key === "ArrowRight") goTo(stepIdx + 1, 1);
      else if (e.key === "ArrowLeft") goTo(stepIdx - 1, -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, goTo, stepIdx]);

  const tourVp = typeof window !== "undefined" ? getTourViewport() : null;
  const vw = tourVp?.layoutWidth ?? 1280;
  const vh = tourVp?.height ?? 800;
  const mobileSheet = isMobileTourSheet();
  const tooltipW = mobileSheet
    ? Math.min(TOOLTIP_W_MOBILE, vw - 24)
    : Math.min(TOOLTIP_W, vw - 24);
  const mobileSheetBottom = mobileTourSheetBottomCss();

  const hole = holeReady && rect
    ? {
        top: rect.top - HOLE_PAD,
        left: rect.left - HOLE_PAD,
        width: rect.width + HOLE_PAD * 2,
        height: rect.height + HOLE_PAD * 2,
      }
    : null;

  // 툴팁 배치 — 대상 아래 우선, 공간 부족 시 위. 가로는 뷰포트 안으로 클램프.
  let tooltipStyle: React.CSSProperties;
  if (mobileSheet) {
    tooltipStyle = { left: 8, right: 8, bottom: mobileSheetBottom };
  } else if (hole) {
    const left = Math.min(Math.max(hole.left, 12), Math.max(12, vw - tooltipW - 12));
    const spaceBelow = vh - (hole.top + hole.height);
    if (spaceBelow >= 260 || hole.top < 220) {
      tooltipStyle = { left, top: Math.min(hole.top + hole.height + 12, vh - 120), width: tooltipW };
    } else {
      tooltipStyle = { left, bottom: vh - hole.top + 12, width: tooltipW };
    }
  } else {
    tooltipStyle = { left: "50%", top: "40%", transform: "translate(-50%,-50%)", width: tooltipW };
  }

  return createPortal(
    <div
      className={cn(
        "fixed z-[9990] overflow-hidden",
        portalBounds ? "" : "inset-0",
      )}
      style={
        portalBounds
          ? {
              top: portalBounds.top,
              left: portalBounds.left,
              width: portalBounds.width,
              height: portalBounds.height,
            }
          : undefined
      }
      data-farm-tour-root
      role="dialog"
      aria-modal="true"
      aria-label="기능 안내 투어"
    >
      {/* 딤 + 스포트라이트 홀 */}
      {hole ? (
        <div
          className={cn(
            "farm-tour-hole pointer-events-none absolute rounded-xl",
            mobileSheet && "farm-tour-hole--mobile",
          )}
          data-settling={settling ? "true" : undefined}
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 200vmax rgba(9, 12, 20, 0.62)",
          }}
          aria-hidden
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(9,12,20,0.62)]" aria-hidden />
      )}
      {/* 클릭 차단 레이어(홀 포함 전체) */}
      <div className="absolute inset-0" aria-hidden />

      {/* 보조 강조 — 드래그 손잡이 등 */}
      {accentRect ? (
        <div
          className="farm-tour-accent pointer-events-none absolute rounded-md"
          style={{
            top: accentRect.top - 4,
            left: accentRect.left - 4,
            width: accentRect.width + 8,
            height: accentRect.height + 8,
          }}
          aria-hidden
        />
      ) : null}

      {/* 툴팁 */}
      <div
        ref={tooltipRef}
        className={cn(
          "farm-tour-tooltip absolute overflow-y-auto rounded-xl border bg-card text-card-foreground shadow-2xl",
          mobileSheet
            ? "max-h-[min(52dvh,calc(var(--vvh,52dvh)*0.52))] p-5"
            : "max-h-[75vh] p-6",
        )}
        style={tooltipStyle}
        data-mobile={mobileSheet ? "true" : undefined}
      >
        <div className={cn("flex items-center gap-2", mobileSheet ? "mb-1.5" : "mb-2")}>
          <span
            className={cn(
              "font-semibold tabular-nums text-muted-foreground",
              mobileSheet ? "text-xs" : "text-sm",
            )}
          >
            {stepIdx + 1} / {TOUR_STEPS.length}
          </span>
          <span className="ml-auto" />
          <button
            type="button"
            onClick={() => finish(false)}
            className={cn(
              "rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              mobileSheet ? "p-0.5" : "p-1",
            )}
            aria-label="투어 닫기"
          >
            <X className={mobileSheet ? "size-3.5" : "size-4"} aria-hidden />
          </button>
        </div>
        <p
          className={cn(
            "font-bold leading-snug",
            mobileSheet ? "text-base" : "text-lg",
          )}
        >
          {step.title}
        </p>
        <p
          className={cn(
            "leading-relaxed text-muted-foreground",
            mobileSheet ? "mt-1 text-sm" : "mt-1.5 text-[0.9375rem]",
          )}
        >
          {step.body}
        </p>
        {step.extra === "anatomy" ? (
          <div className={mobileSheet ? "mt-2.5" : "mt-3"} data-tour-extra="anatomy">
            <GaugeAnatomy compact={mobileSheet} />
          </div>
        ) : null}
        {step.extra === "pills" ? (
          <div className={mobileSheet ? "mt-2.5" : "mt-3"} data-tour-extra="pills">
            <PanelPillsGuide compact={mobileSheet} />
          </div>
        ) : null}
        {step.extra === "header-icons" ? (
          <div className={mobileSheet ? "mt-2.5" : "mt-3"} data-tour-extra="header-icons">
            <HeaderIconsGuide compact={mobileSheet} />
          </div>
        ) : null}

        <div
          className={cn(
            mobileSheet ? "mt-3 flex flex-col gap-2.5" : "mt-4 flex items-center gap-1.5",
          )}
        >
          <div className="flex items-center justify-center gap-1.5">
            {TOUR_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "rounded-full transition-colors",
                  mobileSheet ? "size-1.5" : "size-2",
                  i === stepIdx ? "bg-sky-500" : "bg-muted-foreground/25",
                )}
                aria-hidden
              />
            ))}
          </div>
          <div
            className={cn(
              "flex items-center gap-2",
              mobileSheet ? "justify-end" : "ml-auto",
            )}
          >
            <button
              type="button"
              onClick={() => finish(false)}
              className={cn(
                "rounded-md font-medium text-muted-foreground transition-colors hover:bg-muted",
                mobileSheet ? "px-2 py-1.5 text-xs" : "px-2.5 py-1.5 text-sm",
              )}
            >
              건너뛰기
            </button>
            {stepIdx > 0 ? (
              <button
                type="button"
                onClick={() => goTo(stepIdx - 1, -1)}
                className={cn(
                  "rounded-md border font-semibold transition-colors hover:bg-muted",
                  mobileSheet ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-1.5 text-sm",
                )}
              >
                이전
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => goTo(stepIdx + 1, 1)}
              className={cn(
                "rounded-md bg-sky-600 font-semibold text-white transition-colors hover:bg-sky-700",
                mobileSheet ? "px-3 py-1.5 text-xs" : "px-4 py-1.5 text-sm",
              )}
            >
              {stepIdx === TOUR_STEPS.length - 1 ? "완료" : "다음"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 투어 런처 — 첫 로그인(미완료·버전 갱신) 시 자동 시작, 계정 메뉴에서 수동 재시작.
 * FarmPageContent 안에 마운트되어 뷰 전환(setView)을 직접 제어한다.
 */
export function FarmFeatureTour({
  view,
  setView,
  enabled = true,
}: {
  view: TourView;
  setView: (v: TourView) => void;
  enabled?: boolean;
}) {
  const [active, setActive] = useState(false);
  const [startView, setStartView] = useState<TourView>("map");
  const checkedRef = useRef(false);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const start = useCallback(() => {
    setFarmTourActive(true);
    const activate = () => {
      setStartView(viewRef.current);
      setActive(true);
    };
    if (isTourTargetVisible(TOUR_READY_SELECTOR)) {
      activate();
      return;
    }
    const waitForReady = (attempt = 0) => {
      if (isTourTargetVisible(TOUR_READY_SELECTOR)) {
        activate();
        return;
      }
      if (attempt >= READY_RETRIES) {
        activate();
        return;
      }
      window.setTimeout(() => waitForReady(attempt + 1), TOUR_READY_INTERVAL_MS);
    };
    waitForReady();
  }, []);

  // 자동 시작 — DOM 준비 폴링과 서버 완료 확인 병렬.
  useEffect(() => {
    if (!enabled || checkedRef.current) return;
    checkedRef.current = true;
    try {
      if (sessionStorage.getItem(FARM_TOUR_RESTART_FLAG)) {
        sessionStorage.removeItem(FARM_TOUR_RESTART_FLAG);
        start();
        return;
      }
    } catch {
      /* storage 사용 불가 */
    }

    let cancelled = false;
    let domReady = isTourTargetVisible(TOUR_READY_SELECTOR);
    const domPoll = window.setInterval(() => {
      if (!domReady) domReady = isTourTargetVisible(TOUR_READY_SELECTOR);
    }, TOUR_READY_INTERVAL_MS);

    void shouldShowOnboardingTourAction()
      .then((show) => {
        if (cancelled || !show) return;
        if (domReady) {
          setFarmTourActive(true);
          setStartView(viewRef.current);
          setActive(true);
          return;
        }
        start();
      })
      .catch(() => {
        /* 미로그인·네트워크 오류 */
      });

    return () => {
      cancelled = true;
      window.clearInterval(domPoll);
    };
  }, [enabled, start]);

  // 계정 메뉴 '기능 안내 다시 보기' — 수동 재시작.
  useEffect(() => {
    if (!enabled) return;
    const onRestart = () => start();
    window.addEventListener(FARM_TOUR_RESTART_EVENT, onRestart);
    return () => window.removeEventListener(FARM_TOUR_RESTART_EVENT, onRestart);
  }, [enabled, start]);

  const handleFinish = useCallback(() => {
    setFarmTourActive(false);
    setActive(false);
    void markOnboardingTourDoneAction().catch(() => {
      /* 저장 실패 시 다음 진입에서 재노출 */
    });
  }, []);

  if (!active) return null;
  return (
    <TourOverlay
      initialView={startView}
      setView={setView}
      onFinish={handleFinish}
    />
  );
}
