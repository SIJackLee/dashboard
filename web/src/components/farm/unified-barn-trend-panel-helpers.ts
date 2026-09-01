import { type BrushWindow } from "@/components/farm/unified-trend-period-brush";
import type { AlarmThresholds } from "@/lib/data/alarms";
import {
  TREND_PERIODS,
  type TrendControllerSeries,
} from "@/lib/data/farm-trend-types";
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

/**
 * UnifiedBarnTrendPanel의 순수 계산 헬퍼.
 *
 * `unified-barn-trend-panel.tsx`에서 분리(동작 보존). 시리즈 슬라이스·
 * 다운샘플·커버리지 적용·알람 드래프트 스냅 등 React 상태에 의존하지 않는
 * 순수 로직만 모은다.
 */

const TEMP_STEP = 0.5;
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
    fanSupply: series.fanSupply.slice(from, to),
    fanExhaust: series.fanExhaust.slice(from, to),
    fanIntake: series.fanIntake.slice(from, to),
    sampleCount: series.sampleCount.slice(from, to),
    uplinkKind: series.uplinkKind?.slice(from, to),
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
      fanSupply: downsampleByIndices(s.fanSupply, idx),
      fanExhaust: downsampleByIndices(s.fanExhaust, idx),
      fanIntake: downsampleByIndices(s.fanIntake, idx),
      sampleCount: downsampleByIndices(s.sampleCount, idx),
      uplinkKind: s.uplinkKind
        ? downsampleByIndices(s.uplinkKind, idx)
        : undefined,
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
  return Math.round(n / step) * step;
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
