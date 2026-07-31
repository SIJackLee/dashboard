"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TrendChart,
  type ScaleEdgeDragEvent,
  type ScaleEdgeNumericCommitEvent,
  type TrendScaleEdgeLabel,
} from "@/components/trends/trend-chart";
import { UnifiedTrendPeriodBrush } from "@/components/farm/unified-trend-period-brush";
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
  mergeScopeThreshold,
  resolveThresholdsForScope,
} from "@/lib/data/alarm-scope";
import type { AlarmSettings, AlarmThresholds } from "@/lib/data/alarms";
import {
  DEFAULT_ALARM_SETTINGS,
  DEFAULT_ALARM_THRESHOLDS,
  validateAlarmThresholds,
} from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import {
  findControllerTrendSeries,
  formatControllerHeaderPrimary,
  formatControllerHeaderSecondary,
  resolveReadingAlarmThresholds,
  resolveReadingThermo,
} from "@/lib/farm/controller-summary-display";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import {
  alarmScopeKeyFromFarmChartScope,
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
  unmapHumPctFromSplitY,
  unmapMotorPctFromSplitY,
  unmapTempCFromSplitY,
  type UnifiedLayerFlags,
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
import { useFarmLiveRefreshOptional } from "@/lib/navigation/farm-live-refresh";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionDuration } from "@/lib/ui/motion-tokens";
import { cn } from "@/lib/utils";

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
  /** 조회 전용(뷰어)이면 알람·제어 편집 비활성 */
  canCommand?: boolean;
  isMobileStack?: boolean;
  /** 미지정 시 모바일 220 / 데스크톱 340 */
  chartHeight?: number;
  /** 차트 탭 활성 시에만 TopBar 레이어 툴바 표시 */
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
  thermoSettings = {},
  chartScope,
  onScopeChange,
  canCommand = false,
  isMobileStack = false,
  chartHeight,
  layersToolbarActive = true,
  className,
}: Props) {
  const liveRefresh = useFarmLiveRefreshOptional();
  const [layers, setLayers] = useState<UnifiedLayerFlags>(DEFAULT_UNIFIED_LAYERS);
  /** TopBar 슬롯 observe · 없으면 인라인 폴백 */
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
        const series = findControllerTrendSeries(
          controllerTrendByPeriod,
          period,
          r.stallTyCode,
          r.stallNo,
          r.controllerKey,
        );
        if (!series) return null;
        return {
          ...series,
          zoneLabel: formatControllerHeaderPrimary(r),
          equipmentLabel: formatControllerHeaderSecondary(r),
          stallTyCode: r.stallTyCode
            ? normalizeStallTyCode(r.stallTyCode)
            : undefined,
        };
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
      mappingThresholds,
    );
  }, [controllers, controllerTrendByPeriod, period, mappingThresholds]);

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

  const alarmDragEnabled =
    canCommand &&
    Boolean(alarmScopeKey) &&
    !alarmSaving &&
    chartMode === "view";
  const thermoDragEnabled =
    canCommand && controlMode && !thermoApplying;

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
    const nextSettings = mergeScopeThreshold(
      previous,
      alarmScopeKey,
      nextDraft,
    );
    setAlarmSaving(true);
    setAlarmSaveError(null);
    const formData = new FormData();
    formData.set("settings_json", JSON.stringify(nextSettings));
    void (async () => {
      try {
        const result = await saveAlarmSettingsInlineAction(formData);
        if (!result.ok) {
          setAlarmSaveError(result.error ?? "알람값 저장에 실패했습니다.");
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
    if (controlMode) {
      if (!thermoDragEnabled && event.phase !== "cancel") return;
      if (!isChartThermoEdgeId(event.id)) return;
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
    if (controlMode) {
      if (!thermoDragEnabled || !isChartThermoEdgeId(event.id)) return;
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
    liveTracker.startSession,
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
        labelLane?: "outer" | "inner";
        lineStrokeWidth?: number;
        lineDasharray?: string;
        showApplyActions?: boolean;
      },
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
        draggable,
        editValue,
        labelLane: opts?.labelLane,
        lineStrokeWidth: opts?.lineStrokeWidth,
        lineDasharray: opts?.lineDasharray,
        showApplyActions: opts?.showApplyActions,
      });
    };

    if (scopeVisibility.showMotors && layers.motors && built.available.motors) {
      if (controlMode) {
        const minV = thermo.minVentPct;
        const maxV = thermo.maxVentPct;
        push(
          CHART_THERMO_EDGE_IDS.maxVentPct,
          mapMotorPctToSplitY(maxV, layout),
          `${maxV}%`,
          CHART_THERMO_CONTROL_COLOR,
          "overline",
          "최고환기량",
          true,
          thermoDragEnabled,
          maxV,
          {
            labelLane: "inner",
            lineStrokeWidth: 0.55,
            lineDasharray: "2 2",
          },
        );
        push(
          CHART_THERMO_EDGE_IDS.minVentPct,
          mapMotorPctToSplitY(minV, layout),
          `${minV}%`,
          CHART_THERMO_CONTROL_COLOR,
          "underline",
          "최저환기량",
          true,
          thermoDragEnabled,
          minV,
          {
            labelLane: "inner",
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
        "온도 상한(알람)",
        true,
        alarmDragEnabled,
        thresholds.tempHigh,
      );
      push(
        "temp-lo",
        mapTempCToSplitY(thresholds.tempLow, mapLo, mapHi, layout),
        `${thresholds.tempLow}℃`,
        TREND_CHART_COLORS.temp,
        "underline",
        "온도 하한(알람)",
        true,
        alarmDragEnabled,
        thresholds.tempLow,
      );
      if (controlMode && scopeVisibility.showTemp) {
        const sp = thermo.setpointTemp;
        const dev = thermo.tempDeviation;
        const highT = sp + dev;
        // 온도 밴드 = 기점만 / 최저·최고 환기량(%)은 모터 밴드
        push(
          CHART_THERMO_EDGE_IDS.highVentTemp,
          mapTempCToSplitY(highT, mapLo, mapHi, layout),
          `+${dev}℃`,
          CHART_THERMO_CONTROL_COLOR,
          "overline",
          "온도편차 (설정+편차)",
          true,
          thermoDragEnabled,
          dev,
          {
            labelLane: "inner",
            lineStrokeWidth: 0.55,
            lineDasharray: "2 2",
          },
        );
        push(
          CHART_THERMO_EDGE_IDS.setpoint,
          mapTempCToSplitY(sp, mapLo, mapHi, layout),
          `${sp}℃`,
          CHART_THERMO_CONTROL_COLOR,
          "overline",
          "설정온도",
          true,
          thermoDragEnabled,
          sp,
          {
            labelLane: "inner",
            lineStrokeWidth: 1.15,
            lineDasharray: "solid",
            showApplyActions: thermoDirty,
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
          "습도 상한(알람)",
          true,
          alarmDragEnabled,
          thresholds.humidityHigh,
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
          "습도 하한(알람)",
          true,
          alarmDragEnabled,
          thresholds.humidityLow,
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
          "flex min-w-0 items-center overflow-visible",
          layersSlot
            ? "p-0"
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
          onCycleGroup={cycleGroupLayers}
          placement={layersSlot ? "hub" : "inline"}
        />
      </div>
    ) : null;

  return (
    <div
      className={cn("mt-2 space-y-2", className)}
      data-tour-id="farm-chart-unified-trend"
    >
      {layerToolbar && layersSlot
        ? createPortal(layerToolbar, layersSlot)
        : null}

      <div
        className={cn(
          "flex w-full flex-col items-stretch gap-1",
          "sm:flex-row sm:flex-wrap sm:items-center sm:gap-2",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xs font-semibold">통합 추이</span>
            <span className="text-[0.7rem] leading-snug text-muted-foreground">
              {label} · 집계 {built?.controllerCount ?? 0}대 ·{" "}
              {trendPeriodLabel(period)}
              {picked?.trimmed ? " · 실데이터 구간" : ""}
            </span>
          </div>
          {layerToolbar && !layersSlot ? layerToolbar : null}
          {xScope != null && picked ? (
            <div
              key={`scope-chip-${scopeMotionKey}`}
              className={cn(
                "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-50/80 px-2 py-1 text-[0.65rem] font-medium text-sky-900 dark:bg-sky-950/50 dark:text-sky-100",
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
                title="한 단계 뒤로"
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
        {canCommand ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto">
            <button
              type="button"
              className={cn(
                "rounded-md border px-2.5 py-1 text-[0.7rem] font-medium",
                controlMode
                  ? "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/50",
              )}
              aria-pressed={controlMode}
              onClick={() => {
                if (controlMode) exitControlMode();
                else enterControlMode();
              }}
            >
              {controlMode ? "설정모드 종료" : "설정모드"}
            </button>
            {controlMode ? (
              <span className="text-[0.65rem] text-muted-foreground">
                보라선=설정온도(최저환기)·설정+편차(최고환기) · 체크=명령 전송
              </span>
            ) : null}
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
          xScopeSelect={!controlMode}
          onXScopeCommit={controlMode ? undefined : commitXScope}
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
            controlMode
              ? thermoDragEnabled
                ? onScaleEdgeDrag
                : undefined
              : canCommand && alarmScopeKey
                ? onScaleEdgeDrag
                : undefined
          }
          onScaleEdgeNumericCommit={
            controlMode
              ? thermoDragEnabled
                ? onScaleEdgeNumericCommit
                : undefined
              : canCommand && alarmScopeKey
                ? onScaleEdgeNumericCommit
                : undefined
          }
          onScaleEdgeApply={
            controlMode && thermoDirty ? applyThermoDraft : undefined
          }
          onScaleEdgeRevert={
            controlMode && thermoDirty
              ? () => {
                  setThermoDraft(baseThermo);
                  thermoDraftRef.current = baseThermo;
                }
              : undefined
          }
          scaleEdgeApplyBusy={thermoApplying}
          scaleEdgeApplyDisabled={onlineScopedReadings.length === 0}
        />
      ) : (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {built
            ? "표시할 레이어를 선택하세요."
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
        <>
          <p className="hidden text-[0.65rem] leading-snug text-muted-foreground lg:block">
            드래그=시간 줌 · 우측 알람 숫자 드래그/우클릭=임계값 · 걸친 밴드만 표시 ·
            한 밴드=확대 · 빈 곳 우클릭/Esc=뒤로 · ×=전체 해제
          </p>
          <p className="text-[0.65rem] leading-snug text-muted-foreground lg:hidden">
            차트 드래그=구간 줌 · 우측 알람 숫자 드래그·우클릭=임계값 · 한 밴드만
            걸치면 확대 · 뒤로/×=해제
          </p>
        </>
      ) : null}
    </div>
  );
}
