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
  FARM_TOUR_RESTART_EVENT,
  FARM_TOUR_RESTART_FLAG,
  TOUR_READY_SELECTOR,
  TOUR_STEPS,
  type TourStepDef,
  type TourView,
} from "@/lib/onboarding/tour-steps";
import {
  markOnboardingTourDoneAction,
  shouldShowOnboardingTourAction,
} from "@/app/(dashboard)/farm/onboarding-actions";
import { GaugeAnatomy, PanelPillsGuide } from "@/components/onboarding/tour-guides";
import {
  getTourViewport,
  mobileTourSheetBottomCss,
  isTourTargetBandAligned,
  measureTourTargetBandDrift,
  resolveTourScrollPolicy,
  resolveTourStepSelector,
  scrollTourTargetIntoView,
  scrollTourTargetUntilBandAligned,
  stabilizeMobileBrowserViewport,
  subscribeTourViewportCssSync,
  subscribeTourViewportResize,
  TOUR_MOBILE_SETTLE_MS,
  TOUR_REALIGN_DRIFT_THRESHOLD,
  type TourScrollPolicy,
} from "@/lib/onboarding/tour-viewport";
import { cn } from "@/lib/utils";

type Rect = { top: number; left: number; width: number; height: number };

const HOLE_PAD = 6;
const TOOLTIP_W = 440;
const TOOLTIP_W_MOBILE = 400;
const FIND_RETRIES = 16;
const FIND_INTERVAL_MS = 150;
const READY_RETRIES = 40;
const READY_INTERVAL_MS = 150;

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

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function getStepSpotlightSelector(step: TourStepDef): string {
  return resolveTourStepSelector(step.selector, step.mobileSelector);
}

function dispatchGridAction(action: "expand-first" | "collapse") {
  window.dispatchEvent(
    new CustomEvent(FARM_TOUR_ACTION_EVENT, { detail: { action } }),
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
    const el = targetRef.current as HTMLElement | null;
    if (!el || window.innerWidth >= 768 || !scrollEnabled) return;
    const opts = {
      scrollPolicy,
      tooltipHeight: getTooltipHeight(),
    };
    scrollTourTargetUntilBandAligned(el, opts);
  }, [scrollPolicy, scrollEnabled, getTooltipHeight]);

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
      setHoleReady(false);
      setSettling(true);
      setRect(null);
      setAccentRect(null);
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
    if (typeof window === "undefined" || window.innerWidth >= 768) {
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

  // 스텝 진입 — scroll-once → settle → hole 표시.
  useEffect(() => {
    if (!viewportReady) return;
    const stepGen = stepGenRef.current;
    let cancelled = false;
    let attempts = 0;
    const timers: number[] = [];
    const spotlightSelector = getStepSpotlightSelector(step);

    targetRef.current = null;
    accentRef.current = null;

    const schedule = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    schedule(() => {
      if (cancelled || stepGenRef.current !== stepGen) return;
      setView(step.view);
      if (step.gridAction) dispatchGridAction(step.gridAction);
    }, 0);

    const stepScrollPolicy = resolveTourScrollPolicy(step);
    const stepScrollEnabled = stepScrollPolicy !== "none";
    const isAnchorScroll =
      stepScrollPolicy === "anchor-top" ||
      stepScrollPolicy === "anchor-card-top";

    const scrollTarget = (el: HTMLElement) => {
      if (!stepScrollEnabled || window.innerWidth >= 768) return;
      scrollTourTargetUntilBandAligned(el, {
        scrollPolicy: stepScrollPolicy,
        tooltipHeight: getTooltipHeight(),
      });
    };

    const finalizeMobileStep = (el: HTMLElement) => {
      if (cancelled || stepGenRef.current !== stepGen) return;
      setSettling(true);

      if (!stepScrollEnabled) {
        schedule(() => {
          if (cancelled || stepGenRef.current !== stepGen || targetRef.current !== el) {
            return;
          }
          measureTargets();
          setSettling(false);
          setHoleReady(true);
        }, 120);
        return;
      }

      const revealHole = (attempt = 0) => {
        if (cancelled || stepGenRef.current !== stepGen || targetRef.current !== el) {
          return;
        }
        scrollTarget(el);
        const tipH = getTooltipHeight();
        const band = measureTourTargetBandDrift(el, tipH, stepScrollPolicy);
        if (band.drift >= TOUR_REALIGN_DRIFT_THRESHOLD && attempt < 8) {
          schedule(() => revealHole(attempt + 1), 80);
          return;
        }
        measureTargets();
        setSettling(false);
        setHoleReady(true);
      };

      scrollTarget(el);
      const settleMs = stepScrollEnabled ? TOUR_MOBILE_SETTLE_MS : 120;
      schedule(() => revealHole(0), settleMs);
    };

    const finalizeDesktopStep = (el: HTMLElement) => {
      if (cancelled || stepGenRef.current !== stepGen) return;
      scrollTourTargetIntoView(el, false);
      schedule(() => {
        if (cancelled || stepGenRef.current !== stepGen || targetRef.current !== el) {
          return;
        }
        measureTargets();
        setSettling(false);
        setHoleReady(true);
      }, 260);
    };

    const locate = () => {
      if (cancelled || stepGenRef.current !== stepGen) return;
      const isMobileSheet = window.innerWidth < 768;
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

        if (isMobileSheet && isAnchorScroll) {
          scrollTarget(el as HTMLElement);
        }

        const measureDelay = step.gridAction
          ? 680
          : isMobileSheet
            ? 300
            : 80;

        schedule(() => {
          if (cancelled || stepGenRef.current !== stepGen || targetRef.current !== el) {
            return;
          }
          if (isMobileSheet) finalizeMobileStep(el as HTMLElement);
          else finalizeDesktopStep(el as HTMLElement);
        }, measureDelay);
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
      schedule(locate, FIND_INTERVAL_MS);
    };

    schedule(locate, step.gridAction ? 160 : 80);

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
    runTargetScrollOnce,
    measureTargets,
    scrollEnabled,
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
      const el = targetRef.current as HTMLElement | null;
      if (!el || window.innerWidth >= 768 || !scrollEnabled) return false;
      const drift = measureTourTargetBandDrift(
        el,
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
      if (!holeReady || window.innerWidth >= 768 || tooltipRealignedRef.current) return;
      window.clearTimeout(tooltipResizeTimer);
      tooltipResizeTimer = window.setTimeout(() => {
        if (tooltipRealignedRef.current) return;
        if (scrollEnabled) {
          if (realignMobileTargetIfNeeded(true)) {
            tooltipRealignedRef.current = true;
          }
        } else {
          measureTargets();
          tooltipRealignedRef.current = true;
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
      if (!holeReady || !targetRef.current || window.innerWidth >= 768) return;
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
  const mobileSheet = vw < 768;
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
    <div className="fixed inset-0 z-[9990]" role="dialog" aria-modal="true" aria-label="기능 안내 투어">
      {/* 딤 + 스포트라이트 홀 */}
      {hole ? (
        <div
          className={cn(
            "farm-tour-hole pointer-events-none fixed rounded-xl",
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
        <div className="fixed inset-0 bg-[rgba(9,12,20,0.62)]" aria-hidden />
      )}
      {/* 클릭 차단 레이어(홀 포함 전체) */}
      <div className="fixed inset-0" aria-hidden />

      {/* 보조 강조 — 드래그 손잡이 등 */}
      {accentRect ? (
        <div
          className="farm-tour-accent pointer-events-none fixed rounded-md"
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
          "farm-tour-tooltip fixed overflow-y-auto rounded-xl border bg-card text-card-foreground shadow-2xl",
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
          <div className={mobileSheet ? "mt-2.5" : "mt-3"}>
            <GaugeAnatomy compact={mobileSheet} />
          </div>
        ) : null}
        {step.extra === "pills" ? (
          <div className={mobileSheet ? "mt-2.5" : "mt-3"}>
            <PanelPillsGuide compact={mobileSheet} />
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
    const activate = () => {
      setStartView(viewRef.current);
      setActive(true);
    };
    const waitForReady = (attempt = 0) => {
      if (isTourTargetVisible(TOUR_READY_SELECTOR)) {
        activate();
        return;
      }
      if (attempt >= READY_RETRIES) {
        activate();
        return;
      }
      window.setTimeout(() => waitForReady(attempt + 1), READY_INTERVAL_MS);
    };
    waitForReady();
  }, []);

  // 자동 시작 — 서버에 저장된 완료 상태 확인(1회).
  useEffect(() => {
    if (!enabled || checkedRef.current) return;
    checkedRef.current = true;
    // 계정 메뉴 → 다른 페이지에서 /farm 이동 후 재시작.
    try {
      if (sessionStorage.getItem(FARM_TOUR_RESTART_FLAG)) {
        sessionStorage.removeItem(FARM_TOUR_RESTART_FLAG);
        start();
        return;
      }
    } catch {
      /* storage 사용 불가 — 자동 확인으로 진행 */
    }
    let cancelled = false;
    void shouldShowOnboardingTourAction()
      .then((show) => {
        if (cancelled || !show) return;
        start();
      })
      .catch(() => {
        /* 미로그인·네트워크 오류 — 투어 미노출 */
      });
    return () => {
      cancelled = true;
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
