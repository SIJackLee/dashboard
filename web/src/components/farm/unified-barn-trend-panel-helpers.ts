import { type BrushWindow } from "@/components/farm/unified-trend-period-brush";
import type { AlarmSettings, AlarmThresholds } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import { snapToStep } from "@/lib/controllers/controller-panel-map";
import {
  TREND_PERIODS,
  isContextControllerTrend30d,
  type TrendControllerPeriodData,
  type TrendControllerSeries,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { envComfortScore } from "@/lib/farm/env-comfort-score";
import {
  findControllerTrendSeries,
  resolveReadingAlarmThresholds,
} from "@/lib/farm/controller-summary-display";
import {
  applyUplinkCoverageToSeries,
  pickUplinkCoverageIndex,
  type UplinkCoverageIndex,
} from "@/lib/farm/trend-uplink-coverage";
import {
  downsampleByIndices,
  pickLttbIndices,
  targetChartDisplayBars,
} from "@/lib/farm/trend-display-buckets";
import {
  downsampleThermoByIndices,
  sliceChannelThermo,
} from "@/lib/farm/channel-thermo";

/**
 * UnifiedBarnTrendPanel의 순수 계산 헬퍼.
 *
 * `unified-barn-trend-panel.tsx`에서 분리(동작 보존). 시리즈 슬라이스·
 * 다운샘플·커버리지 적용·알람 드래프트 스냅 등 React 상태에 의존하지 않는
 * 순수 로직만 모은다.
 */

const TEMP_STEP = 0.1;

/** 현장 알람 구간 — 기준±편차, 투명 정상색 띠만 */
export const FARM_ALARM_RANGE_FILL = "var(--status-ok)";
export const FARM_ALARM_RANGE_FILL_OPACITY = 0.22;

export function farmAlarmMidValue(lo: number, hi: number): number | null {
  if (!(Number.isFinite(lo) && Number.isFinite(hi))) return null;
  return (lo + hi) / 2;
}

/**
 * 차트 스케일 라벨 id → 알람 상·하한.
 * `temp-hi`는 권장 띠가 없을 때. `temp-farm-hi`는 현장 알람 편차 커밋용.
 */
export const SCALE_EDGE_ALARM_KEY: Record<string, keyof AlarmThresholds> = {
  "temp-hi": "tempHigh",
  "temp-lo": "tempLow",
  "hum-hi": "humidityHigh",
  "hum-lo": "humidityLow",
  "temp-farm-hi": "tempHigh",
  "temp-farm-lo": "tempLow",
  "hum-farm-hi": "humidityHigh",
  "hum-farm-lo": "humidityLow",
};
const HUM_STEP = 1;
const TEMP_MIN = 10;
const TEMP_MAX = 35;
const HUM_MIN = 0;
const HUM_MAX = 100;

export function sliceControllerSeries(
  series: TrendControllerSeries,
  from: number,
  to: number,
): TrendControllerSeries {
  return {
    ...series,
    temp: series.temp.slice(from, to),
    humidity: series.humidity.slice(from, to),
    fanA: series.fanA.slice(from, to),
    fanB: series.fanB.slice(from, to),
    fanC: series.fanC.slice(from, to),
    fanSupply: series.fanSupply.slice(from, to),
    fanExhaust: series.fanExhaust.slice(from, to),
    fanIntake: series.fanIntake.slice(from, to),
    sampleCount: series.sampleCount.slice(from, to),
    uplinkKind: series.uplinkKind?.slice(from, to),
    thermoA: sliceChannelThermo(series.thermoA, from, to),
    thermoB: sliceChannelThermo(series.thermoB, from, to),
    thermoC: sliceChannelThermo(series.thermoC, from, to),
  };
}

export function brushSliceRange(
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

export function downsampleSeriesForChart(
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
      fanA: downsampleByIndices(s.fanA, idx),
      fanB: downsampleByIndices(s.fanB, idx),
      fanC: downsampleByIndices(s.fanC, idx),
      fanSupply: downsampleByIndices(s.fanSupply, idx),
      fanExhaust: downsampleByIndices(s.fanExhaust, idx),
      fanIntake: downsampleByIndices(s.fanIntake, idx),
      sampleCount: downsampleByIndices(s.sampleCount, idx),
      uplinkKind: s.uplinkKind
        ? downsampleByIndices(s.uplinkKind, idx)
        : undefined,
      thermoA: downsampleThermoByIndices(s.thermoA, idx),
      thermoB: downsampleThermoByIndices(s.thermoB, idx),
      thermoC: downsampleThermoByIndices(s.thermoC, idx),
    })),
  };
}

export function applyCoverageToWindow(
  seriesList: TrendControllerSeries[],
  bucketAts: string[],
  indexes: UplinkCoverageIndex[],
): TrendControllerSeries[] {
  if (!indexes.length || bucketAts.length < 1) return seriesList;
  const fromMs = Date.parse(bucketAts[0] ?? "");
  const last = Date.parse(bucketAts[bucketAts.length - 1] ?? "");
  if (!Number.isFinite(fromMs) || !Number.isFinite(last)) return seriesList;
  const strideMs =
    bucketAts.length > 1
      ? Math.max(1, (last - fromMs) / (bucketAts.length - 1))
      : TREND_PERIODS["24h"].strideMs;
  const coverage = pickUplinkCoverageIndex(indexes, fromMs, strideMs);
  if (!coverage || coverage.byController.size === 0) return seriesList;
  return seriesList.map((s) =>
    applyUplinkCoverageToSeries(s, coverage, bucketAts),
  );
}

function snapStep(n: number, step: number): number {
  return snapToStep(n, step);
}

export function clampAlarmDraft(
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

/** 30일 브러시 양호도 스파크 — 컨트롤러 실측 평균 */
export function buildTrendBrushOverview(
  controllers: { reading?: BarnReading | null }[],
  controllerTrendByPeriod:
    | Record<TrendPeriodId, TrendControllerPeriodData>
    | null
    | undefined,
  alarmSettings?: AlarmSettings,
): (number | null)[] {
  if (!isContextControllerTrend30d(controllerTrendByPeriod?.["30d"])) {
    return [];
  }
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
      scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    );
  }
  return out;
}

export type BrushOverviewMode = "comfort" | "dual";

export type SharedBrushOverview = {
  values: (number | null)[];
  /** 두 칸일 때 아래칸 양호도 */
  secondaryValues: (number | null)[] | null;
  mode: BrushOverviewMode;
};

type BrushOverviewController = { reading?: BarnReading | null };

export function pickSharedBrushOverviewKind(
  hasTop: boolean,
  hasBottom: boolean,
): "top" | "bottom" | "dual" | "farm" {
  if (hasTop && hasBottom) return "dual";
  if (hasTop) return "top";
  if (hasBottom) return "bottom";
  return "farm";
}

/** 두 시계열을 같은 길이에 맞춘다. 빈 칸은 null. */
export function alignBrushScoreSeries(
  top: (number | null)[],
  bottom: (number | null)[],
): { top: (number | null)[]; bottom: (number | null)[] } {
  const n = Math.max(top.length, bottom.length);
  return {
    top: Array.from({ length: n }, (_, i) => top[i] ?? null),
    bottom: Array.from({ length: n }, (_, i) => bottom[i] ?? null),
  };
}

/**
 * 공유 브러시 막대.
 * 한 칸 → 그 양호도. 두 칸 → 위·아래 이중 막대. 둘 다 비면 농장 평균.
 */
export function buildSharedWidgetBrushOverview(
  top: BrushOverviewController[],
  bottom: BrushOverviewController[],
  farm: BrushOverviewController[],
  controllerTrendByPeriod:
    | Record<TrendPeriodId, TrendControllerPeriodData>
    | null
    | undefined,
  alarmSettings?: AlarmSettings,
): SharedBrushOverview {
  const topLive = top.filter((c) => c.reading);
  const bottomLive = bottom.filter((c) => c.reading);
  const kind = pickSharedBrushOverviewKind(
    topLive.length > 0,
    bottomLive.length > 0,
  );
  if (kind === "dual") {
    const aligned = alignBrushScoreSeries(
      buildTrendBrushOverview(
        topLive,
        controllerTrendByPeriod,
        alarmSettings,
      ),
      buildTrendBrushOverview(
        bottomLive,
        controllerTrendByPeriod,
        alarmSettings,
      ),
    );
    return {
      mode: "dual",
      values: aligned.top,
      secondaryValues: aligned.bottom,
    };
  }
  const source =
    kind === "top" ? topLive : kind === "bottom" ? bottomLive : farm;
  return {
    mode: "comfort",
    values: buildTrendBrushOverview(
      source,
      controllerTrendByPeriod,
      alarmSettings,
    ),
    secondaryValues: null,
  };
}
