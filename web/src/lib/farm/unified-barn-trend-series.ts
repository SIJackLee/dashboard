import type {
  TrendEnvelope,
  TrendSeries,
} from "@/components/trends/trend-chart";
import type { AlarmThresholds } from "@/lib/data/alarms";
import type { TrendControllerSeries } from "@/lib/data/farm-trend-types";
import { TREND_CHART_COLORS } from "@/lib/farm/trend-chart-series";
import {
  formatHumidityAlarmRange,
  formatTempAlarmRange,
} from "@/lib/farm/controller-summary-display";

/** 캔버스 이목 클라우드 추천색 */
export const UNIFIED_CLOUD_FILL = "#14b8a6";
export const UNIFIED_TEMP_BAND_FILL = "#ef4444";

function avgFinite(nums: (number | null | undefined)[]): number | null {
  let sum = 0;
  let n = 0;
  for (const v of nums) {
    if (v != null && Number.isFinite(v)) {
      sum += v;
      n += 1;
    }
  }
  return n ? sum / n : null;
}

/** 알람 [lo,hi] → 0–100 정규화 (구간 밖 clamp). */
export function normalizeToAlarmRange(
  value: number | null | undefined,
  lo: number,
  hi: number,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (!(hi > lo)) return 50;
  const n = ((value - lo) / (hi - lo)) * 100;
  return Math.max(0, Math.min(100, n));
}

function avgColumns(
  seriesList: TrendControllerSeries[],
  pick: (c: TrendControllerSeries) => (number | null)[],
  len: number,
): (number | null)[] {
  const out = new Array<number | null>(len).fill(null);
  for (let i = 0; i < len; i++) {
    const slot: number[] = [];
    for (const c of seriesList) {
      const v = pick(c)[i];
      if (v != null && Number.isFinite(v)) slot.push(v);
    }
    out[i] = avgFinite(slot);
  }
  return out;
}

function minMaxColumns(
  seriesList: TrendControllerSeries[],
  pick: (c: TrendControllerSeries) => (number | null)[],
  len: number,
): { min: (number | null)[]; max: (number | null)[] } {
  const min = new Array<number | null>(len).fill(null);
  const max = new Array<number | null>(len).fill(null);
  for (let i = 0; i < len; i++) {
    const slot: number[] = [];
    for (const c of seriesList) {
      const v = pick(c)[i];
      if (v != null && Number.isFinite(v)) slot.push(v);
    }
    if (slot.length) {
      min[i] = Math.min(...slot);
      max[i] = Math.max(...slot);
    }
  }
  return { min, max };
}

function hasFinite(data: (number | null)[]): boolean {
  return data.some((v) => v != null && Number.isFinite(v));
}

export type UnifiedBarnTrendBuild = {
  categories: string[];
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  leftDomain: [number, number];
  rightDomain: [number, number];
  controllerCount: number;
  tempRangeLabel: string;
  humidityRangeLabel: string;
};

/**
 * 패널 내 컨트롤러 equally 평균 → 좌축 모터% · 우축 온·습 알람 정규화 n.
 * 캔버스: 실선 A/B/C · 점선 온도 · 점선 습도 · teal 클라우드 · 온도 산포 밴드.
 */
export function buildUnifiedBarnTrendSeries(
  controllerSeriesList: TrendControllerSeries[],
  categories: string[],
  thresholds: AlarmThresholds,
): UnifiedBarnTrendBuild | null {
  const len = categories.length;
  if (!len || !controllerSeriesList.length) return null;

  const fanA = avgColumns(controllerSeriesList, (c) => c.fanIntake, len);
  const fanB = avgColumns(controllerSeriesList, (c) => c.fanExhaust, len);
  const fanC = avgColumns(controllerSeriesList, (c) => c.fanSupply, len);
  const tempAvg = avgColumns(controllerSeriesList, (c) => c.temp, len);
  const humAvg = avgColumns(controllerSeriesList, (c) => c.humidity, len);
  const tempSpread = minMaxColumns(
    controllerSeriesList,
    (c) => c.temp,
    len,
  );

  const tempN = tempAvg.map((v) =>
    normalizeToAlarmRange(v, thresholds.tempLow, thresholds.tempHigh),
  );
  const humN = humAvg.map((v) =>
    normalizeToAlarmRange(v, thresholds.humidityLow, thresholds.humidityHigh),
  );
  const tempMinN = tempSpread.min.map((v) =>
    normalizeToAlarmRange(v, thresholds.tempLow, thresholds.tempHigh),
  );
  const tempMaxN = tempSpread.max.map((v) =>
    normalizeToAlarmRange(v, thresholds.tempLow, thresholds.tempHigh),
  );

  const cloudHigh = tempN.map((t, i) => {
    const h = humN[i];
    if (t == null && h == null) return null;
    if (t == null) return h;
    if (h == null) return t;
    return Math.max(t, h);
  });
  const cloudLow = tempN.map((t, i) => {
    const h = humN[i];
    if (t == null && h == null) return null;
    if (t == null) return h;
    if (h == null) return t;
    return Math.min(t, h);
  });

  const tempRangeLabel = formatTempAlarmRange(thresholds);
  const humidityRangeLabel = formatHumidityAlarmRange(thresholds);

  const series: TrendSeries[] = [];
  if (hasFinite(fanA)) {
    series.push({
      name: "A",
      data: fanA,
      color: TREND_CHART_COLORS.fanIntake,
      axis: "left",
    });
  }
  if (hasFinite(fanB)) {
    series.push({
      name: "B",
      data: fanB,
      color: TREND_CHART_COLORS.fanExhaust,
      axis: "left",
    });
  }
  if (hasFinite(fanC)) {
    series.push({
      name: "C",
      data: fanC,
      color: TREND_CHART_COLORS.fanSupply,
      axis: "left",
    });
  }
  if (hasFinite(tempN)) {
    series.push({
      name: `온도 n (${tempRangeLabel})`,
      data: tempN,
      color: TREND_CHART_COLORS.temp,
      axis: "right",
      strokeDasharray: "5 3",
    });
  }
  if (hasFinite(humN)) {
    series.push({
      name: `습도 n (${humidityRangeLabel})`,
      data: humN,
      color: TREND_CHART_COLORS.humidity,
      axis: "right",
      strokeDasharray: "2 2",
    });
  }

  if (!series.length) return null;

  const envelopes: TrendEnvelope[] = [];
  if (hasFinite(tempMinN) && hasFinite(tempMaxN)) {
    envelopes.push({
      high: tempMaxN,
      low: tempMinN,
      axis: "right",
      fill: UNIFIED_TEMP_BAND_FILL,
      fillOpacity: 0.12,
      legendLabel: "온도 산포",
    });
  }
  if (hasFinite(cloudHigh) && hasFinite(cloudLow)) {
    envelopes.push({
      high: cloudHigh,
      low: cloudLow,
      axis: "right",
      fill: UNIFIED_CLOUD_FILL,
      fillOpacity: 0.22,
      legendLabel: "클라우드",
    });
  }

  return {
    categories,
    series,
    envelopes,
    leftDomain: [0, 100],
    rightDomain: [0, 100],
    controllerCount: controllerSeriesList.length,
    tempRangeLabel,
    humidityRangeLabel,
  };
}
