"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, PanelRight, Settings } from "lucide-react";
import {
  TrendChart,
  type ScaleEdgeDragEvent,
  type ScaleEdgeNumericCommitEvent,
  type TrendScaleEdgeLabel,
} from "@/components/trends/trend-chart";
import {
  BRUSH_PERIOD_WINDOW,
  UnifiedTrendPeriodBrush,
  displayPeriodFromBrushWindow,
  formatBrushWindowLabel,
  type BrushWindow,
} from "@/components/farm/unified-trend-period-brush";
import {
  UnifiedTrendLayerToolbar,
  applyLayerGroupMode,
  detectLayerGroupMode,
  nextLayerGroupMode,
} from "@/components/farm/unified-trend-layer-toolbar";
import { BulkLiveProgressBanner } from "@/components/farm/bulk-live-progress-banner";
import { useBulkCommandPipelineTracker } from "@/components/farm/use-bulk-command-pipeline-tracker";
import { saveAlarmSettingsInlineAction } from "@/lib/actions/app-settings-actions";
import { sendBulkThermoCommandAction } from "@/app/(dashboard)/controllers/actions";
import { isReadingOnline } from "@/lib/data/reading-display";
import {
  applyScopeAlarmThresholdsWithCascade,
  resolveThresholdsForScope,
} from "@/lib/data/alarm-scope";
import type { AlarmSettings, AlarmThresholds } from "@/lib/data/alarms";
import {
  DEFAULT_ALARM_SETTINGS,
  DEFAULT_ALARM_THRESHOLDS,
  validateAlarmThresholds,
} from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import {
  emptyTrendControllerPeriodData,
  isContextControllerTrend30d,
  pickTrendCanvasPeriod,
  TREND_PERIODS,
  type TrendControllerPeriodData,
  type TrendControllerSeries,
  type TrendPeriodId,
  type TrendWindow15m,
} from "@/lib/data/farm-trend-types";
import {
  brushWindowNeeds15m,
  brushWindowToRangeMs,
  window15mCovers,
} from "@/lib/farm/trend-brush-coverage";
import {
  findControllerTrendSeries,
  formatControllerHeaderPrimary,
  formatControllerHeaderSecondary,
  formatControllerHeaderStallType,
  resolveReadingAlarmThresholds,
  resolveReadingThermo,
} from "@/lib/farm/controller-summary-display";
import {
  ControllerAffiliationMarks,
  StallUnitNoMark,
} from "@/components/farm/controller-summary-parts";
import {
  alarmScopeKeyFromFarmChartScope,
  chartScopeEntryToZoomHint,
  type ChartTrendZoomHint,
  type FarmChartScope,
  scopesEqual,
} from "@/lib/farm/farm-chart-scope";
import {
  CHART_THERMO_CONTROL_COLOR,
  CHART_THERMO_EDGE_IDS,
  clampChartVentDraft,
  isChartMotorVentEdgeId,
  isChartThermoEdgeId,
  type ChartThermoDraft,
} from "@/lib/farm/chart-thermo-control";
import {
  buildBulkThermoCommands,
  BULK_CHANNEL_OPTIONS,
} from "@/components/farm/farm-map-bulk-apply-parts";
import {
  clampMenuValue,
  EDIT_START_DRAFT,
} from "@/lib/controllers/controller-panel-map";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import { sliceControllerTrendByTime } from "@/lib/data/trend-period-slice";
import {
  downsampleByIndices,
  pickLttbIndices,
  targetChartDisplayBars,
  tickEveryForDisplayBars,
  formatTrendScopeRangeLabel,
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
  resolveUnifiedPlotLayout,
  sliceUnifiedTrendByIndex,
  splitYVisibilityFromLayers,
  countSplitYBands,
  hitSplitYBand,
  resolveYScopeBands,
  visibilityForYBands,
  maskLayersForYBands,
  isSingleYBandFocus,
  unmapHumPctFromSplitY,
  unmapMotorPctFromSplitY,
  unmapTempCFromSplitY,
  type UnifiedLayerFlags,
  type UnifiedYBandId,
} from "@/lib/farm/unified-barn-trend-series";
import { envComfortScore } from "@/lib/farm/env-comfort-score";
import { useSplitYLayoutTransition } from "@/lib/farm/use-split-y-layout-transition";
import { trendPeriodLabel } from "@/lib/farm/farm-view-url";
import { useFarmLiveRefreshOptional } from "@/lib/navigation/farm-live-refresh";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionDuration } from "@/lib/ui/motion-tokens";
import {
  humanizeGuidedScopeRect,
  type GuidedScopeRect,
} from "@/lib/ui/delin-guided-scope-jitter";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import {
  chartUiPx,
  farmChartUi,
  FARM_CHART_UI_SCALE,
} from "@/lib/ui/farm-chart-ui-scale";
import { cn } from "@/lib/utils";
import {
  FARM_TOUR_ACTION_EVENT,
  type TourGridAction,
} from "@/lib/onboarding/tour-steps";
import { dispatchTourGridActionDone, afterFrames } from "@/lib/onboarding/tour-timing";

const TEMP_STEP = 0.5;
const HUM_STEP = 1;
const TEMP_MIN = 10;
const TEMP_MAX = 35;
const HUM_MIN = 0;
const HUM_MAX = 100;

const ALARM_EDGE_KEY: Record<string, keyof AlarmThresholds> = {
  "temp-hi": "tempHigh",
  "temp-lo": "tempLow",
  "hum-hi": "humidityHigh",
  "hum-lo": "humidityLow",
};

function sliceControllerSeries(
  series: TrendControllerSeries,
  from: number,
  to: number,
): TrendControllerSeries {
  return {
    ...series,
    temp: series.temp.slice(from, to),
    humidity: series.humidity.slice(from, to),
    fanSupply: series.fanSupply.slice(from, to),
    fanExhaust: series.fanExhaust.slice(from, to),
    fanIntake: series.fanIntake.slice(from, to),
    sampleCount: series.sampleCount.slice(from, to),
  };
}

function brushSliceRange(
  length: number,
  win: BrushWindow,
): { from: number; to: number } {
  const from = Math.max(0, Math.min(length - 2, Math.floor(win.start * length)));
  const to = Math.max(
    from + 2,
    Math.min(length, Math.ceil((win.start + win.width) * length)),
  );
  return { from, to };
}

function meanTempDriver(
  seriesList: TrendControllerSeries[],
  len: number,
): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: len }, () => null);
  for (let i = 0; i < len; i++) {
    let sum = 0;
    let count = 0;
    for (const s of seriesList) {
      const v = s.temp[i];
      if (v != null && Number.isFinite(v)) {
        sum += v;
        count += 1;
      }
    }
    out[i] = count > 0 ? sum / count : null;
  }
  return out;
}

function downsampleSeriesForChart(
  seriesList: TrendControllerSeries[],
  categories: string[],
  plotWidthPx: number,
): { seriesList: TrendControllerSeries[]; categories: string[] } {
  const bars = targetChartDisplayBars(categories.length, plotWidthPx);
  if (bars >= categories.length) {
    return { seriesList, categories };
  }
  const idx = pickLttbIndices(
    meanTempDriver(seriesList, categories.length),
    bars,
  );
  return {
    categories: downsampleByIndices(categories, idx),
    seriesList: seriesList.map((s) => ({
      ...s,
      temp: downsampleByIndices(s.temp, idx),
      humidity: downsampleByIndices(s.humidity, idx),
      fanSupply: downsampleByIndices(s.fanSupply, idx),
      fanExhaust: downsampleByIndices(s.fanExhaust, idx),
      fanIntake: downsampleByIndices(s.fanIntake, idx),
      sampleCount: downsampleByIndices(s.sampleCount, idx),
    })),
  };
}

function snapStep(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function clampAlarmDraft(
  next: AlarmThresholds,
  key: keyof AlarmThresholds,
): AlarmThresholds {
  let { tempLow, tempHigh, humidityLow, humidityHigh } = next;
  if (key === "tempHigh" || key === "tempLow") {
    tempHigh = snapStep(tempHigh, TEMP_STEP);
    tempLow = snapStep(tempLow, TEMP_STEP);
    tempHigh = Math.min(TEMP_MAX, Math.max(TEMP_MIN + TEMP_STEP, tempHigh));
    tempLow = Math.min(TEMP_MAX - TEMP_STEP, Math.max(TEMP_MIN, tempLow));
    if (tempHigh <= tempLow) {
      if (key === "tempHigh") tempHigh = tempLow + TEMP_STEP;
      else tempLow = tempHigh - TEMP_STEP;
    }
  } else {
    humidityHigh = snapStep(humidityHigh, HUM_STEP);
    humidityLow = snapStep(humidityLow, HUM_STEP);
    humidityHigh = Math.min(HUM_MAX, Math.max(HUM_MIN + HUM_STEP, humidityHigh));
    humidityLow = Math.min(HUM_MAX - HUM_STEP, Math.max(HUM_MIN, humidityLow));
    if (humidityHigh <= humidityLow) {
      if (key === "humidityHigh") humidityHigh = humidityLow + HUM_STEP;
      else humidityLow = humidityHigh - HUM_STEP;
    }
  }
  return { tempLow, tempHigh, humidityLow, humidityHigh };
}

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

/** 모바일 차트 대상 — 축사유형 + 축사/컨트롤러 아이콘·번호 */
function ChartScopeTargetMarks({
  chartScope,
  controllers,
  fallbackLabel,
  typeClassName,
}: {
  chartScope: FarmChartScope;
  controllers: UnifiedBarnTrendControllerRef[];
  fallbackLabel: string;
  typeClassName?: string;
}) {
  if (chartScope.level === "farm") {
    return fallbackLabel;
  }

  const typeLabel = formatControllerHeaderStallType({
    stallTyCode: chartScope.stallTyCode,
  });

  if (chartScope.level === "sp") {
    return <span className={cn("break-keep", typeClassName)}>{typeLabel}</span>;
  }

  const stallNo = chartScope.stallNo.startsWith("__")
    ? null
    : chartScope.stallNo;

  const controllerReading =
    chartScope.level === "controller"
      ? (controllers.find((c) => c.key === chartScope.controllerKey)?.reading ??
        controllers[0]?.reading)
      : controllers.length === 1
        ? controllers[0]?.reading
        : null;

  if (controllerReading) {
    return (
      <ControllerAffiliationMarks
        stallTyCode={chartScope.stallTyCode}
        stallNo={stallNo ?? controllerReading.stallNo}
        eqpmnNo={controllerReading.eqpmnNo}
        typeClassName={typeClassName}
      />
    );
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className={cn("break-keep", typeClassName)}>{typeLabel}</span>
      <StallUnitNoMark stallNo={stallNo} />
    </span>
  );
}

type Props = {
  label: string;
  controllers: UnifiedBarnTrendControllerRef[];
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  onPeriodChange?: (period: TrendPeriodId) => void;
  alarmSettings?: AlarmSettings;
  /** LIVE/명령 반영 제어값 — 설정모드 초깃값 */
  thermoSettings?: Record<string, ControllerThermoSettings>;
  /** 차트 집계 범위 — 알람 저장 계층과 동일 */
  chartScope: FarmChartScope;
  /** 한계 이탈 tip 우클릭 → 컨트롤러 스코프 */
  onScopeChange?: (scope: FarmChartScope) => void;
  /** P2 — URL/DELIN handoff 초기 Y밴드·X구간 */
  initialZoom?: ChartTrendZoomHint | null;
  /** E — 집중 칩·스코프 → URL chartYBand 동기화 */
  onZoomChange?: (zoom: ChartTrendZoomHint | null) => void;
  /**
   * DELIN — 실제 X스코프 UI로 클릭→드래그→커밋 시연.
   * token 증가 시 재생. CSS 오버레이 아님.
   */
  guidedXScopeGesture?: {
    token: number;
    startRatio: number;
    endRatio: number;
    startIndex?: number;
    endIndex?: number;
    /** plot 상단=0 · 하단=1. yStart/yEnd 미지정 시 온도 레인 직사각형 */
    yRatio?: number;
    yStartRatio?: number;
    yEndRatio?: number;
    durationMs?: number;
  } | null;
  onGuidedXScopeComplete?: () => void;
  /** 조회 전용(뷰어)이면 알람·제어 편집 비활성 */
  canCommand?: boolean;
  isMobileStack?: boolean;
  /** 미지정 시 모바일 320 / 데스크톱 340 */
  chartHeight?: number;
  /** 차트 탭 활성 시에만 TopBar 레이어 툴바 표시 */
  layersToolbarActive?: boolean;
  /** 모바일 — 헤더에 집계 범위 핸들 (우측 패널 오픈) */
  mobileScopeHandle?: {
    open: boolean;
    onOpen: () => void;
  } | null;
  /** 추이 fetch 중 — 빈 화면을 '데이터 없음'과 구분 */
  trendLoading?: boolean;
  trendError?: boolean;
  /** 24시간 이후 30일 1시간을 이어 받는 중 */
  trendExtending?: boolean;
  /** 브러시 확대(≤48h) 구간 15분 */
  window15mLoading?: boolean;
  window15m?: TrendWindow15m | null;
  onNeedWindow15m?: (fromMs: number, toMs: number) => void;
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
  alarmSettings,
  thermoSettings = {},
  chartScope,
  onScopeChange,
  initialZoom = null,
  onZoomChange,
  guidedXScopeGesture = null,
  onGuidedXScopeComplete,
  canCommand = false,
  isMobileStack = false,
  chartHeight,
  layersToolbarActive = true,
  mobileScopeHandle = null,
  trendLoading = false,
  trendError = false,
  trendExtending = false,
  window15mLoading = false,
  window15m = null,
  onNeedWindow15m,
  className,
}: Props) {
  const liveRefresh = useFarmLiveRefreshOptional();
  const [layers, setLayers] = useState<UnifiedLayerFlags>(DEFAULT_UNIFIED_LAYERS);
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
  const [brushWindow, setBrushWindow] = useState<BrushWindow>(
    () => BRUSH_PERIOD_WINDOW[period],
  );
  const [chartPlotWidth, setChartPlotWidth] = useState(0);
  const onChartPlotWidth = useCallback((w: number) => {
    setChartPlotWidth((prev) => (Math.abs(prev - w) < 8 ? prev : w));
  }, []);
  const plotWidthPx = chartPlotWidth > 32 ? chartPlotWidth : 800;
  const [draftThresholds, setDraftThresholds] = useState<AlarmThresholds | null>(
    null,
  );
  const [dragFreeze, setDragFreeze] = useState<AlarmThresholds | null>(null);
  const [alarmSaving, setAlarmSaving] = useState(false);
  const [alarmSaveError, setAlarmSaveError] = useState<string | null>(null);
  const draftRef = useRef<AlarmThresholds | null>(null);
  const freezeRef = useRef<AlarmThresholds | null>(null);
  /** view=줌·알람 · control=설정온도·편차 */
  const [chartMode, setChartMode] = useState<"view" | "control">("view");
  const [thermoDraft, setThermoDraft] = useState<ChartThermoDraft | null>(null);
  const [thermoApplying, setThermoApplying] = useState(false);
  const [thermoApplyError, setThermoApplyError] = useState<string | null>(null);
  const thermoDraftRef = useRef<ChartThermoDraft | null>(null);
  const [scopeMotionKey, setScopeMotionKey] = useState(0);
  const [scopeMotionDir, setScopeMotionDir] = useState<"in" | "out">("in");
  const bumpScopeMotion = (dir: "in" | "out") => {
    setScopeMotionDir(dir);
    setScopeMotionKey((k) => k + 1);
  };
  const initialZoomKeyRef = useRef<string>("");

  if (layersToolbarActive !== toolbarActiveSeen) {
    setToolbarActiveSeen(layersToolbarActive);
    if (layersToolbarActive) {
      setLayersToolbarMounted(true);
      setLayersToolbarPhase("enter");
      setLayersAnimKey((k) => k + 1);
    } else {
      setLayersToolbarPhase("exit");
    }
  }

  const scopedReadings = useMemo(
    () =>
      controllers
        .map((c) => c.reading)
        .filter((r): r is BarnReading => r != null),
    [controllers],
  );

  const onThermoRefreshLive = useCallback(() => {
    void liveRefresh?.revalidateFarmLive();
  }, [liveRefresh]);
  const liveTracker = useBulkCommandPipelineTracker({
    thermoSettings,
    readings: scopedReadings,
    onRefreshLive: onThermoRefreshLive,
    onCommandAck: (cmd) => liveRefresh?.patchThermoFromCommand(cmd),
  });

  const alarmScopeKey = useMemo(
    () => alarmScopeKeyFromFarmChartScope(scopedReadings, chartScope),
    [scopedReadings, chartScope],
  );

  const [alarmScopeEpoch, setAlarmScopeEpoch] = useState(alarmScopeKey ?? "");
  if ((alarmScopeKey ?? "") !== alarmScopeEpoch) {
    setAlarmScopeEpoch(alarmScopeKey ?? "");
    setDraftThresholds(null);
    setDragFreeze(null);
    setAlarmSaveError(null);
  }

  const baseThresholds = useMemo(() => {
    const settings = alarmSettings ?? DEFAULT_ALARM_SETTINGS;
    if (alarmScopeKey) {
      return resolveThresholdsForScope(settings, alarmScopeKey);
    }
    const withReading = controllers.find((c) => c.reading != null)?.reading;
    if (!withReading) return DEFAULT_ALARM_THRESHOLDS;
    return resolveReadingAlarmThresholds(withReading, settings);
  }, [controllers, alarmSettings, alarmScopeKey]);

  const thresholds = draftThresholds ?? baseThresholds;
  /** 드래그 중 Y 도메인 고정 — 선이 커서를 따라가게 */
  const mappingThresholds = dragFreeze ?? thresholds;

  const baseThermo: ChartThermoDraft = (() => {
    for (const c of controllers) {
      const r = c.reading;
      if (!r) continue;
      // 채널 A·명령 우선 (slim LIVE 베이스 키만 보면 ACK 전 옛값으로 시드됨)
      const hit = resolveReadingThermo(r, thermoSettings);
      if (hit) {
        return {
          setpointTemp: hit.setpointTemp,
          tempDeviation: hit.tempDeviation,
          minVentPct: hit.minVentPct,
          maxVentPct: hit.maxVentPct,
        };
      }
    }
    return {
      setpointTemp: EDIT_START_DRAFT.setpointTemp,
      tempDeviation: EDIT_START_DRAFT.tempDeviation,
      minVentPct: EDIT_START_DRAFT.minVentPct,
      maxVentPct: EDIT_START_DRAFT.maxVentPct,
    };
  })();

  const thermo = thermoDraft ?? baseThermo;
  const controlMode = chartMode === "control";
  const onlineScopedReadings = scopedReadings.filter((r) =>
    isReadingOnline(r.status),
  );
  const thermoDirty =
    controlMode &&
    thermoDraft != null &&
    (Math.abs(thermoDraft.setpointTemp - baseThermo.setpointTemp) > 0.05 ||
      Math.abs(thermoDraft.tempDeviation - baseThermo.tempDeviation) > 0.05 ||
      thermoDraft.minVentPct !== baseThermo.minVentPct ||
      thermoDraft.maxVentPct !== baseThermo.maxVentPct);

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
  const targetPlot = useMemo(
    () => resolveUnifiedPlotLayout(scopeVisibility, mappingThresholds),
    [scopeVisibility, mappingThresholds],
  );
  const layout = useSplitYLayoutTransition(targetPlot.layout);
  const chartLeftUnit = targetPlot.leftUnit;
  /** 드래그 hit/미리보기 — 레이어 기준(스코프 전) */
  const layerLayout = useMemo(
    () => resolveUnifiedPlotLayout(layerVisibility, mappingThresholds).layout,
    [layerVisibility, mappingThresholds],
  );

  /** 브러시 — 30일 1시간 양호도 */
  const brushSourceByPeriod = useMemo(() => {
    if (isContextControllerTrend30d(controllerTrendByPeriod?.["30d"])) {
      return controllerTrendByPeriod ?? null;
    }
    return null;
  }, [controllerTrendByPeriod]);

  const brushOverview = useMemo(() => {
    const periodData = brushSourceByPeriod?.["30d"] ?? null;
    if (!periodData) return [];
    const paired = controllers
      .map((c) => {
        const r = c.reading;
        if (!r) return null;
        const series = findControllerTrendSeries(
          brushSourceByPeriod,
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
  }, [controllers, brushSourceByPeriod, alarmSettings]);

  const splitBandGuides = useMemo(() => {
    const guides: number[] = [];
    const motorH = layout.motorHi - layout.motorLo;
    const humH = layout.humHi - layout.humLo;
    const tempH = layout.tempHi - layout.tempLo;
    /** 모터↔환경 구분만. 온도·습도 사이 점선은 표시하지 않음 */
    if (motorH > 0.5 && (humH > 0.5 || tempH > 0.5)) {
      guides.push(layout.motorHi);
    }
    return guides;
  }, [layout]);

  const canvasPeriod: TrendPeriodId = pickTrendCanvasPeriod(
    controllerTrendByPeriod,
    period,
  );
  const context30d = isContextControllerTrend30d(controllerTrendByPeriod?.["30d"]);
  const useBrushCanvas = context30d;
  const displayPeriod = useBrushCanvas
    ? displayPeriodFromBrushWindow(brushWindow)
    : canvasPeriod;
  const d30FromMs = Date.parse(
    controllerTrendByPeriod?.["30d"]?.bucketAts[0] ?? "",
  );
  const brushRangeMs =
    useBrushCanvas && Number.isFinite(d30FromMs)
      ? brushWindowToRangeMs(
          brushWindow,
          d30FromMs,
          TREND_PERIODS["30d"].durationMs,
        )
      : null;
  const brushFromMs = brushRangeMs?.fromMs ?? null;
  const brushToMs = brushRangeMs?.toMs ?? null;
  const brushNeedsWindow15m =
    brushFromMs != null &&
    brushToMs != null &&
    brushWindowNeeds15m(brushWindow) &&
    !window15mCovers(window15m, brushFromMs, brushToMs);

  useEffect(() => {
    if (!brushNeedsWindow15m || brushFromMs == null || brushToMs == null) return;
    const timer = window.setTimeout(() => {
      onNeedWindow15m?.(brushFromMs, brushToMs);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [brushNeedsWindow15m, brushFromMs, brushToMs, onNeedWindow15m]);

  /** 브러시 창 — ≤48h이면 구간 15분, 아니면 30일 1시간 슬라이스 */
  const windowBundle = useMemo(() => {
    const collectRange = (periodId: TrendPeriodId, from: number, to: number) => {
      const periodData = controllerTrendByPeriod?.[periodId] ?? null;
      const categoriesRaw = periodData?.categories ?? [];
      if (!categoriesRaw.length) return null;
      const windowCategories = categoriesRaw.slice(from, to);
      if (windowCategories.length < 2) return null;

      const seriesList = controllers
        .map((c) => {
          const r = c.reading;
          if (!r) return null;
          const found = findControllerTrendSeries(
            controllerTrendByPeriod,
            periodId,
            r.stallTyCode,
            r.stallNo,
            r.controllerKey,
          );
          if (!found) return null;
          return {
            ...sliceControllerSeries(found, from, to),
            zoneLabel: formatControllerHeaderPrimary(r),
            equipmentLabel: formatControllerHeaderSecondary(r),
            stallTyCode: r.stallTyCode
              ? normalizeStallTyCode(r.stallTyCode)
              : undefined,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s != null);

      if (!seriesList.length) return null;
      return { categories: windowCategories, seriesList };
    };

    const collectFromData = (
      periodData: TrendControllerPeriodData,
      from: number,
      to: number,
    ) => {
      const fake: Record<TrendPeriodId, TrendControllerPeriodData> = {
        "24h": emptyTrendControllerPeriodData("24h"),
        "7d": emptyTrendControllerPeriodData("7d"),
        "30d": emptyTrendControllerPeriodData("30d"),
        [periodData.period]: periodData,
      };
      const categoriesRaw = periodData.categories;
      const windowCategories = categoriesRaw.slice(from, to);
      if (windowCategories.length < 2) return null;
      const seriesList = controllers
        .map((c) => {
          const r = c.reading;
          if (!r) return null;
          const found = findControllerTrendSeries(
            fake,
            periodData.period,
            r.stallTyCode,
            r.stallNo,
            r.controllerKey,
          );
          if (!found) return null;
          return {
            ...sliceControllerSeries(found, from, to),
            zoneLabel: formatControllerHeaderPrimary(r),
            equipmentLabel: formatControllerHeaderSecondary(r),
            stallTyCode: r.stallTyCode
              ? normalizeStallTyCode(r.stallTyCode)
              : undefined,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s != null);
      if (!seriesList.length) return null;
      return { categories: windowCategories, seriesList };
    };

    const collect = (periodId: TrendPeriodId, brush: boolean) => {
      const periodData = controllerTrendByPeriod?.[periodId] ?? null;
      const categoriesRaw = periodData?.categories ?? [];
      if (!categoriesRaw.length) return null;
      if (!brush) return collectRange(periodId, 0, categoriesRaw.length);
      const range = brushSliceRange(categoriesRaw.length, brushWindow);
      return collectRange(periodId, range.from, range.to);
    };

    if (
      useBrushCanvas &&
      brushFromMs != null &&
      brushToMs != null &&
      window15mCovers(window15m, brushFromMs, brushToMs) &&
      window15m
    ) {
      const sliced =
        sliceControllerTrendByTime(window15m.data, brushFromMs, brushToMs) ??
        window15m.data;
      const fromWindow = collectFromData(sliced, 0, sliced.categories.length);
      if (fromWindow) return fromWindow;
    }

    if (useBrushCanvas && context30d) {
      const primary = collect("30d", true);
      if (primary) return primary;
    }

    const primary = collect(canvasPeriod, false);
    if (primary) return primary;
    if (canvasPeriod !== "24h") return collect("24h", false);
    return null;
  }, [
    controllers,
    controllerTrendByPeriod,
    canvasPeriod,
    useBrushCanvas,
    context30d,
    window15m,
    brushFromMs,
    brushToMs,
    brushWindow,
  ]);

  /** M1 — 다운샘플+집계는 layout 무관 1회, 보간은 Y매핑만 */
  const trendRaw = useMemo(() => {
    if (!windowBundle) return null;
    const down = downsampleSeriesForChart(
      windowBundle.seriesList,
      windowBundle.categories,
      plotWidthPx,
    );
    return aggregateUnifiedBarnTrendRaw(
      down.seriesList,
      down.categories,
      mappingThresholds,
    );
  }, [windowBundle, mappingThresholds, plotWidthPx]);

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

  /** 농장 기간 변경 시 브러시 창·스코프 시드 (render-time sync — effect setState 회피) */
  const [scopePeriod, setScopePeriod] = useState(period);
  if (period !== scopePeriod) {
    setScopePeriod(period);
    setXScopeStack([]);
    setBrushWindow(BRUSH_PERIOD_WINDOW[period]);
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

  /** P2 — URL/DELIN 줌 힌트 1회 적용 (온도 레인 포커스 등) */
  useEffect(() => {
    if (!initialZoom) {
      initialZoomKeyRef.current = "";
      return;
    }
    if (!picked) return;
    const n = picked.categories.length;
    if (n < 3) return;
    const key = [
      period,
      initialZoom.yBands.join("+"),
      initialZoom.startRatio.toFixed(3),
      initialZoom.endRatio.toFixed(3),
      String(n),
    ].join("|");
    if (initialZoomKeyRef.current === key) return;
    let start: number;
    let end: number;
    if (
      initialZoom.startIndex != null &&
      initialZoom.endIndex != null &&
      Number.isFinite(initialZoom.startIndex) &&
      Number.isFinite(initialZoom.endIndex)
    ) {
      start = Math.max(
        0,
        Math.min(
          n - 1,
          Math.round(Math.min(initialZoom.startIndex, initialZoom.endIndex)),
        ),
      );
      end = Math.max(
        0,
        Math.min(
          n - 1,
          Math.round(Math.max(initialZoom.startIndex, initialZoom.endIndex)),
        ),
      );
    } else {
      const i0 = Math.round(initialZoom.startRatio * (n - 1));
      const i1 = Math.round(initialZoom.endRatio * (n - 1));
      start = Math.max(0, Math.min(i0, i1));
      end = Math.min(n - 1, Math.max(i0, i1));
    }
    if (end - start < 2) {
      if (end < n - 1) end = Math.min(n - 1, start + 2);
      else start = Math.max(0, end - 2);
    }
    if (end - start < 2) return;
    initialZoomKeyRef.current = key;
    setXScopeStack([
      {
        start,
        end,
        yBands: initialZoom.yBands as UnifiedYBandId[],
      },
    ]);
    bumpScopeMotion("in");
  }, [initialZoom, picked, period]);

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
    if (windowBundle) {
      const span = Math.max(1, picked.categories.length - 1);
      const r0 = xScope.start / span;
      const r1 = xScope.end / span;
      const dN = windowBundle.categories.length;
      const from = Math.max(0, Math.floor(r0 * (dN - 1)));
      const to = Math.min(
        dN,
        Math.max(from + 2, Math.ceil(r1 * (dN - 1)) + 1),
      );
      const cats = windowBundle.categories.slice(from, to);
      if (cats.length >= 2) {
        const series = windowBundle.seriesList.map((s) =>
          sliceControllerSeries(s, from, to),
        );
        const down = downsampleSeriesForChart(series, cats, plotWidthPx);
        const raw = aggregateUnifiedBarnTrendRaw(
          down.seriesList,
          down.categories,
          mappingThresholds,
        );
        if (raw) {
          const builtScoped = mapUnifiedBarnTrendRawToSplitY(raw, layout);
          if (builtScoped) {
            const pickLayers = maskLayersForYBands(layers, xScope.yBands);
            const pickedScoped = pickUnifiedTrendLayers(builtScoped, pickLayers);
            return {
              categories: builtScoped.categories,
              series: pickedScoped.series,
              envelopes: pickedScoped.envelopes,
              histograms: pickedScoped.histograms,
            };
          }
        }
      }
    }
    return sliceUnifiedTrendByIndex(
      picked.categories,
      picked,
      xScope.start,
      xScope.end,
    );
  }, [
    picked,
    xScope,
    windowBundle,
    mappingThresholds,
    layout,
    layers,
    plotWidthPx,
  ]);

  const chartCategories = scoped?.categories ?? [];

  const emitZoom = useCallback(
    (entry: ScopeEntry | null) => {
      if (!onZoomChange) return;
      const n = picked?.categories.length ?? 0;
      onZoomChange(chartScopeEntryToZoomHint(entry, n));
    },
    [onZoomChange, picked?.categories.length],
  );

  /** 부모 URL 동기화 — 렌더/updater 중 setState 금지 */
  const deferEmitZoom = useCallback(
    (entry: ScopeEntry | null) => {
      queueMicrotask(() => emitZoom(entry));
    },
    [emitZoom],
  );

  const commitXScope = (
    range: {
      start: number;
      end: number;
      yStartRatio: number;
      yEndRatio: number;
    },
    mode: "push" | "replace" = "push",
  ) => {
    if (!picked) return;
    const domain = built?.leftDomain ?? ([0, 100] as [number, number]);
    const span = domain[1] - domain[0] || 1;
    const domainY0 = domain[1] - range.yStartRatio * span;
    const domainY1 = domain[1] - range.yEndRatio * span;
    const multi = countSplitYBands(layerVisibility) > 1;
    const detected =
      mode === "replace"
        ? null
        : xScope?.yBands == null && multi
          ? resolveYScopeBands(domainY0, domainY1, layerLayout, layerVisibility)
          : null;
    /** P2 — 드래그 중심이 온도 레인이면 온도만 확장 */
    let yBands = mode === "replace" ? (["temp"] as UnifiedYBandId[]) : (xScope?.yBands ?? detected);
    if (mode !== "replace" && xScope?.yBands == null && multi) {
      const centerY = (domainY0 + domainY1) / 2;
      if (
        hitSplitYBand(centerY, layerLayout, layerVisibility) === "temp"
      ) {
        yBands = ["temp"];
      }
    }
    /** replace=가이드 시연 — 전체 축 절대 인덱스(중첩 금지) */
    const next: ScopeEntry = {
      start:
        mode === "replace" || xScope == null
          ? range.start
          : xScope.start + range.start,
      end:
        mode === "replace" || xScope == null
          ? range.end
          : xScope.start + range.end,
      yBands,
    };
    if (mode === "replace") {
      setXScopeStack([next]);
    } else {
      setXScopeStack((stack) => [...stack, next]);
    }
    bumpScopeMotion("in");
    deferEmitZoom(next);
  };

  const popXScope = () => {
    if (xScopeStack.length === 0) return;
    const nextStack = xScopeStack.slice(0, -1);
    const entry = nextStack.length > 0 ? nextStack[nextStack.length - 1]! : null;
    setXScopeStack(nextStack);
    bumpScopeMotion(xScopeStack.length <= 1 ? "out" : "in");
    deferEmitZoom(entry);
  };

  const clearXScope = () => {
    if (xScopeStack.length > 0) bumpScopeMotion("out");
    setXScopeStack([]);
    deferEmitZoom(null);
  };

  useEffect(() => {
    if (xScopeStack.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      popXScope();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [xScopeStack.length]);

  const alarmDragEnabled =
    canCommand &&
    Boolean(alarmScopeKey) &&
    !alarmSaving &&
    controlMode;
  const thermoDragEnabled =
    canCommand && controlMode && !thermoApplying;

  /** 가이드 제스처 토큰 변경 시 스택 비움 — TrendChart 전달은 비운 뒤 */
  const gestureToken = guidedXScopeGesture?.token ?? 0;
  const [prevGestureToken, setPrevGestureToken] = useState(0);
  const [guideReadyToken, setGuideReadyToken] = useState(0);
  if (gestureToken !== prevGestureToken) {
    setPrevGestureToken(gestureToken);
    setXScopeStack([]);
    setGuideReadyToken(gestureToken);
  }

  useLayoutEffect(() => {
    initialZoomKeyRef.current = "";
  }, [gestureToken]);

  const guidedScopeBase = useMemo(() => {
    if (!guidedXScopeGesture || !built) return null;
    const domain = built.leftDomain;
    const span = domain[1] - domain[0] || 1;
    const bandH = Math.max(0, layerLayout.tempHi - layerLayout.tempLo);
    /** 온도 레인 안 넉넉한 직사각형 — 가장자리 ~10% 여백 */
    const inset = Math.max(bandH * 0.1, 1);
    let domainYTop = layerLayout.tempHi - inset;
    let domainYBot = layerLayout.tempLo + inset;
    if (domainYTop < domainYBot) {
      const mid = (layerLayout.tempLo + layerLayout.tempHi) / 2;
      domainYTop = mid + bandH * 0.35;
      domainYBot = mid - bandH * 0.35;
    }
    const toPlotRatio = (domainY: number) =>
      Math.min(1, Math.max(0, (domain[1] - domainY) / span));

    let y0: number;
    let y1: number;
    if (
      guidedXScopeGesture.yStartRatio != null &&
      guidedXScopeGesture.yEndRatio != null
    ) {
      y0 = Math.min(
        guidedXScopeGesture.yStartRatio,
        guidedXScopeGesture.yEndRatio,
      );
      y1 = Math.max(
        guidedXScopeGesture.yStartRatio,
        guidedXScopeGesture.yEndRatio,
      );
    } else if (guidedXScopeGesture.yRatio != null) {
      const m = guidedXScopeGesture.yRatio;
      y0 = Math.max(0, m - 0.08);
      y1 = Math.min(1, m + 0.08);
    } else {
      y0 = toPlotRatio(domainYTop);
      y1 = toPlotRatio(domainYBot);
    }
    if (y1 - y0 < 0.05) {
      const mid = (y0 + y1) / 2;
      y0 = Math.max(0, mid - 0.04);
      y1 = Math.min(1, mid + 0.04);
    }

    const base: GuidedScopeRect = {
      startRatio: guidedXScopeGesture.startRatio,
      endRatio: guidedXScopeGesture.endRatio,
      yStartRatio: y0,
      yEndRatio: y1,
      durationMs: guidedXScopeGesture.durationMs,
    };

    return {
      token: guidedXScopeGesture.token,
      startRatio: guidedXScopeGesture.startRatio,
      endRatio: guidedXScopeGesture.endRatio,
      startIndex: guidedXScopeGesture.startIndex,
      endIndex: guidedXScopeGesture.endIndex,
      durationMs: guidedXScopeGesture.durationMs,
      base,
    };
  }, [
    guidedXScopeGesture,
    built,
    layerLayout.tempLo,
    layerLayout.tempHi,
  ]);

  /** token당 humanize 1회 — render sync (ref 캐시 금지) */
  const [guidedJitterCache, setGuidedJitterCache] = useState<{
    token: number;
    rect: GuidedScopeRect;
  } | null>(null);
  if (guidedScopeBase) {
    if (guidedJitterCache?.token !== guidedScopeBase.token) {
      setGuidedJitterCache({
        token: guidedScopeBase.token,
        rect: humanizeGuidedScopeRect(guidedScopeBase.base),
      });
    }
  } else if (guidedJitterCache !== null) {
    setGuidedJitterCache(null);
  }

  const resolvedGuidedXScope = useMemo(() => {
    if (
      !guidedScopeBase ||
      !guidedJitterCache ||
      guidedJitterCache.token !== guidedScopeBase.token
    ) {
      return null;
    }
    const human = guidedJitterCache.rect;
    /** X는 초과 인덱스 기준 비율 고정(좌표 드리프트 방지). Y만 humanize */
    return {
      token: guidedScopeBase.token,
      startRatio: guidedScopeBase.startRatio,
      endRatio: guidedScopeBase.endRatio,
      startIndex: guidedScopeBase.startIndex,
      endIndex: guidedScopeBase.endIndex,
      yStartRatio: human.yStartRatio,
      yEndRatio: human.yEndRatio,
      durationMs: human.durationMs ?? guidedScopeBase.durationMs,
    };
  }, [guidedScopeBase, guidedJitterCache]);

  /**
   * 스택이 비워진 뒤에만 시연 — 기존 X스코프 위에서 비율을 쓰면
   * 잘린 카테고리 기준으로 엉뚱한 구간이 커밋됨.
   */
  const activeGuidedXScope =
    resolvedGuidedXScope &&
    guideReadyToken === resolvedGuidedXScope.token &&
    xScopeStack.length === 0
      ? resolvedGuidedXScope
      : null;

  const persistAlarmDraft = (nextDraft: AlarmThresholds) => {
    if (!alarmScopeKey || !canCommand) return;
    const err = validateAlarmThresholds(nextDraft);
    if (err) {
      setAlarmSaveError(err);
      setDraftThresholds(null);
      setDragFreeze(null);
      draftRef.current = null;
      freezeRef.current = null;
      return;
    }
    const previous = alarmSettings ?? DEFAULT_ALARM_SETTINGS;
    /** farm/sp 저장 시 하위·legacy 유형 오버라이드 제거 — 설정모드 제어 일괄과 동일하게 스코프 상속 */
    const cascadeStallTy =
      !alarmScopeKey.includes("|stall:") &&
      !alarmScopeKey.includes("|ctrl:");
    const { settings: nextSettings } = applyScopeAlarmThresholdsWithCascade(
      previous,
      alarmScopeKey,
      nextDraft,
      cascadeStallTy
        ? {
            stallTyCodesToClear: scopedReadings
              .map((r) => normalizeStallTyCode(r.stallTyCode))
              .filter((sp) => sp !== "UNK"),
          }
        : undefined,
    );
    setAlarmSaving(true);
    setAlarmSaveError(null);
    const formData = new FormData();
    formData.set("settings_json", JSON.stringify(nextSettings));
    void (async () => {
      try {
        const result = await saveAlarmSettingsInlineAction(formData);
        if (!result.ok) {
          setAlarmSaveError(result.error ?? "임계 가이드 저장에 실패했습니다.");
          setDraftThresholds(null);
          draftRef.current = null;
          return;
        }
        liveRefresh?.patchAlarmSettings(nextSettings);
        setDraftThresholds(null);
        draftRef.current = null;
      } finally {
        setAlarmSaving(false);
        setDragFreeze(null);
        freezeRef.current = null;
      }
    })();
  };

  const onScaleEdgeDrag = (event: ScaleEdgeDragEvent) => {
    if (controlMode && isChartThermoEdgeId(event.id)) {
      if (!thermoDragEnabled && event.phase !== "cancel") return;
      const mapLo = mappingThresholds.tempLow;
      const mapHi = mappingThresholds.tempHigh;

      if (event.phase === "start") {
        const base = thermoDraftRef.current ?? baseThermo;
        setThermoDraft(base);
        thermoDraftRef.current = base;
        setThermoApplyError(null);
        return;
      }
      if (event.phase === "cancel") {
        setThermoDraft(null);
        thermoDraftRef.current = null;
        return;
      }
      if (event.phase === "move") {
        const cur = thermoDraftRef.current ?? baseThermo;
        let next: ChartThermoDraft = cur;
        if (isChartMotorVentEdgeId(event.id)) {
          const rawPct = unmapMotorPctFromSplitY(event.value, layout);
          if (rawPct == null || !Number.isFinite(rawPct)) return;
          if (event.id === CHART_THERMO_EDGE_IDS.minVentPct) {
            next = clampChartVentDraft(
              {
                ...cur,
                minVentPct: clampMenuValue("minVent", rawPct),
              },
              "minVentPct",
            );
          } else {
            next = clampChartVentDraft(
              {
                ...cur,
                maxVentPct: clampMenuValue("maxVent", rawPct),
              },
              "maxVentPct",
            );
          }
        } else {
          const rawC = unmapTempCFromSplitY(event.value, mapLo, mapHi, layout);
          if (rawC == null || !Number.isFinite(rawC)) return;
          if (event.id === CHART_THERMO_EDGE_IDS.setpoint) {
            next = {
              ...cur,
              setpointTemp: clampMenuValue("setpoint", rawC),
            };
          } else if (event.id === CHART_THERMO_EDGE_IDS.highVentTemp) {
            next = {
              ...cur,
              tempDeviation: clampMenuValue(
                "deviation",
                Math.max(0, rawC - cur.setpointTemp),
              ),
            };
          }
        }
        thermoDraftRef.current = next;
        setThermoDraft(next);
        return;
      }
      // end — draft kept until apply / exit
      return;
    }

    if (!canCommand || !alarmScopeKey) return;
    if (alarmSaving && event.phase !== "cancel") return;
    const key = ALARM_EDGE_KEY[event.id];
    if (!key) return;

    if (event.phase === "start") {
      const base = draftRef.current ?? baseThresholds;
      freezeRef.current = base;
      draftRef.current = base;
      setDragFreeze(base);
      setDraftThresholds(base);
      setAlarmSaveError(null);
      return;
    }

    if (event.phase === "cancel") {
      draftRef.current = null;
      freezeRef.current = null;
      setDraftThresholds(null);
      setDragFreeze(null);
      return;
    }

    if (event.phase === "move") {
      const freeze = freezeRef.current ?? baseThresholds;
      const cur = draftRef.current ?? freeze;
      const raw =
        key === "tempHigh" || key === "tempLow"
          ? unmapTempCFromSplitY(
              event.value,
              freeze.tempLow,
              freeze.tempHigh,
              layout,
            )
          : unmapHumPctFromSplitY(
              event.value,
              freeze.humidityLow,
              freeze.humidityHigh,
              layout,
            );
      if (raw == null || !Number.isFinite(raw)) return;
      const next = clampAlarmDraft({ ...cur, [key]: raw }, key);
      draftRef.current = next;
      setDraftThresholds(next);
      return;
    }

    if (event.phase === "end") {
      const next = draftRef.current;
      freezeRef.current = null;
      setDragFreeze(null);
      if (!next) {
        draftRef.current = null;
        setDraftThresholds(null);
        return;
      }
      const unchanged =
        next.tempHigh === baseThresholds.tempHigh &&
        next.tempLow === baseThresholds.tempLow &&
        next.humidityHigh === baseThresholds.humidityHigh &&
        next.humidityLow === baseThresholds.humidityLow;
      if (unchanged) {
        draftRef.current = null;
        setDraftThresholds(null);
        return;
      }
      persistAlarmDraft(next);
    }
  };

  const onScaleEdgeNumericCommit = (event: ScaleEdgeNumericCommitEvent) => {
    if (controlMode && isChartThermoEdgeId(event.id)) {
      if (!thermoDragEnabled) return;
      const cur = thermoDraftRef.current ?? baseThermo;
      let next: ChartThermoDraft = cur;
      if (event.id === CHART_THERMO_EDGE_IDS.setpoint) {
        next = {
          ...cur,
          setpointTemp: clampMenuValue("setpoint", event.value),
        };
      } else if (event.id === CHART_THERMO_EDGE_IDS.highVentTemp) {
        next = {
          ...cur,
          tempDeviation: clampMenuValue("deviation", Math.max(0, event.value)),
        };
      } else if (event.id === CHART_THERMO_EDGE_IDS.minVentPct) {
        next = clampChartVentDraft(
          {
            ...cur,
            minVentPct: clampMenuValue("minVent", event.value),
          },
          "minVentPct",
        );
      } else if (event.id === CHART_THERMO_EDGE_IDS.maxVentPct) {
        next = clampChartVentDraft(
          {
            ...cur,
            maxVentPct: clampMenuValue("maxVent", event.value),
          },
          "maxVentPct",
        );
      }
      setThermoDraft(next);
      thermoDraftRef.current = next;
      setThermoApplyError(null);
      return;
    }
    if (!canCommand || !alarmScopeKey || alarmSaving) return;
    const key = ALARM_EDGE_KEY[event.id];
    if (!key) return;
    const next = clampAlarmDraft(
      { ...(draftRef.current ?? baseThresholds), [key]: event.value },
      key,
    );
    const unchanged =
      next.tempHigh === baseThresholds.tempHigh &&
      next.tempLow === baseThresholds.tempLow &&
      next.humidityHigh === baseThresholds.humidityHigh &&
      next.humidityLow === baseThresholds.humidityLow;
    if (unchanged) return;
    draftRef.current = next;
    setDraftThresholds(next);
    setAlarmSaveError(null);
    persistAlarmDraft(next);
  };

  const enterControlMode = () => {
    if (!canCommand) return;
    setChartMode("control");
    setThermoDraft(baseThermo);
    thermoDraftRef.current = baseThermo;
    setThermoApplyError(null);
    setXScopeStack([]);
    setDraftThresholds(null);
    setDragFreeze(null);
    draftRef.current = null;
    freezeRef.current = null;
    // 환기%는 모터 밴드에 표시 — 꺼져 있으면 켠다
    setLayers((prev) => (prev.motors ? prev : { ...prev, motors: true }));
  };

  const exitControlMode = () => {
    setChartMode("view");
    setThermoDraft(null);
    thermoDraftRef.current = null;
    setThermoApplyError(null);
  };

  /** 스포트라이트 투어 — 설정모드 진입/종료 */
  useEffect(() => {
    const onTourAction = (e: Event) => {
      const action = (e as CustomEvent<{ action?: TourGridAction }>).detail
        ?.action;
      if (action !== "chart-enter-control" && action !== "chart-exit-control") {
        return;
      }
      if (action === "chart-enter-control") {
        if (canCommand) {
          setChartMode("control");
          setThermoDraft(baseThermo);
          thermoDraftRef.current = baseThermo;
          setThermoApplyError(null);
          setXScopeStack([]);
          setDraftThresholds(null);
          setDragFreeze(null);
          draftRef.current = null;
          freezeRef.current = null;
          setLayers((prev) => (prev.motors ? prev : { ...prev, motors: true }));
        }
      } else {
        setChartMode("view");
        setThermoDraft(null);
        thermoDraftRef.current = null;
        setThermoApplyError(null);
      }
      void (async () => {
        await afterFrames(2);
        dispatchTourGridActionDone(action);
      })();
    };
    window.addEventListener(FARM_TOUR_ACTION_EVENT, onTourAction);
    return () => window.removeEventListener(FARM_TOUR_ACTION_EVENT, onTourAction);
  }, [canCommand, baseThermo]);

  /** 더블클릭 — 설정모드 진입만 (종료는 빈 플롯 우클릭) */
  const enterControlModeFromPlot = () => {
    if (controlMode || !canCommand) return;
    enterControlMode();
  };

  const applyThermoDraft = useCallback(() => {
    if (!canCommand) {
      setThermoApplyError("명령 권한이 없습니다.");
      return;
    }
    if (thermoApplying) return;
    const draftValues = thermoDraftRef.current ?? thermoDraft;
    if (!draftValues) {
      setThermoApplyError("적용할 설정값이 없습니다.");
      return;
    }
    if (onlineScopedReadings.length === 0) {
      setThermoApplyError("적용할 온라인 컨트롤러가 없습니다.");
      return;
    }
    const draft = {
      applyTemp: true,
      applyVent: true,
      setpoint: draftValues.setpointTemp,
      deviation: draftValues.tempDeviation,
      minVent: draftValues.minVentPct,
      maxVent: draftValues.maxVentPct,
      selectedChannels: [...BULK_CHANNEL_OPTIONS],
    };
    const commands = buildBulkThermoCommands(
      onlineScopedReadings,
      thermoSettings,
      draft,
    );
    if (commands.length === 0) {
      setThermoApplyError("적용할 제어 대상이 없습니다.");
      return;
    }
    setThermoApplying(true);
    setThermoApplyError(null);
    void (async () => {
      try {
        const result = await sendBulkThermoCommandAction(commands);
        if (result.sentItems.length > 0) {
          for (const item of result.sentItems) {
            liveRefresh?.patchThermoFromCommand(item.command);
          }
          liveTracker.startSession(result.sentItems);
          void liveRefresh?.revalidateFarmLive();
        }
        if (!result.ok && result.sent === 0) {
          setThermoApplyError(
            result.error === "forbidden"
              ? "명령 권한이 없습니다."
              : result.error === "unauthorized"
                ? "로그인이 필요합니다."
                : result.error === "no_targets"
                  ? "적용할 제어 대상이 없습니다."
                  : "제어값 적용에 실패했습니다.",
          );
          return;
        }
        if (result.failed.length > 0 && result.sent === 0) {
          setThermoApplyError(
            result.failed[0]?.error ?? "제어값 적용에 실패했습니다.",
          );
          return;
        }
        if (result.sent > 0 && result.failed.length > 0) {
          setThermoApplyError(
            `${result.sent}대 전송 · ${result.failed.length}대 실패`,
          );
        }
        setThermoDraft(null);
        thermoDraftRef.current = null;
        setChartMode("view");
      } catch (e) {
        setThermoApplyError(
          e instanceof Error
            ? `적용 중 오류: ${e.message}`
            : "적용 중 오류가 발생했습니다. 네트워크를 확인하세요.",
        );
      } finally {
        setThermoApplying(false);
      }
    })();
  }, [
    canCommand,
    thermoApplying,
    thermoDraft,
    onlineScopedReadings,
    thermoSettings,
    liveRefresh,
    liveTracker,
  ]);

  /** 우측 Y — 밴드별 모터%/온도℃/습도% 개별 상·하한. 알람 고정 스케일. */
  const scaleEdgeLabels = useMemo((): TrendScaleEdgeLabel[] => {
    if (!built) return [];
    const out: TrendScaleEdgeLabel[] = [];
    const mapLo = mappingThresholds.tempLow;
    const mapHi = mappingThresholds.tempHigh;
    const mapHumLo = mappingThresholds.humidityLow;
    const mapHumHi = mappingThresholds.humidityHigh;
    const push = (
      id: string,
      chartY: number | null,
      text: string,
      color: string,
      mark: "overline" | "underline",
      title: string,
      showLine: boolean,
      draggable = false,
      editValue?: number,
      opts?: {
        side?: "left" | "right" | "center" | "plotStart";
        leadingText?: string;
        labelLane?: "outer" | "inner";
        lineStrokeWidth?: number;
        lineDasharray?: string;
        showApplyActions?: boolean;
        hideLabel?: boolean;
      },
    ) => {
      if (chartY == null || !Number.isFinite(chartY)) return;
      out.push({
        id,
        value: chartY,
        axis: "left",
        side: opts?.side ?? "right",
        text,
        leadingText: opts?.leadingText,
        color,
        mark,
        title,
        showLine,
        draggable,
        editValue,
        labelLane: opts?.labelLane,
        lineStrokeWidth: opts?.lineStrokeWidth,
        lineDasharray: opts?.lineDasharray,
        showApplyActions: opts?.showApplyActions,
        hideLabel: opts?.hideLabel,
      });
    };

    /** 설정모드 — 중앙 칩에 명칭+수치 (선·드래그 동일) */
    const pushThermoControl = (
      id: string,
      chartY: number | null,
      name: string,
      valueText: string,
      mark: "overline" | "underline",
      editValue: number,
      opts: {
        lineStrokeWidth: number;
        lineDasharray: string;
        showApplyActions?: boolean;
      },
    ) => {
      push(
        id,
        chartY,
        valueText,
        CHART_THERMO_CONTROL_COLOR,
        mark,
        `${name} · ${valueText}`,
        true,
        thermoDragEnabled,
        editValue,
        {
          side: "center",
          leadingText: name,
          lineStrokeWidth: opts.lineStrokeWidth,
          lineDasharray: opts.lineDasharray,
          showApplyActions: opts.showApplyActions,
        },
      );
    };

    if (scopeVisibility.showMotors && layers.motors && built.available.motors) {
      if (controlMode) {
        const minV = thermo.minVentPct;
        const maxV = thermo.maxVentPct;
        pushThermoControl(
          CHART_THERMO_EDGE_IDS.maxVentPct,
          mapMotorPctToSplitY(maxV, layout),
          "최고환기",
          `${maxV}%`,
          "overline",
          maxV,
          {
            lineStrokeWidth: 0.55,
            lineDasharray: "2 2",
          },
        );
        pushThermoControl(
          CHART_THERMO_EDGE_IDS.minVentPct,
          mapMotorPctToSplitY(minV, layout),
          "최저환기",
          `${minV}%`,
          "underline",
          minV,
          {
            lineStrokeWidth: 1.15,
            lineDasharray: "solid",
          },
        );
      } else {
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
    }
    if (scopeVisibility.showTemp && layers.temp && built.available.temp) {
      push(
        "temp-hi",
        mapTempCToSplitY(thresholds.tempHigh, mapLo, mapHi, layout),
        `${thresholds.tempHigh}℃`,
        TREND_CHART_COLORS.temp,
        "overline",
        "온도 상한(가이드)",
        true,
        alarmDragEnabled,
        thresholds.tempHigh,
        {
          leadingText: controlMode ? "온도상한" : undefined,
        },
      );
      push(
        "temp-lo",
        mapTempCToSplitY(thresholds.tempLow, mapLo, mapHi, layout),
        `${thresholds.tempLow}℃`,
        TREND_CHART_COLORS.temp,
        "underline",
        "온도 하한(가이드)",
        true,
        alarmDragEnabled,
        thresholds.tempLow,
        {
          leadingText: controlMode ? "온도하한" : undefined,
        },
      );
      if (controlMode && scopeVisibility.showTemp) {
        const sp = thermo.setpointTemp;
        const dev = thermo.tempDeviation;
        const highT = sp + dev;
        // 온도 밴드 = 기점만 / 최저·최고 환기량(%)은 모터 밴드
        pushThermoControl(
          CHART_THERMO_EDGE_IDS.highVentTemp,
          mapTempCToSplitY(highT, mapLo, mapHi, layout),
          "온도편차",
          `+${dev}℃`,
          "overline",
          dev,
          {
            lineStrokeWidth: 0.55,
            lineDasharray: "2 2",
          },
        );
        pushThermoControl(
          CHART_THERMO_EDGE_IDS.setpoint,
          mapTempCToSplitY(sp, mapLo, mapHi, layout),
          "설정온도",
          `${sp}℃`,
          "overline",
          sp,
          {
            lineStrokeWidth: 1.15,
            lineDasharray: "solid",
          },
        );
      }
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
            mapHumLo,
            mapHumHi,
            layout,
          ),
          `${thresholds.humidityHigh}%`,
          TREND_CHART_COLORS.humidity,
          "overline",
          "습도 상한(가이드)",
          true,
          alarmDragEnabled,
          thresholds.humidityHigh,
          {
            leadingText: controlMode ? "습도상한" : undefined,
          },
        );
        push(
          "hum-lo",
          mapHumPctToSplitY(
            thresholds.humidityLow,
            mapHumLo,
            mapHumHi,
            layout,
          ),
          `${thresholds.humidityLow}%`,
          TREND_CHART_COLORS.humidity,
          "underline",
          "습도 하한(가이드)",
          true,
          alarmDragEnabled,
          thresholds.humidityLow,
          {
            leadingText: controlMode ? "습도하한" : undefined,
          },
        );
      }
    }
    return out;
  }, [
    built,
    layers,
    thresholds,
    mappingThresholds,
    layout,
    scopeVisibility,
    alarmDragEnabled,
    controlMode,
    thermo,
    thermoDragEnabled,
    thermoDirty,
  ]);

  const cycleGroupLayers = (group: "temp" | "hum" | "motor") => {
    if (!built) return;
    setLayers((prev) => {
      const mode = detectLayerGroupMode(prev, built.available, group);
      const nextMode = nextLayerGroupMode(mode);
      return applyLayerGroupMode(prev, group, nextMode, built.available);
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
          "flex shrink-0 items-center overflow-visible",
          layersToolbarPhase === "enter"
            ? motionClass.farmChartLayersEnter
            : motionClass.farmChartLayersExit,
        )}
        data-farm-chart-layers-shell=""
        data-farm-chart-layers-placement="inline"
        aria-hidden={layersToolbarPhase === "exit"}
      >
        <UnifiedTrendLayerToolbar
          layers={layers}
          available={built.available}
          onCycleGroup={cycleGroupLayers}
          placement="inline"
        />
      </div>
    ) : null;

  const controlModeButton = canCommand ? (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border px-2.5 py-1.5",
        farmChartUi.fsBody,
        controlMode
          ? "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300"
          : "border-border/80 bg-card text-muted-foreground hover:bg-muted/50",
      )}
      aria-pressed={controlMode}
      aria-label={controlMode ? "설정모드 종료" : "설정모드"}
      title={controlMode ? "설정모드 종료" : "설정모드"}
      data-tour-id="chart-control-mode"
      onClick={() => {
        if (controlMode) exitControlMode();
        else enterControlMode();
      }}
    >
      <Settings
        className="size-[1em] shrink-0"
        strokeWidth={dashboardUi.iconStroke}
        aria-hidden
      />
    </button>
  ) : null;

  const controlModeCluster = canCommand ? (
    <div
      className="flex shrink-0 flex-row items-center gap-1"
      data-tour-id="chart-control-mode-cluster"
    >
      {controlMode && thermoDirty ? (
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-md border px-2.5 py-1.5",
            farmChartUi.fsBody,
            "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300",
            "hover:bg-violet-500/15 disabled:opacity-40",
          )}
          aria-label="설정값 적용"
          title="적용 (명령 전송)"
          data-tour-id="chart-control-apply"
          disabled={thermoApplying || onlineScopedReadings.length === 0}
          onClick={() => {
            if (thermoApplying || onlineScopedReadings.length === 0) return;
            applyThermoDraft();
          }}
        >
          <Check
            className="size-[1em] shrink-0"
            strokeWidth={dashboardUi.iconStroke}
            aria-hidden
          />
        </button>
      ) : controlMode ? (
        /** 설정모드·드래그 중 설정 버튼 위치 고정 */
        <span
          className={cn(
            "invisible inline-flex shrink-0 items-center justify-center rounded-md border px-2.5 py-1.5",
            farmChartUi.fsBody,
          )}
          aria-hidden
        >
          <Check
            className="size-[1em] shrink-0"
            strokeWidth={dashboardUi.iconStroke}
          />
        </span>
      ) : null}
      {controlModeButton}
    </div>
  ) : null;

  const focusBandActive = isSingleYBandFocus(xScope?.yBands)
    ? xScope.yBands[0]
    : null;

  const focusBandTint = (band: UnifiedYBandId | null | undefined) => {
    if (band === "temp") return dashboardUi.channelTintTemp;
    if (band === "hum") return dashboardUi.channelTintHum;
    if (band === "motor") return dashboardUi.channelTintMotor;
    return dashboardUi.channelTintInfo;
  };

  return (
    <div
      className={cn("mt-2 space-y-2", farmChartUi.root, className)}
      style={
        {
          ["--farm-chart-ui-scale"]: String(FARM_CHART_UI_SCALE),
        } as CSSProperties
      }
      data-tour-id="farm-chart-unified-trend"
      data-farm-chart-ui-scale={String(FARM_CHART_UI_SCALE)}
      data-farm-chart-y-bands={
        xScope?.yBands?.length ? xScope.yBands.join("+") : "all"
      }
      data-farm-chart-temp-focus={
        xScope?.yBands?.length === 1 && xScope.yBands[0] === "temp"
          ? "true"
          : "false"
      }
    >
      <div
        className={cn(
          "flex w-full flex-col items-stretch gap-1",
          "sm:flex-row sm:flex-wrap sm:items-center sm:gap-2",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col items-stretch gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          {isMobileStack ? (
            <div className="flex w-full min-w-0 flex-col gap-1">
              <div className="flex w-full min-w-0 items-center gap-2">
                <div
                  className={cn(
                    "min-w-0 flex-1 overflow-hidden",
                    "font-semibold leading-snug",
                    farmChartUi.fsTitle,
                  )}
                  title={label}
                >
                  <ChartScopeTargetMarks
                    chartScope={chartScope}
                    controllers={controllers}
                    fallbackLabel={label}
                    typeClassName={cn("font-semibold", farmChartUi.fsTitle)}
                  />
                </div>
                {mobileScopeHandle ? (
                  <button
                    type="button"
                    className={cn(
                      "inline-flex shrink-0 items-center justify-center rounded-md border px-2.5 py-1.5",
                      farmChartUi.fsBody,
                      "border-border/80 bg-card text-muted-foreground hover:bg-muted/50",
                      motionClass.microHover,
                    )}
                    data-tour-id="farm-chart-scope-handle"
                    aria-label={`집계 범위 열기 · ${label}`}
                    title={label}
                    aria-expanded={mobileScopeHandle.open}
                    onClick={mobileScopeHandle.onOpen}
                  >
                    <PanelRight className="size-[1em] shrink-0" aria-hidden />
                  </button>
                ) : null}
              </div>
              {layerToolbar || controlModeCluster ? (
                <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-1">
                  {layerToolbar}
                  {controlModeCluster}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-w-0 w-full items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
                  <span className={cn("shrink-0 font-semibold", farmChartUi.fsTitle)}>
                    통합 추이
                  </span>
                  <span
                    className={cn(
                      "leading-snug text-muted-foreground",
                      farmChartUi.fsMeta,
                    )}
                  >
                    {label} · 집계 {built?.controllerCount ?? 0}대 ·{" "}
                    {useBrushCanvas
                      ? formatBrushWindowLabel(brushWindow)
                      : trendPeriodLabel(canvasPeriod)}
                    {picked?.trimmed ? " · 실데이터 구간" : ""}
                  </span>
                </div>
              {layerToolbar || controlModeCluster ? (
                <div className="flex shrink-0 items-center gap-1">
                  {layerToolbar}
                  {controlModeCluster}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {trendExtending || window15mLoading ? (
        <p
          className={cn("text-muted-foreground", farmChartUi.fsMeta)}
          role="status"
        >
          {window15mLoading
            ? "선택한 구간을 자세히 불러오는 중."
            : "최근 이력을 이어 받는 중."}
        </p>
      ) : null}

      {built &&
      scoped &&
      picked &&
      (scoped.series.length > 0 || scoped.histograms.length > 0) ? (
        <div
          data-tour-id="chart-control-plot"
          data-chart-mode={controlMode ? "control" : "view"}
        >
        <TrendChart
          mode="line"
          onPlotWidthChange={onChartPlotWidth}
          categories={chartCategories}
          series={scoped.series}
          envelopes={scoped.envelopes}
          histograms={scoped.histograms}
          height={
            chartHeight ??
            (isMobileStack ? chartUiPx(320) : chartUiPx(340))
          }
          leftUnit={chartLeftUnit}
          leftDomain={built.leftDomain}
          period={displayPeriod}
          tickEvery={tickEveryForDisplayBars(chartCategories.length, {
            compact: isMobileStack,
          })}
          showLegend
          legendTrailing={
            xScope != null && picked ? (
              <div
                key={`scope-chip-${scopeMotionKey}`}
                className={cn(
                  "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border px-2 py-1 font-medium",
                  farmChartUi.fsMeta,
                  focusBandTint(focusBandActive),
                  motionClass.farmChartScopeChipIn,
                )}
              >
                {xScopeStack.length > 1 ? (
                  <span className="shrink-0 tabular-nums opacity-80">
                    ×{xScopeStack.length}
                  </span>
                ) : null}
                <span className="min-w-0 truncate tabular-nums">
                  {formatTrendScopeRangeLabel(
                    picked.categories[xScope.start] ?? "",
                    picked.categories[xScope.end] ?? "",
                  )}
                </span>
                <button
                  type="button"
                  aria-label="스코프 해제"
                  onClick={clearXScope}
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded border border-current/30",
                    "hover:bg-black/5 dark:hover:bg-white/10",
                    motionClass.microHover,
                  )}
                >
                  ×
                </button>
              </div>
            ) : null
          }
          legendDensity={
            isMobileStack ||
            !(
              layers.ema ||
              layers.humEma ||
              layers.dev ||
              layers.humDev ||
              layers.band ||
              layers.humBand ||
              layers.motorCh
            )
              ? "core"
              : "full"
          }
          scaleEdgeHitPx={isMobileStack ? chartUiPx(22) : chartUiPx(10)}
          labelGutter={isMobileStack}
          showMarkers
          markerDensity={displayPeriod === "24h" ? "all" : "sparse"}
          markerRadiusPx={isMobileStack ? chartUiPx(1.4) : chartUiPx(1.6)}
          animate
          layerClipWipe
          splitBandGuides={splitBandGuides}
          scaleEdgeLabels={scaleEdgeLabels}
          xScopeSelect={!controlMode}
          onXScopeCommit={
            controlMode
              ? undefined
              : (range) =>
                  commitXScope(range, activeGuidedXScope ? "replace" : "push")
          }
          guidedXScopeGesture={controlMode ? null : activeGuidedXScope}
          onGuidedXScopeComplete={
            controlMode ? undefined : onGuidedXScopeComplete
          }
          onXScopeBack={controlMode ? undefined : popXScope}
          scopeMotionKey={scopeMotionKey}
          scopeMotionDir={scopeMotionDir}
          onPlotDoubleClick={
            canCommand && !controlMode ? enterControlModeFromPlot : undefined
          }
          onPlotBackgroundContextMenu={
            controlMode ? exitControlMode : undefined
          }
          onBreachEquipmentNavigate={
            onScopeChange
              ? (target) => {
                  const next: FarmChartScope = {
                    level: "controller",
                    stallTyCode: target.stallTyCode,
                    stallNo: target.stallNo,
                    controllerKey: target.controllerKey,
                  };
                  if (scopesEqual(chartScope, next)) return;
                  onScopeChange(next);
                }
              : undefined
          }
          onScaleEdgeDrag={
            thermoDragEnabled || alarmDragEnabled
              ? onScaleEdgeDrag
              : undefined
          }
          onScaleEdgeNumericCommit={
            thermoDragEnabled || alarmDragEnabled
              ? onScaleEdgeNumericCommit
              : undefined
          }
          onScaleEdgeApply={undefined}
          onScaleEdgeRevert={undefined}
          scaleEdgeApplyBusy={false}
          scaleEdgeApplyDisabled={false}
        />
        </div>
      ) : (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {built
            ? "표시할 레이어를 선택하세요."
            : trendLoading
              ? "통합 추이를 불러오는 중."
                : trendExtending
                ? "최근 이력을 이어 받는 중."
                : window15mLoading
                  ? "선택한 구간을 자세히 불러오는 중."
                  : trendError
                    ? "통합 추이를 불러오지 못했습니다."
                    : "통합 추이 데이터가 없습니다."}
        </p>
      )}

      {alarmSaveError ? (
        <p
          className="text-[0.65rem] text-destructive"
          role="alert"
        >
          {alarmSaveError}
        </p>
      ) : null}

      {thermoApplyError ? (
        <p className="text-[0.65rem] text-destructive" role="alert">
          {thermoApplyError}
        </p>
      ) : null}

      <BulkLiveProgressBanner
        progress={liveTracker.progress}
        visible={liveTracker.bannerVisible}
        onDismiss={liveTracker.dismissBanner}
      />

      {useBrushCanvas ? (
        <UnifiedTrendPeriodBrush
          window={brushWindow}
          onWindowChange={(next) => {
            clearXScope();
            setBrushWindow(next);
          }}
          overviewValues={brushOverview}
          xScope={xScope}
          chartPointCount={picked?.categories.length ?? 0}
        />
      ) : null}
    </div>
  );
}
