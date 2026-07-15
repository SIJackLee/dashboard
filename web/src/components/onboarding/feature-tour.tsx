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
  type TourView,
} from "@/lib/onboarding/tour-steps";
import {
  markOnboardingTourDoneAction,
  shouldShowOnboardingTourAction,
} from "@/app/(dashboard)/farm/onboarding-actions";
import { GaugeAnatomy, PanelPillsGuide } from "@/components/onboarding/tour-guides";
import { cn } from "@/lib/utils";

type Rect = { top: number; left: number; width: number; height: number };

const HOLE_PAD = 6;
const TOOLTIP_W = 440;
const FIND_RETRIES = 16;
const FIND_INTERVAL_MS = 150;
const READY_RETRIES = 40;
const READY_INTERVAL_MS = 150;

function isTourTargetVisible(selector: string): boolean {
  const el = document.querySelector(selector);
  return Boolean(el && (el as HTMLElement).offsetParent !== null);
}

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
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
  const dirRef = useRef<1 | -1>(1);
  const targetRef = useRef<Element | null>(null);
  const accentRef = useRef<Element | null>(null);
  const step = TOUR_STEPS[stepIdx];

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
      setStepIdx(next);
    },
    [finish],
  );

  // 스텝 진입 — 뷰 전환·그리드 액션 후 대상 요소 폴링.
  // 이전 스텝의 rect는 유지 → 홀이 CSS 트랜지션으로 새 대상까지 이동(모프).
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    targetRef.current = null;
    accentRef.current = null;

    // setView는 내부적으로 flushSync를 사용 — effect 본문에서 동기 호출하면
    // React lifecycle 중 flushSync 오류가 나므로 태스크 큐로 미룬다.
    const applyTimer = window.setTimeout(() => {
      if (cancelled) return;
      setView(step.view);
      if (step.gridAction) dispatchGridAction(step.gridAction);
    }, 0);

    const locate = () => {
      if (cancelled) return;
      const el = document.querySelector(step.selector);
      if (el && (el as HTMLElement).offsetParent !== null) {
        targetRef.current = el;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        if (step.accentSelector) {
          accentRef.current = document.querySelector(step.accentSelector);
        }
        // 스크롤 안착 후 측정.
        window.setTimeout(() => {
          if (cancelled || !targetRef.current) return;
          setRect(measure(targetRef.current));
          setAccentRect(
            accentRef.current ? measure(accentRef.current) : null,
          );
        }, 260);
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
        // 대상 없음(데이터 없음 등) — 진행 방향으로 건너뛰기.
        const next = stepIdx + dirRef.current;
        if (next < 0 || next >= TOUR_STEPS.length) finish(true);
        else setStepIdx(next);
        return;
      }
      window.setTimeout(locate, FIND_INTERVAL_MS);
    };
    // 뷰 전환·렌더 반영 뒤 첫 탐색.
    window.setTimeout(locate, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(applyTimer);
    };
  }, [stepIdx, step, setView, finish]);

  // 위치 추적 — 리사이즈·스크롤·주기 재측정(폴링 값 갱신 등 리플로 대응).
  useEffect(() => {
    const sync = () => {
      if (targetRef.current) setRect(measure(targetRef.current));
      if (accentRef.current) setAccentRect(measure(accentRef.current));
    };
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    const t = window.setInterval(sync, 400);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
      window.clearInterval(t);
    };
  }, []);

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

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const mobileSheet = vw < 768;
  const tooltipW = Math.min(TOOLTIP_W, vw - 24);

  const hole = rect
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
    tooltipStyle = { left: 8, right: 8, bottom: 8 };
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
          className="farm-tour-hole pointer-events-none fixed rounded-xl"
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
        className={cn(
          "farm-tour-tooltip fixed max-h-[75vh] overflow-y-auto rounded-xl border bg-card p-6 text-card-foreground shadow-2xl",
          mobileSheet && "max-h-[60vh]",
        )}
        style={tooltipStyle}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {stepIdx + 1} / {TOUR_STEPS.length}
          </span>
          <span className="ml-auto" />
          <button
            type="button"
            onClick={() => finish(false)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="투어 닫기"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <p className="text-lg font-bold leading-snug">{step.title}</p>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted-foreground">{step.body}</p>
        {step.extra === "anatomy" ? (
          <div className="mt-3">
            <GaugeAnatomy />
          </div>
        ) : null}
        {step.extra === "pills" ? (
          <div className="mt-3">
            <PanelPillsGuide />
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-1.5">
          {TOUR_STEPS.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "size-2 rounded-full transition-colors",
                i === stepIdx ? "bg-sky-500" : "bg-muted-foreground/25",
              )}
              aria-hidden
            />
          ))}
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => finish(false)}
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              건너뛰기
            </button>
            {stepIdx > 0 ? (
              <button
                type="button"
                onClick={() => goTo(stepIdx - 1, -1)}
                className="rounded-md border px-3.5 py-1.5 text-sm font-semibold transition-colors hover:bg-muted"
              >
                이전
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => goTo(stepIdx + 1, 1)}
              className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
            >
              {stepIdx === TOUR_STEPS.length - 1 ? "완료" : "다음"}
            </button>
          </span>
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
    // 모바일 그리드는 전용 마크업(v1 미지원) — 데스크톱 폭에서만 자동 노출.
    if (window.innerWidth < 1024) return;
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
