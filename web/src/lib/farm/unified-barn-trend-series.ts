import type { TrendSeries } from "@/components/trends/trend-chart";
import type { AlarmThresholds } from "@/lib/data/alarms";
import type { TrendControllerSeries } from "@/lib/data/farm-trend-types";
import { TREND_CHART_COLORS } from "@/lib/farm/trend-chart-series";
import {
  formatHumidityAlarmRange,
  formatTempAlarmRange,
} from "@/lib/farm/controller-summary-display";

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

function hasFinite(data: (number | null)[]): boolean {
  return data.some((v) => v != null && Number.isFinite(v));
}

export type UnifiedBarnTrendBuild = {
  categories: string[];
  series: TrendSeries[];
  leftDomain: [number, number];
  rightDomain: [number, number];
  controllerCount: number;
  tempRangeLabel: string;
  humidityRangeLabel: string;
};

/**
 * 패널 내 컨트롤러 equally 평균 → 좌축 모터% · 우축 온·습 알람 정규화 n.
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

  const tempN = tempAvg.map((v) =>
    normalizeToAlarmRange(v, thresholds.tempLow, thresholds.tempHigh),
  );
  const humN = humAvg.map((v) =>
    normalizeToAlarmRange(v, thresholds.humidityLow, thresholds.humidityHigh),
  );

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
    });
  }
  if (hasFinite(humN)) {
    series.push({
      name: `습도 n (${humidityRangeLabel})`,
      data: humN,
      color: TREND_CHART_COLORS.humidity,
      axis: "right",
    });
  }

  if (!series.length) return null;

  return {
    categories,
    series,
    leftDomain: [0, 100],
    rightDomain: [0, 100],
    controllerCount: controllerSeriesList.length,
    tempRangeLabel,
    humidityRangeLabel,
  };
}
