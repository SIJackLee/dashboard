"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AriaMetricsSnapshot } from "@/app/(dashboard)/farm/aria-metrics-actions";
import { UnifiedBarnTrendPanel } from "@/components/farm/unified-barn-trend-panel";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import {
  alarmScopeKeyFromFarmChartScope,
  chartScopeLabel,
  filterReadingsByChartScope,
  type ChartTrendZoomHint,
  type FarmChartScope,
  DEFAULT_FARM_CHART_SCOPE,
} from "@/lib/farm/farm-chart-scope";
import {
  chartZoomFromTempBreach,
  findTempAlarmBreachXRange,
} from "@/lib/farm/alarm-breach-x-range";
import { buildFarmUnifiedTrendRaw } from "@/lib/farm/build-farm-unified-trend-raw";
import {
  DEFAULT_ALARM_SETTINGS,
  DEFAULT_ALARM_THRESHOLDS,
} from "@/lib/data/alarms";
import { resolveThresholdsForScope } from "@/lib/data/alarm-scope";
import {
  zoomHintFromDelinHandoff,
  type DelinChartHandoff,
} from "@/lib/voice-report/delin-chart-handoff";
import type { VoiceAskSuccess } from "@/lib/voice-report/types";
import {
  DELIN_REVEAL_MS,
  DELIN_REVEAL_LABEL,
  type DelinRevealBeat,
} from "@/lib/ui/delin-reveal-sequence";
import { dashboardAriaShell } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type DelinStageAnswer = {
  text: string;
  evidenceChips: string[];
  chartHandoff: NonNullable<VoiceAskSuccess["chartHandoff"]> | null;
};

export type AriaAnswerChartBundle = {
  readings: BarnReading[];
  controllerTrendByPeriod?: Record<
    TrendPeriodId,
    TrendControllerPeriodData
  > | null;
  period: TrendPeriodId;
  onPeriodChange?: (period: TrendPeriodId) => void;
  alarmSettings?: AlarmSettings;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  canCommand?: boolean;
  isMobileStack?: boolean;
};

type Props = {
  answer: DelinStageAnswer;
  facts: AriaMetricsSnapshot | null;
  loading?: boolean;
  /** 있으면 중앙에 통합 추이(캔버스형). 없으면 요약만 */
  chartBundle?: AriaAnswerChartBundle | null;
  /** 전체 차트 탭으로 이동(보조) */
  onOpenChartTab?: (handoff: DelinChartHandoff) => void;
  /** 순차 리빌 비트 — dock→chart→scopeDemo→ready */
  revealBeat?: DelinRevealBeat;
  /** 추이 미준비 — dock에서 대기 문구 */
  chartTrendReady?: boolean;
  /** 실제 X스코프 제스처(또는 스킵) 완료 → ready */
  onScopeDemoComplete?: () => void;
  className?: string;
};

function previewText(text: string, max = 140): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

function handoffAsDelin(
  h: NonNullable<VoiceAskSuccess["chartHandoff"]>,
): DelinChartHandoff {
  return {
    ctaLabel: h.ctaLabel,
    scope: h.scope,
    focusMetric: h.focusMetric ?? "temp",
    xRange: h.xRange,
  };
}

/**
 * speak 결과면 — 짧은 요약 + (가능하면) 통합 추이 제자리.
 * 캔버스: KPI 카드 그리드가 아니라 실차트가 주인공.
 */
export function AriaAnswerStage({
  answer,
  facts,
  loading = false,
  chartBundle = null,
  onOpenChartTab,
  revealBeat = "ready",
  chartTrendReady = true,
  onScopeDemoComplete,
  className,
}: Props) {
  const handoff = answer.chartHandoff
    ? handoffAsDelin(answer.chartHandoff)
    : null;

  const [chartScope, setChartScope] = useState<FarmChartScope>(
    () => handoff?.scope ?? DEFAULT_FARM_CHART_SCOPE,
  );

  const handoffKey = handoff
    ? `${handoff.scope.level}:${"stallTyCode" in handoff.scope ? handoff.scope.stallTyCode : ""}:${"stallNo" in handoff.scope ? handoff.scope.stallNo : ""}:${"controllerKey" in handoff.scope ? handoff.scope.controllerKey : ""}:${handoff.focusMetric ?? ""}`
    : "";

  const [appliedHandoffKey, setAppliedHandoffKey] = useState(handoffKey);
  if (handoffKey !== appliedHandoffKey) {
    setAppliedHandoffKey(handoffKey);
    if (handoff) setChartScope(handoff.scope);
  }

  const scopedReadings = useMemo(() => {
    if (!chartBundle) return [];
    return filterReadingsByChartScope(chartBundle.readings, chartScope);
  }, [chartBundle, chartScope]);

  const controllers = useMemo(
    () =>
      scopedReadings.map((r) => ({
        key: r.controllerKey,
        reading: r,
      })),
    [scopedReadings],
  );

  const zoomHint: ChartTrendZoomHint | null = useMemo(() => {
    if (!chartBundle || controllers.length === 0) {
      return (
        (handoff ? zoomHintFromDelinHandoff(handoff) : null) ?? {
          yBands: ["temp"],
          startRatio: 0,
          endRatio: 1,
        }
      );
    }

    const settings = chartBundle.alarmSettings ?? DEFAULT_ALARM_SETTINGS;
    const scopeKey = alarmScopeKeyFromFarmChartScope(
      scopedReadings,
      chartScope,
    );
    const thresholds = scopeKey
      ? resolveThresholdsForScope(settings, scopeKey)
      : (settings.global ?? DEFAULT_ALARM_THRESHOLDS);

    const raw = buildFarmUnifiedTrendRaw({
      controllers,
      controllerTrendByPeriod: chartBundle.controllerTrendByPeriod,
      period: chartBundle.period,
      thresholds,
    });
    if (!raw) {
      return (
        zoomHintFromDelinHandoff(
          handoff ?? {
            ctaLabel: "",
            scope: chartScope,
            focusMetric: "temp",
          },
        ) ?? {
          yBands: ["temp"],
          startRatio: 0,
          endRatio: 1,
        }
      );
    }

    /** 산포 상단/하단 vs 알람 — 실제 초과 연속 구간 */
    const breach = findTempAlarmBreachXRange(
      raw.tempAvg,
      raw.tempLow,
      raw.tempHigh,
      {
        tempMax: raw.tempMax,
        tempMin: raw.tempMin,
        /** 왼쪽 산포 시작은 보이게, 오른쪽 정상 봉은 넣지 않음 */
        padLeft: 2,
        padRight: 0,
      },
    );
    const fromData = chartZoomFromTempBreach(breach);
    if (fromData) return fromData;

    /** 초과 없으면 온도 레인만 (X는 전체) — 가짜 중간대 금지 */
    return {
      yBands: ["temp"],
      startRatio: 0,
      endRatio: 1,
    };
  }, [chartBundle, controllers, scopedReadings, chartScope, handoff]);

  const label = chartScopeLabel(chartScope, chartBundle?.readings ?? []);
  const canShowChart =
    Boolean(chartBundle) && controllers.length > 0 && chartBundle != null;
  const showChart =
    canShowChart &&
    (revealBeat === "chart" ||
      revealBeat === "scopeDemo" ||
      revealBeat === "ready");
  /** 의미 있는 X구간일 때만 실제 드래그 시연 (전체면 스킵) */
  const runGuidedScope =
    revealBeat === "scopeDemo" &&
    zoomHint != null &&
    zoomHint.endRatio - zoomHint.startRatio < 0.98;

  const scopeGestureTokenRef = useRef(0);
  const [scopeGestureToken, setScopeGestureToken] = useState(0);
  const [guidedScopeCommitted, setGuidedScopeCommitted] = useState(false);

  useEffect(() => {
    if (revealBeat !== "scopeDemo") return;
    setGuidedScopeCommitted(false);
    if (!runGuidedScope) {
      /** 드래그할 구간 없음 — ready로 (initialZoom으로 온도 레인) */
      onScopeDemoComplete?.();
      return;
    }
    scopeGestureTokenRef.current += 1;
    setScopeGestureToken(scopeGestureTokenRef.current);
  }, [revealBeat, runGuidedScope, onScopeDemoComplete]);

  const guidedXScopeGesture =
    runGuidedScope && zoomHint && scopeGestureToken > 0
      ? {
          token: scopeGestureToken,
          startRatio: zoomHint.startRatio,
          endRatio: zoomHint.endRatio,
          startIndex: zoomHint.startIndex,
          endIndex: zoomHint.endIndex,
          durationMs: DELIN_REVEAL_MS.scopeDemo,
        }
      : null;

  /**
   * 제스처가 이미 commitXScope로 줌을 넣었으면 initialZoom 중복 금지.
   * 제스처 스킵(전체 X)일 때만 ready에서 zoomHint 적용.
   */
  const initialZoom: ChartTrendZoomHint | null =
    revealBeat === "ready" && !guidedScopeCommitted ? zoomHint : null;

  const phaseLabel =
    revealBeat !== "idle" ? DELIN_REVEAL_LABEL[revealBeat] : null;

  return (
    <div
      className={cn(
        dashboardAriaShell.metricsPanel,
        "aria-answer-stage flex min-h-0 flex-col",
        className,
      )}
      data-testid="aria-answer-stage"
      data-emphasized="1"
      data-aria-answer-mode={showChart ? "chart" : "summary"}
      data-aria-reveal-beat={revealBeat}
    >
      <div className="aria-answer-stage-block shrink-0">
        <div className="flex items-center justify-between gap-2">
          <p className={dashboardAriaShell.metricsEyebrow}>분석 결과</p>
          {phaseLabel && revealBeat !== "ready" ? (
            <p
              className="truncate text-[10px] font-medium text-primary"
              data-aria-reveal-caption=""
            >
              {phaseLabel}
            </p>
          ) : facts ? (
            <p className="truncate text-[10px] tabular-nums text-muted-foreground">
              위험 {facts.alarmCritical} · 주의 {facts.alarmWarning}
            </p>
          ) : loading ? (
            <p className="text-[10px] text-muted-foreground">지표…</p>
          ) : null}
        </div>

        <p className="mt-1.5 text-[length:var(--density-body-sm)] leading-snug text-foreground/90">
          {previewText(answer.text)}
        </p>

        {answer.evidenceChips.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {answer.evidenceChips.map((chip) => (
              <span
                key={chip}
                className="rounded-md border border-primary/20 bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {revealBeat === "dock" ? (
        <p className="aria-answer-stage-block mt-4 text-center text-[11px] text-muted-foreground">
          {chartTrendReady
            ? "차트를 준비하는 중…"
            : "추이 데이터 불러오는 중…"}
        </p>
      ) : null}

      {showChart ? (
        <div
          className="aria-answer-chart-preview relative mt-2 min-h-0 flex-1 overflow-y-auto"
          data-testid="aria-answer-chart-preview"
          data-aria-stage-chart="1"
        >
          <UnifiedBarnTrendPanel
            key={`delin-trend-${handoffKey || "none"}-${chartBundle.period}`}
            label={label}
            controllers={controllers}
            controllerTrendByPeriod={chartBundle.controllerTrendByPeriod}
            period={chartBundle.period}
            onPeriodChange={
              revealBeat === "ready" ? chartBundle.onPeriodChange : undefined
            }
            alarmSettings={chartBundle.alarmSettings}
            thermoSettings={chartBundle.thermoSettings}
            chartScope={chartScope}
            onScopeChange={
              revealBeat === "ready" ? setChartScope : undefined
            }
            initialZoom={initialZoom}
            guidedXScopeGesture={guidedXScopeGesture}
            onGuidedXScopeComplete={() => {
              setGuidedScopeCommitted(true);
              onScopeDemoComplete?.();
            }}
            canCommand={
              revealBeat === "ready"
                ? (chartBundle.canCommand ?? false)
                : false
            }
            isMobileStack={chartBundle.isMobileStack}
            chartHeight={chartBundle.isMobileStack ? 220 : 300}
            layersToolbarActive={false}
            className="mt-0"
          />
        </div>
      ) : revealBeat !== "dock" ? (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          {chartBundle
            ? "이 범위에 표시할 추이 데이터가 없습니다."
            : "차트 데이터를 불러오는 중이거나 없습니다."}
        </p>
      ) : null}

      {handoff && onOpenChartTab && revealBeat === "ready" ? (
        <div className="aria-answer-stage-block mt-2 shrink-0">
          <button
            type="button"
            className={cn(
              "w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              showChart
                ? "border border-border/70 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                : "border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15",
            )}
            onClick={() => onOpenChartTab(handoff)}
          >
            {showChart ? "차트 탭에서 전체 보기" : handoff.ctaLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
