"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { GripHorizontal } from "lucide-react";
import {
  fetchAriaFarmMetricsAction,
  type AriaMetricsSnapshot,
} from "@/app/(dashboard)/farm/aria-metrics-actions";
import {
  AriaAnswerStage,
  type AriaAnswerChartBundle,
  type DelinStageAnswer,
} from "@/components/farm/aria-answer-stage";
import { AriaOrb } from "@/components/farm/aria-orb";
import {
  AriaStageLayout,
  ariaStageFocusFromOrbMode,
} from "@/components/farm/aria-stage-layout";
import { VoiceReportFab } from "@/components/farm/voice-report-fab";
import type { AlarmSettings } from "@/lib/data/alarms";
import { DEFAULT_ALARM_SETTINGS } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { DEFAULT_TREND_PERIOD } from "@/lib/data/farm-trend-types";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { FarmKey } from "@/lib/data/farm-key";
import { farmDisplayLabel } from "@/lib/data/farm-summaries";
import {
  applyFarmChartScopeParams,
  applyFarmChartZoomParams,
} from "@/lib/farm/farm-chart-scope";
import {
  applyChartViewParams,
  currentFarmSearchParams,
  replaceFarmUrlShallow,
  requestFarmHubViewResync,
} from "@/lib/farm/farm-view-url";
import { prefetchFarmControllerTrend } from "@/lib/farm/use-farm-controller-trend";
import {
  zoomHintFromDelinHandoff,
  type DelinChartHandoff,
} from "@/lib/voice-report/delin-chart-handoff";
import { assembleFarmFacts } from "@/lib/voice-report/assemble-farm-facts";
import {
  DELIN_FULL_NAME,
  DELIN_FULL_NAME_KO,
  DELIN_NAME,
  DELIN_NAME_KO,
  DELIN_TAGLINE,
  voiceStatusToAriaMode,
  type AriaOrbMode,
  type VoiceReportStatus,
} from "@/lib/aria/aria-mode";
import {
  DELIN_REVEAL_MS,
  msUntilChartBeat,
  msUntilScopeDemoBeat,
  prefersReducedMotion,
  type DelinRevealBeat,
} from "@/lib/ui/delin-reveal-sequence";
import { dashboardAriaShell } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";
const METRICS_POLL_MS = 30_000;
/** 이상상황 없을 때 soft metrics 간격 (visibility 게이트와 함께) */
const METRICS_POLL_IDLE_MS = 60_000;

type Props = {
  currentFarm?: FarmKey | null;
  isMobileStack?: boolean;
  /** 허브 keep-alive: false면 metrics 폴링 중지 */
  panelLiveActive?: boolean;
  /** stage=풀탭 · companion=차트 옆/시트 콤팩트 */
  variant?: "stage" | "companion";
  /** companion — 차트 CTA 후 콜백 (시트 닫기) */
  onChartHandoffComplete?: () => void;
  /** 스테이지 실차트용 — 허브 readings/trend */
  readings?: BarnReading[];
  controllerTrendByPeriod?: Record<
    TrendPeriodId,
    TrendControllerPeriodData
  > | null;
  /** 추이 첫 로드 중 — 차트 비트 진입 전 대기 */
  trendLoading?: boolean;
  trendPeriod?: TrendPeriodId;
  onTrendPeriodChange?: (period: TrendPeriodId) => void;
  alarmSettings?: AlarmSettings;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  canCommand?: boolean;
  className?: string;
};

/** DELIN(델린) — 스테이지 탭 또는 차트 companion. */
export function FarmAriaView({
  currentFarm = null,
  isMobileStack = false,
  panelLiveActive = true,
  variant = "stage",
  onChartHandoffComplete,
  readings = [],
  controllerTrendByPeriod = null,
  trendLoading = false,
  trendPeriod = DEFAULT_TREND_PERIOD,
  onTrendPeriodChange,
  alarmSettings,
  thermoSettings,
  canCommand = false,
  className,
}: Props) {
  const isCompanion = variant === "companion";
  const [orbMode, setOrbMode] = useState<AriaOrbMode>("idle");
  const [orbLevel, setOrbLevel] = useState(0);
  const [stageAnswer, setStageAnswer] = useState<DelinStageAnswer | null>(
    null,
  );
  const [revealBeat, setRevealBeat] = useState<DelinRevealBeat>("idle");
  const revealGen = useRef(0);
  const [facts, setFacts] = useState<AriaMetricsSnapshot | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const requestGen = useRef(0);
  const readingsRef = useRef(readings);
  const alarmSettingsRef = useRef(alarmSettings);
  const factsRef = useRef(facts);

  useEffect(() => {
    readingsRef.current = readings;
    alarmSettingsRef.current = alarmSettings;
    factsRef.current = facts;
  }, [alarmSettings, facts, readings]);

  const hasResultSurface = stageAnswer != null;
  const focus =
    hasResultSurface && revealBeat !== "idle"
      ? ("metrics" as const)
      : ariaStageFocusFromOrbMode(orbMode);
  const metricsVisible = hasResultSurface;

  const chartBundle: AriaAnswerChartBundle | null = useMemo(() => {
    if (isCompanion) return null;
    if (!readings.length) return null;
    return {
      readings,
      controllerTrendByPeriod,
      period: trendPeriod,
      onPeriodChange: onTrendPeriodChange,
      alarmSettings,
      thermoSettings,
      canCommand,
      isMobileStack,
    };
  }, [
    isCompanion,
    readings,
    controllerTrendByPeriod,
    trendPeriod,
    onTrendPeriodChange,
    alarmSettings,
    thermoSettings,
    canCommand,
    isMobileStack,
  ]);

  /** 차트 시퀀스 진행 가능 — period 카테고리 존재 */
  const chartTrendReady = useMemo(() => {
    if (trendLoading && !controllerTrendByPeriod) return false;
    const cats =
      controllerTrendByPeriod?.[trendPeriod]?.categories ?? [];
    return cats.length >= 3;
  }, [controllerTrendByPeriod, trendPeriod, trendLoading]);

  const displayFacts = facts;

  const onVoiceStatus = useCallback(
    (status: VoiceReportStatus, meta: { micTesting: boolean }) => {
      if (meta.micTesting) {
        setOrbMode("listen");
        return;
      }
      if (
        currentFarm &&
        (status === "recording" ||
          status === "uploading" ||
          status === "analyzing")
      ) {
        void prefetchFarmControllerTrend(currentFarm);
      }
      if (status === "idle" || status === "error") {
        if (!stageAnswer) setOrbMode(voiceStatusToAriaMode(status));
        else setOrbMode("speak");
        setOrbLevel(0);
        return;
      }
      if (status === "recording") {
        revealGen.current += 1;
        setStageAnswer(null);
        setRevealBeat("idle");
      }
      setOrbMode(voiceStatusToAriaMode(status));
    },
    [stageAnswer, currentFarm],
  );

  const onMicLevel = useCallback((pct: number) => {
    setOrbLevel(Math.max(0, Math.min(1, pct / 100)));
  }, []);

  const onAnswerReady = useCallback(
    (payload: DelinStageAnswer) => {
      revealGen.current += 1;
      setStageAnswer(payload);
      setOrbMode("speak");
      if (currentFarm) void prefetchFarmControllerTrend(currentFarm);
      if (isCompanion || prefersReducedMotion()) {
        setRevealBeat("ready");
        return;
      }
      setRevealBeat("dock");
    },
    [isCompanion, currentFarm],
  );

  /** DELIN 탭 진입 시 추이 선로드 */
  useEffect(() => {
    if (isCompanion || !currentFarm || !panelLiveActive) return;
    void prefetchFarmControllerTrend(currentFarm);
  }, [currentFarm, isCompanion, panelLiveActive]);

  useEffect(() => {
    if (!stageAnswer) return;
    if (revealBeat === "idle" || revealBeat === "ready") return;
    if (isCompanion || prefersReducedMotion()) return;

    const gen = revealGen.current;
    let delay = 0;
    let next: DelinRevealBeat = "ready";

    if (revealBeat === "dock") {
      /** 차트 데이터 없으면 빈 차트로 넘어가지 않음 */
      if (!chartTrendReady) {
        if (currentFarm) void prefetchFarmControllerTrend(currentFarm);
        return;
      }
      delay = msUntilChartBeat();
      next = "chart";
    } else if (revealBeat === "chart") {
      if (!chartTrendReady) return;
      delay = msUntilScopeDemoBeat();
      next = "scopeDemo";
    } else if (revealBeat === "scopeDemo") {
      /** 스테이지 제스처 완료가 정답. 여기선 폴백만 */
      delay = DELIN_REVEAL_MS.scopeDemo + 2000;
      next = "ready";
    } else {
      return;
    }

    const id = window.setTimeout(() => {
      if (revealGen.current !== gen) return;
      setRevealBeat(next);
    }, delay);
    return () => window.clearTimeout(id);
  }, [
    stageAnswer,
    revealBeat,
    isCompanion,
    chartTrendReady,
    currentFarm,
  ]);

  const onScopeDemoComplete = useCallback(() => {
    setRevealBeat((b) => (b === "scopeDemo" ? "ready" : b));
  }, []);

  /** 하단 도크 오버레이 드래그 오프셋 (스테이지 기준 px) */
  const [dockOffset, setDockOffset] = useState({ x: 0, y: 0 });
  const dockDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  /** Prop sync during render — 대기 화면으로 돌아오면 도크를 기본 하단으로 */
  const [prevHasResultSurface, setPrevHasResultSurface] =
    useState(hasResultSurface);
  if (hasResultSurface !== prevHasResultSurface) {
    setPrevHasResultSurface(hasResultSurface);
    if (!hasResultSurface) setDockOffset({ x: 0, y: 0 });
  }

  const onDockHandlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dockDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: dockOffset.x,
        origY: dockOffset.y,
      };
    },
    [dockOffset.x, dockOffset.y],
  );

  const onDockHandlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = dockDragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      setDockOffset({
        x: Math.max(-280, Math.min(280, d.origX + dx)),
        y: Math.max(-56, Math.min(24, d.origY + dy)),
      });
    },
    [],
  );

  const onDockHandlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (dockDragRef.current?.pointerId === e.pointerId) {
        dockDragRef.current = null;
      }
    },
    [],
  );

  const openChartTab = useCallback(
    (handoff: DelinChartHandoff) => {
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      applyChartViewParams(params);
      applyFarmChartScopeParams(params, handoff.scope);
      applyFarmChartZoomParams(params, zoomHintFromDelinHandoff(handoff));
      replaceFarmUrlShallow(params);
      requestFarmHubViewResync();
      onChartHandoffComplete?.();
    },
    [onChartHandoffComplete],
  );

  const loadMetrics = useCallback(async (farm: FarmKey, soft = false) => {
    const gen = ++requestGen.current;
    const hubReadings = readingsRef.current;

    // soft: 허브 LIVE readings가 있으면 DB 재조회 없이 facts 재조립
    if (soft && hubReadings.length > 0) {
      const next = assembleFarmFacts({
        farmKey: farm,
        farmLabel:
          factsRef.current?.farmLabel ?? farmDisplayLabel(farm, null),
        readings: hubReadings,
        alarmSettings: alarmSettingsRef.current ?? DEFAULT_ALARM_SETTINGS,
      });
      if (gen !== requestGen.current) return;
      startTransition(() => {
        setFacts(next);
        setMetricsError(null);
        setMetricsLoading(false);
      });
      return;
    }

    if (!soft) startTransition(() => setMetricsLoading(true));
    const result = await fetchAriaFarmMetricsAction(farm);
    if (gen !== requestGen.current) return;
    startTransition(() => {
      if (result.ok) {
        setFacts(result.facts);
        setMetricsError(null);
      } else {
        setMetricsError("지표를 불러오지 못했습니다.");
      }
      setMetricsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (isCompanion) return;
    if (!currentFarm) {
      requestGen.current += 1;
      queueMicrotask(() => {
        startTransition(() => {
          setFacts(null);
          setMetricsError(null);
          setMetricsLoading(false);
        });
      });
      return;
    }
    void loadMetrics(currentFarm, false);
  }, [currentFarm, isCompanion, loadMetrics]);

  useEffect(() => {
    if (isCompanion || !currentFarm || !panelLiveActive) return;
    if (!hasResultSurface) return;

    const pollMs =
      (facts?.alarmTotal ?? 0) > 0 ? METRICS_POLL_MS : METRICS_POLL_IDLE_MS;

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void loadMetrics(currentFarm, true);
    };

    const id = window.setInterval(tick, pollMs);
    const onVis = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [
    currentFarm,
    facts?.alarmTotal,
    hasResultSurface,
    isCompanion,
    loadMetrics,
    panelLiveActive,
  ]);

  return (
    <div
      className={cn(
        "flex min-h-[min(72dvh,34rem)] flex-col",
        currentFarm && !hasResultSurface && "min-h-[min(80dvh,40rem)]",
        hasResultSurface && !isCompanion && "min-h-[min(94dvh,56rem)]",
        dashboardAriaShell.stage,
        motionClass.enterFade,
        className,
      )}
      style={
        currentFarm
          ? ({
              ["--aria-dock-clearance"]: hasResultSurface
                ? "18rem"
                : "16.5rem",
            } as CSSProperties)
          : undefined
      }
      data-tour-id="farm-aria-view"
      data-testid="farm-aria-view"
      data-aria-result={hasResultSurface ? "1" : "0"}
      data-aria-reveal-beat={revealBeat}
    >
      <div className={dashboardAriaShell.stageGlow} aria-hidden />

      <header
        className={cn(
          "relative z-[1] flex flex-col items-center gap-1 px-4 text-center",
          hasResultSurface ? "pt-2 md:pt-3" : "pt-5 md:pt-7",
        )}
      >
        {hasResultSurface ? (
          <h2
            className="text-sm font-semibold tracking-tight text-primary md:text-base"
            title={`${DELIN_FULL_NAME} · ${DELIN_FULL_NAME_KO}`}
          >
            {DELIN_NAME}
          </h2>
        ) : (
          <>
            <h2
              className={dashboardAriaShell.title}
              title={`${DELIN_FULL_NAME} · ${DELIN_FULL_NAME_KO} · ${DELIN_TAGLINE}`}
            >
              {DELIN_NAME}
            </h2>
            <p className={dashboardAriaShell.eyebrow}>{DELIN_NAME_KO}</p>
          </>
        )}
        {!currentFarm ? (
          <p className={dashboardAriaShell.warnMeta}>
            농장을 선택하면 델린을 사용할 수 있습니다.
          </p>
        ) : null}
        {metricsError && hasResultSurface ? (
          <p className="text-[11px] text-destructive">{metricsError}</p>
        ) : null}
      </header>

      <AriaStageLayout
        focus={focus}
        metricsVisible={metricsVisible}
        className={currentFarm ? dashboardAriaShell.stageBodyDockClear : undefined}
        metrics={
          stageAnswer ? (
            <AriaAnswerStage
              answer={stageAnswer}
              facts={displayFacts}
              loading={metricsLoading}
              chartBundle={chartBundle}
              onOpenChartTab={openChartTab}
              revealBeat={revealBeat}
              chartTrendReady={chartTrendReady}
              onScopeDemoComplete={onScopeDemoComplete}
            />
          ) : null
        }
        orb={
          <AriaOrb
            mode={currentFarm ? orbMode : "idle"}
            level={currentFarm ? orbLevel : 0}
            announce={!hasResultSurface}
          />
        }
        hint={
          currentFarm ? undefined : (
            <p className={dashboardAriaShell.hint}>
              농장을 선택한 뒤 말해 보세요
            </p>
          )
        }
      />

      {currentFarm != null ? (
        <div
          className={cn(
            dashboardAriaShell.dockSlot,
            isMobileStack && "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          )}
        >
          <div
            className="pointer-events-auto mx-auto w-full max-w-lg will-change-transform"
            style={{
              transform: `translate3d(${dockOffset.x}px, ${dockOffset.y}px, 0)`,
            }}
            data-testid="aria-dock-draggable"
          >
            <button
              type="button"
              className={dashboardAriaShell.dockDragHandle}
              aria-label="입력 도크 위치 이동"
              onPointerDown={onDockHandlePointerDown}
              onPointerMove={onDockHandlePointerMove}
              onPointerUp={onDockHandlePointerUp}
              onPointerCancel={onDockHandlePointerUp}
            >
              <GripHorizontal className="size-4" aria-hidden />
            </button>
            <VoiceReportFab
              currentFarm={currentFarm}
              layout="dock"
              onStatusChange={onVoiceStatus}
              onMicLevelChange={onMicLevel}
              onAnswerReady={onAnswerReady}
              suppressAnswerSurface={hasResultSurface}
              onChartHandoffComplete={onChartHandoffComplete}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
