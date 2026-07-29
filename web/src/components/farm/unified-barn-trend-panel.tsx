"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  TrendChart,
  type TrendScaleEdgeLabel,
} from "@/components/trends/trend-chart";
import { UnifiedTrendPeriodBrush } from "@/components/farm/unified-trend-period-brush";
import { UnifiedTrendLayerToolbar } from "@/components/farm/unified-trend-layer-toolbar";
import type { AlarmSettings } from "@/lib/data/alarms";
import { DEFAULT_ALARM_THRESHOLDS } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import {
  findControllerTrendSeries,
  resolveReadingAlarmThresholds,
} from "@/lib/farm/controller-summary-display";
import {
  downsampleTrendAxis,
  tickEveryForDisplayBars,
} from "@/lib/farm/trend-display-buckets";
import { TREND_CHART_COLORS } from "@/lib/farm/trend-chart-series";
import {
  aggregateUnifiedBarnTrendRaw,
  DEFAULT_UNIFIED_LAYERS,
  mapHumPctToSplitY,
  mapMotorPctToSplitY,
  mapTempCToSplitY,
  mapUnifiedBarnTrendRawToSplitY,
  pickUnifiedTrendLayers,
  resolveSplitYLayout,
  sliceUnifiedTrendByIndex,
  splitYVisibilityFromLayers,
  countSplitYBands,
  resolveYScopeBands,
  visibilityForYBands,
  maskLayersForYBands,
  UNIFIED_Y_BAND_LABEL,
  type UnifiedLayerFlags,
  type UnifiedLayerId,
  type UnifiedYBandId,
} from "@/lib/farm/unified-barn-trend-series";
import { envComfortScore } from "@/lib/farm/env-comfort-score";
import {
  buildUnifiedScopeSummary,
  formatBreachPct,
  formatScopeStat,
} from "@/lib/farm/scope-range-summary";
import { useFarmChartLayersSlot } from "@/lib/farm/use-farm-chart-layers-slot";
import { useSplitYLayoutTransition } from "@/lib/farm/use-split-y-layout-transition";
import { trendPeriodLabel } from "@/lib/farm/farm-view-url";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionDuration } from "@/lib/ui/motion-tokens";
import { cn } from "@/lib/utils";

export type UnifiedBarnTrendControllerRef = {
  key: string;
  reading: BarnReading | null;
};

type ScopeEntry = {
  start: number;
  end: number;
  /** null = Y필터 없음 · ["temp","hum"] = 걸린 밴드만 */
  yBands: UnifiedYBandId[] | null;
};

type Props = {
  label: string;
  controllers: UnifiedBarnTrendControllerRef[];
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  onPeriodChange?: (period: TrendPeriodId) => void;
  alarmSettings?: AlarmSettings;
  isMobileStack?: boolean;
  /** 미지정 시 모바일 220 / 데스크톱 340 */
  chartHeight?: number;
  /** 차트 탭 활성 시에만 ScopeBar 레이어 툴바 표시 */
  layersToolbarActive?: boolean;
  className?: string;
};

/**
 * 차트 탭 통합 추이 — 온도+편차 · 모터 max/채널 · 네비 브러시.
 */
export function UnifiedBarnTrendPanel({
  label,
  controllers,
  controllerTrendByPeriod,
  period,
  onPeriodChange,
  alarmSettings,
  isMobileStack = false,
  chartHeight,
  layersToolbarActive = true,
  className,
}: Props) {
  const [layers, setLayers] = useState<UnifiedLayerFlags>(DEFAULT_UNIFIED_LAYERS);
  /** 온도/습도/모터 하위 옵션 펼침 */
  const [tempMenuOpen, setTempMenuOpen] = useState(false);
  const [humMenuOpen, setHumMenuOpen] = useState(false);
  const [motorMenuOpen, setMotorMenuOpen] = useState(false);
  /** M2 — ScopeBar 슬롯 observe · 없으면 인라인 폴백 */
  const layersSlot = useFarmChartLayersSlot();
  const [toolbarActiveSeen, setToolbarActiveSeen] = useState(layersToolbarActive);
  const [layersToolbarMounted, setLayersToolbarMounted] = useState(
    layersToolbarActive,
  );
  const [layersToolbarPhase, setLayersToolbarPhase] = useState<
    "enter" | "exit"
  >(layersToolbarActive ? "enter" : "exit");
  const [layersAnimKey, setLayersAnimKey] = useState(0);
  /** P1/P2 스코프 스택 — X + 선택 Y밴드 */
  const [xScopeStack, setXScopeStack] = useState<ScopeEntry[]>([]);
  const xScope =
    xScopeStack.length > 0 ? xScopeStack[xScopeStack.length - 1]! : null;
  const [scopeMotionKey, setScopeMotionKey] = useState(0);
  const [scopeMotionDir, setScopeMotionDir] = useState<"in" | "out">("in");
  const bumpScopeMotion = (dir: "in" | "out") => {
    setScopeMotionDir(dir);
    setScopeMotionKey((k) => k + 1);
  };

  if (layersToolbarActive !== toolbarActiveSeen) {
    setToolbarActiveSeen(layersToolbarActive);
    if (layersToolbarActive) {
      setLayersToolbarMounted(true);
      setLayersToolbarPhase("enter");
      setLayersAnimKey((k) => k + 1);
    } else {
      setLayersToolbarPhase("exit");
      setTempMenuOpen(false);
      setHumMenuOpen(false);
      setMotorMenuOpen(false);
    }
  }

  const thresholds = useMemo(() => {
    const withReading = controllers.find((c) => c.reading != null)?.reading;
    if (!withReading) return DEFAULT_ALARM_THRESHOLDS;
    return resolveReadingAlarmThresholds(withReading, alarmSettings);
  }, [controllers, alarmSettings]);

  const layerVisibility = useMemo(
    () => splitYVisibilityFromLayers(layers),
    [layers],
  );
  const scopeVisibility = useMemo(() => {
    const bandVis = visibilityForYBands(xScope?.yBands ?? null);
    if (!bandVis) return layerVisibility;
    return {
      showTemp: layerVisibility.showTemp && bandVis.showTemp,
      showHum: layerVisibility.showHum && bandVis.showHum,
      showMotors: layerVisibility.showMotors && bandVis.showMotors,
    };
  }, [layerVisibility, xScope]);
  const targetLayout = useMemo(
    () => resolveSplitYLayout(scopeVisibility),
    [scopeVisibility],
  );
  const layout = useSplitYLayoutTransition(targetLayout);
  /** 드래그 hit/미리보기 — 레이어 기준(스코프 전) 멀티밴드 */
  const layerLayout = useMemo(
    () => resolveSplitYLayout(layerVisibility),
    [layerVisibility],
  );

  /** 브러시 — 30d 온·습 양호도(B안) · 컨트롤러 평균 · 모터 제외 */
  const brushOverview = useMemo(() => {
    const periodData = controllerTrendByPeriod?.["30d"] ?? null;
    if (!periodData) return [];
    const paired = controllers
      .map((c) => {
        const r = c.reading;
        if (!r) return null;
        const series = findControllerTrendSeries(
          controllerTrendByPeriod,
          "30d",
          r.stallTyCode,
          r.stallNo,
          r.controllerKey,
        );
        if (!series) return null;
        return {
          series,
          thresholds: resolveReadingAlarmThresholds(r, alarmSettings),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p != null);
    if (!paired.length) return [];
    const len = Math.max(
      ...paired.map((p) =>
        Math.max(p.series.temp?.length ?? 0, p.series.humidity?.length ?? 0),
      ),
    );
    const out: (number | null)[] = [];
    for (let i = 0; i < len; i++) {
      const scores: number[] = [];
      for (const p of paired) {
        const s = envComfortScore(
          p.series.temp?.[i],
          p.series.humidity?.[i],
          p.thresholds,
        );
        if (s != null) scores.push(s);
      }
      out.push(
        scores.length
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : null,
      );
    }
    return out;
  }, [controllers, controllerTrendByPeriod, alarmSettings]);

  const splitBandGuides = useMemo(() => {
    const guides: number[] = [];
    const motorH = layout.motorHi - layout.motorLo;
    const humH = layout.humHi - layout.humLo;
    const tempH = layout.tempHi - layout.tempLo;
    if (motorH > 0.5 && (humH > 0.5 || tempH > 0.5)) {
      guides.push(layout.motorHi);
    }
    if (humH > 0.5 && tempH > 0.5) {
      guides.push(layout.humHi);
    }
    return guides;
  }, [layout]);

  /** M1 — 다운샘플+집계는 layout 무관 1회, 보간은 Y매핑만 */
  const trendRaw = useMemo(() => {
    const periodData = controllerTrendByPeriod?.[period] ?? null;
    const categoriesRaw = periodData?.categories ?? [];
    if (!categoriesRaw.length) return null;

    const seriesList = controllers
      .map((c) => {
        const r = c.reading;
        if (!r) return null;
        return findControllerTrendSeries(
          controllerTrendByPeriod,
          period,
          r.stallTyCode,
          r.stallNo,
          r.controllerKey,
        );
      })
      .filter((s): s is NonNullable<typeof s> => s != null);

    if (!seriesList.length) return null;

    const { categories, columns } = downsampleTrendAxis(
      categoriesRaw,
      seriesList.flatMap((s) => [
        s.fanIntake,
        s.fanExhaust,
        s.fanSupply,
        s.temp,
        s.humidity,
      ]),
      period,
    );

    const perCtrl = 5;
    const downsampledList = seriesList.map((s, idx) => {
      const base = idx * perCtrl;
      return {
        ...s,
        fanIntake: columns[base] ?? s.fanIntake,
        fanExhaust: columns[base + 1] ?? s.fanExhaust,
        fanSupply: columns[base + 2] ?? s.fanSupply,
        temp: columns[base + 3] ?? s.temp,
        humidity: columns[base + 4] ?? s.humidity,
      };
    });

    return aggregateUnifiedBarnTrendRaw(
      downsampledList,
      categories,
      thresholds,
    );
  }, [controllers, controllerTrendByPeriod, period, thresholds]);

  const built = useMemo(() => {
    if (!trendRaw) return null;
    return mapUnifiedBarnTrendRawToSplitY(trendRaw, layout);
  }, [trendRaw, layout]);

  const picked = useMemo(() => {
    if (!built) return null;
    const pickLayers = maskLayersForYBands(layers, xScope?.yBands ?? null);
    const raw = pickUnifiedTrendLayers(built, pickLayers);
    /** 스코프 인덱스 안정 — 자동 trim과 X/Y 줌 충돌 방지 */
    return {
      categories: built.categories,
      series: raw.series,
      envelopes: raw.envelopes,
      histograms: raw.histograms,
      trimmed: false as const,
    };
  }, [built, layers, xScope?.yBands]);

  /** 기간 변경 시 스코프 초기화 (render-time sync — effect setState 회피) */
  const [scopePeriod, setScopePeriod] = useState(period);
  if (period !== scopePeriod) {
    setScopePeriod(period);
    setXScopeStack([]);
  }

  /** 데이터 길이/인덱스 불일치 시 스택 비우기 */
  if (xScope && picked && xScopeStack.length > 0) {
    const n = picked.categories.length;
    if (
      n < 2 ||
      xScope.start < 0 ||
      xScope.end >= n ||
      xScope.start > xScope.end ||
      xScope.end - xScope.start < 2
    ) {
      setXScopeStack([]);
    }
  }

  useEffect(() => {
    if (xScopeStack.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setXScopeStack((stack) => {
        if (stack.length === 0) return stack;
        return stack.slice(0, -1);
      });
      if (xScopeStack.length > 0) {
        bumpScopeMotion(xScopeStack.length <= 1 ? "out" : "in");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [xScopeStack.length]);

  const scoped = useMemo(() => {
    if (!picked) return null;
    if (!xScope) {
      return {
        categories: picked.categories,
        series: picked.series,
        envelopes: picked.envelopes,
        histograms: picked.histograms,
      };
    }
    return sliceUnifiedTrendByIndex(
      picked.categories,
      picked,
      xScope.start,
      xScope.end,
    );
  }, [picked, xScope]);

  /** P3 — 스코프 구간 원단위 요약 */
  const scopeSummary = useMemo(() => {
    if (!trendRaw || !xScope) return null;
    return buildUnifiedScopeSummary(
      trendRaw,
      xScope.start,
      xScope.end,
      scopeVisibility,
    );
  }, [trendRaw, xScope, scopeVisibility]);

  const chartCategories = scoped?.categories ?? [];

  const commitXScope = (range: {
    start: number;
    end: number;
    yStartRatio: number;
    yEndRatio: number;
  }) => {
    if (!picked) return;
    const domain = built?.leftDomain ?? ([0, 100] as [number, number]);
    const span = domain[1] - domain[0] || 1;
    const domainY0 = domain[1] - range.yStartRatio * span;
    const domainY1 = domain[1] - range.yEndRatio * span;
    const multi = countSplitYBands(layerVisibility) > 1;
    const detected =
      xScope?.yBands == null && multi
        ? resolveYScopeBands(domainY0, domainY1, layerLayout, layerVisibility)
        : null;
    const yBands = xScope?.yBands ?? detected;
    const next: ScopeEntry = {
      start: xScope == null ? range.start : xScope.start + range.start,
      end: xScope == null ? range.end : xScope.start + range.end,
      yBands,
    };
    setXScopeStack((stack) => [...stack, next]);
    bumpScopeMotion("in");
  };

  const popXScope = () => {
    setXScopeStack((stack) => {
      if (stack.length === 0) return stack;
      return stack.slice(0, -1);
    });
    if (xScopeStack.length > 0) {
      bumpScopeMotion(xScopeStack.length <= 1 ? "out" : "in");
    }
  };

  const clearXScope = () => {
    if (xScopeStack.length > 0) bumpScopeMotion("out");
    setXScopeStack([]);
  };

  /** 우측 Y — 밴드별 모터%/온도℃/습도% 개별 상·하한. 알람 고정 스케일. */
  const scaleEdgeLabels = useMemo((): TrendScaleEdgeLabel[] => {
    if (!built) return [];
    const out: TrendScaleEdgeLabel[] = [];
    const push = (
      id: string,
      chartY: number | null,
      text: string,
      color: string,
      mark: "overline" | "underline",
      title: string,
      showLine: boolean,
    ) => {
      if (chartY == null || !Number.isFinite(chartY)) return;
      out.push({
        id,
        value: chartY,
        axis: "left",
        side: "right",
        text,
        color,
        mark,
        title,
        showLine,
      });
    };

    if (scopeVisibility.showMotors && layers.motors && built.available.motors) {
      push(
        "motor-hi",
        mapMotorPctToSplitY(100, layout),
        "100%",
        "#64748b",
        "overline",
        "모터 상한",
        false,
      );
      push(
        "motor-lo",
        mapMotorPctToSplitY(0, layout),
        "0%",
        "#64748b",
        "underline",
        "모터 하한",
        false,
      );
    }
    if (scopeVisibility.showTemp && layers.temp && built.available.temp) {
      push(
        "temp-hi",
        mapTempCToSplitY(
          thresholds.tempHigh,
          thresholds.tempLow,
          thresholds.tempHigh,
          layout,
        ),
        `${thresholds.tempHigh}℃`,
        TREND_CHART_COLORS.temp,
        "overline",
        "온도 상한(알람)",
        true,
      );
      push(
        "temp-lo",
        mapTempCToSplitY(
          thresholds.tempLow,
          thresholds.tempLow,
          thresholds.tempHigh,
          layout,
        ),
        `${thresholds.tempLow}℃`,
        TREND_CHART_COLORS.temp,
        "underline",
        "온도 하한(알람)",
        true,
      );
    }
    if (
      scopeVisibility.showHum &&
      (layers.hum || layers.humDev || layers.humBand || layers.humEma)
    ) {
      if (built.available.hum || built.available.humDev || built.available.humBand) {
        push(
          "hum-hi",
          mapHumPctToSplitY(
            thresholds.humidityHigh,
            thresholds.humidityLow,
            thresholds.humidityHigh,
            layout,
          ),
          `${thresholds.humidityHigh}%`,
          TREND_CHART_COLORS.humidity,
          "overline",
          "습도 상한(알람)",
          true,
        );
        push(
          "hum-lo",
          mapHumPctToSplitY(
            thresholds.humidityLow,
            thresholds.humidityLow,
            thresholds.humidityHigh,
            layout,
          ),
          `${thresholds.humidityLow}%`,
          TREND_CHART_COLORS.humidity,
          "underline",
          "습도 하한(알람)",
          true,
        );
      }
    }
    return out;
  }, [built, layers, thresholds, layout, scopeVisibility]);

  const toggleLayer = (id: UnifiedLayerId) => {
    setLayers((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (id === "motorCh" && next.motorCh) next.motors = true;
      if (id === "temp" && !next.temp) {
        next.ema = false;
        next.dev = false;
        next.band = false;
      }
      if (id === "hum" && !next.hum) {
        next.humEma = false;
        next.humDev = false;
        next.humBand = false;
      }
      if (id === "motors" && !next.motors) next.motorCh = false;
      if (id === "ema" || id === "dev" || id === "band") {
        if (next[id]) next.temp = true;
      }
      if (id === "humEma" || id === "humDev" || id === "humBand") {
        if (next[id]) next.hum = true;
      }
      return next;
    });
  };

  const enableGroupAll = (group: "temp" | "hum" | "motor") => {
    if (!built) return;
    setLayers((prev) => {
      const next = { ...prev };
      if (group === "temp") {
        next.temp = true;
        if (built.available.ema) next.ema = true;
        if (built.available.dev) next.dev = true;
        if (built.available.band) next.band = true;
      } else if (group === "hum") {
        next.hum = true;
        if (built.available.humEma) next.humEma = true;
        if (built.available.humDev) next.humDev = true;
        if (built.available.humBand) next.humBand = true;
      } else {
        next.motors = true;
        if (built.available.motorCh) next.motorCh = true;
      }
      return next;
    });
  };

  useEffect(() => {
    if (layersToolbarActive || layersToolbarPhase !== "exit") return;
    const t = window.setTimeout(() => {
      setLayersToolbarMounted(false);
    }, motionDuration.exit);
    return () => window.clearTimeout(t);
  }, [layersToolbarActive, layersToolbarPhase, layersAnimKey]);

  const layerToolbar =
    built != null && layersToolbarMounted ? (
      <div
        key={layersAnimKey}
        className={cn(
          "flex min-w-0 items-center",
          layersSlot
            ? "border-l border-border/50 pl-2 sm:pl-3"
            : "w-full border-t border-border/40 pt-2 sm:ml-auto sm:w-auto sm:border-l sm:border-t-0 sm:pt-0 sm:pl-2",
          layersToolbarPhase === "enter"
            ? motionClass.farmChartLayersEnter
            : motionClass.farmChartLayersExit,
        )}
        data-farm-chart-layers-shell=""
        data-farm-chart-layers-placement={layersSlot ? "portal" : "inline"}
        aria-hidden={layersToolbarPhase === "exit"}
      >
        <UnifiedTrendLayerToolbar
          layers={layers}
          available={built.available}
          tempMenuOpen={tempMenuOpen}
          humMenuOpen={humMenuOpen}
          motorMenuOpen={motorMenuOpen}
          onTempMenuOpenChange={setTempMenuOpen}
          onHumMenuOpenChange={setHumMenuOpen}
          onMotorMenuOpenChange={setMotorMenuOpen}
          onToggleLayer={toggleLayer}
          onEnableGroupAll={enableGroupAll}
        />
      </div>
    ) : null;

  return (
    <div
      className={cn(
        "mt-2 space-y-2 rounded-md border bg-background p-2.5 sm:p-3",
        className,
      )}
      data-tour-id="farm-chart-unified-trend"
    >
      {layerToolbar && layersSlot
        ? createPortal(layerToolbar, layersSlot)
        : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">통합 추이</span>
        <span className="text-[0.7rem] text-muted-foreground">
          {label} · 집계 {built?.controllerCount ?? 0}대 ·{" "}
          {trendPeriodLabel(period)}
          {picked?.trimmed ? " · 실데이터 구간" : ""}
        </span>
        {layerToolbar && !layersSlot ? layerToolbar : null}
        {xScope != null && picked ? (
          <div
            key={`scope-chip-${scopeMotionKey}`}
            className={cn(
              "ml-auto inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-50/80 px-2 py-1 text-[0.65rem] font-medium text-sky-900 dark:bg-sky-950/50 dark:text-sky-100",
              motionClass.farmChartScopeChipIn,
            )}
          >
            <span className="shrink-0">구간 줌</span>
            {xScope.yBands?.length ? (
              <span className="shrink-0 rounded bg-sky-500/15 px-1 py-px">
                {xScope.yBands.map((b) => UNIFIED_Y_BAND_LABEL[b]).join("+")}
              </span>
            ) : null}
            {xScopeStack.length > 1 ? (
              <span className="shrink-0 tabular-nums text-sky-700/80 dark:text-sky-300/80">
                ×{xScopeStack.length}
              </span>
            ) : null}
            <span className="min-w-0 truncate tabular-nums text-sky-800/90 dark:text-sky-200/90">
              {picked.categories[xScope.start] ?? "…"}
              {" → "}
              {picked.categories[xScope.end] ?? "…"}
            </span>
            <button
              type="button"
              aria-label="한 단계 뒤로"
              title="우클릭과 동일"
              onClick={popXScope}
              className={cn(
                "inline-flex h-5 shrink-0 items-center justify-center rounded border border-sky-500/30 px-1",
                "text-sky-800 hover:bg-sky-100 dark:text-sky-100 dark:hover:bg-sky-900/60",
                motionClass.microHover,
              )}
            >
              ←
            </button>
            <button
              type="button"
              aria-label="구간 줌 전체 해제"
              onClick={clearXScope}
              className={cn(
                "inline-flex size-5 shrink-0 items-center justify-center rounded border border-sky-500/30",
                "text-sky-800 hover:bg-sky-100 dark:text-sky-100 dark:hover:bg-sky-900/60",
                motionClass.microHover,
              )}
            >
              ×
            </button>
          </div>
        ) : null}
      </div>

      {scopeSummary ? (
        <div
          className={cn(
            "flex flex-wrap gap-x-3 gap-y-1.5 rounded-md border border-sky-500/25 bg-sky-50/40 px-2.5 py-1.5",
            "dark:bg-sky-950/30",
            motionClass.farmChartScopeChipIn,
          )}
          data-farm-chart-scope-summary=""
          aria-label="선택 구간 요약"
        >
          <span className="self-center text-[0.65rem] font-semibold text-sky-900 dark:text-sky-100">
            구간 요약
          </span>
          {scopeSummary.metrics.map((m) => {
            const breach = formatBreachPct(m.breachRate);
            return (
              <div
                key={m.id}
                className="min-w-0 text-[0.65rem] tabular-nums text-sky-950/90 dark:text-sky-100/90"
              >
                <span className="font-medium text-sky-800 dark:text-sky-200">
                  {m.label}
                </span>
                <span className="text-muted-foreground"> avg </span>
                <span className="font-semibold">
                  {formatScopeStat(m.avg)}
                  {m.unit}
                </span>
                <span className="text-muted-foreground"> · </span>
                <span>
                  {formatScopeStat(m.min)}–{formatScopeStat(m.max)}
                  {m.unit}
                </span>
                {breach != null ? (
                  <>
                    <span className="text-muted-foreground"> · 이탈 </span>
                    <span
                      className={cn(
                        "font-semibold",
                        (m.breachRate ?? 0) > 0.2
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-sky-800 dark:text-sky-200",
                      )}
                    >
                      {breach}
                    </span>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {built &&
      scoped &&
      picked &&
      (scoped.series.length > 0 || scoped.histograms.length > 0) ? (
        <TrendChart
          mode="line"
          categories={chartCategories}
          series={scoped.series}
          envelopes={scoped.envelopes}
          histograms={scoped.histograms}
          height={chartHeight ?? (isMobileStack ? 220 : 340)}
          leftUnit=""
          leftDomain={built.leftDomain}
          period={period}
          tickEvery={tickEveryForDisplayBars(chartCategories.length)}
          showLegend
          showMarkers
          markerDensity={period === "24h" ? "all" : "sparse"}
          markerRadiusPx={isMobileStack ? 2.8 : 3.2}
          animate
          layerClipWipe
          splitBandGuides={splitBandGuides}
          scaleEdgeLabels={scaleEdgeLabels}
          xScopeSelect
          onXScopeCommit={commitXScope}
          onXScopeBack={popXScope}
          scopeMotionKey={scopeMotionKey}
          scopeMotionDir={scopeMotionDir}
        />
      ) : (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {built
            ? "표시할 레이어를 선택하세요."
            : "통합 추이 데이터가 없습니다."}
        </p>
      )}

      {onPeriodChange ? (
        <UnifiedTrendPeriodBrush
          period={period}
          onPeriodChange={(next) => {
            clearXScope();
            onPeriodChange(next);
          }}
          overviewValues={brushOverview}
        />
      ) : null}

      {built ? (
        <p className="text-[0.65rem] text-muted-foreground">
          드래그=시간 줌 · 걸친 밴드만 표시 · 한 밴드=확대 · 우클릭/Esc=뒤로 · ×=전체 해제
        </p>
      ) : null}
    </div>
  );
}
