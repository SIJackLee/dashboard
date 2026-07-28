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

export type UnifiedLayerId =
  | "motors"
  | "temp"
  | "hum"
  | "band"
  | "cloud";

export type UnifiedLayerFlags = Record<UnifiedLayerId, boolean>;

export const DEFAULT_UNIFIED_LAYERS: UnifiedLayerFlags = {
  motors: true,
  temp: true,
  hum: true,
  band: true,
  cloud: true,
};

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

/** n∈[0,100] → 원단위 (호버 복원). */
export function denormalizeFromAlarmRange(
  n: number | null | undefined,
  lo: number,
  hi: number,
): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (!(hi > lo)) return null;
  return lo + (n / 100) * (hi - lo);
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

export type UnifiedSeriesKey = "A" | "B" | "C" | "temp" | "hum";

export type UnifiedBarnTrendBuild = {
  categories: string[];
  /** 레이어 필터 전 전체 시리즈 */
  seriesByKey: Partial<Record<UnifiedSeriesKey, TrendSeries>>;
  envelopesBand: TrendEnvelope | null;
  envelopesCloud: TrendEnvelope | null;
  leftDomain: [number, number];
  rightDomain: [number, number];
  controllerCount: number;
  tempRangeLabel: string;
  humidityRangeLabel: string;
  thresholds: AlarmThresholds;
  available: {
    motors: boolean;
    temp: boolean;
    hum: boolean;
    band: boolean;
    cloud: boolean;
  };
};

/**
 * 패널 내 컨트롤러 equally 평균 → 좌축 모터% · 우축 온·습 알람 정규화 n.
 * 캔버스 최종안: 실선 A/B/C · 점선 온·습 · teal 클라우드 · 온도 산포.
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

  const seriesByKey: Partial<Record<UnifiedSeriesKey, TrendSeries>> = {};
  if (hasFinite(fanA)) {
    seriesByKey.A = {
      name: "A",
      data: fanA,
      color: TREND_CHART_COLORS.fanIntake,
      axis: "left",
    };
  }
  if (hasFinite(fanB)) {
    seriesByKey.B = {
      name: "B",
      data: fanB,
      color: TREND_CHART_COLORS.fanExhaust,
      axis: "left",
    };
  }
  if (hasFinite(fanC)) {
    seriesByKey.C = {
      name: "C",
      data: fanC,
      color: TREND_CHART_COLORS.fanSupply,
      axis: "left",
    };
  }
  if (hasFinite(tempN)) {
    seriesByKey.temp = {
      name: `온도 n (${tempRangeLabel})`,
      data: tempN,
      color: TREND_CHART_COLORS.temp,
      axis: "right",
      strokeDasharray: "5 3",
      hoverSecondary: tempAvg,
      hoverSecondaryUnit: "℃",
    };
  }
  if (hasFinite(humN)) {
    seriesByKey.hum = {
      name: `습도 n (${humidityRangeLabel})`,
      data: humN,
      color: TREND_CHART_COLORS.humidity,
      axis: "right",
      strokeDasharray: "2 2",
      hoverSecondary: humAvg,
      hoverSecondaryUnit: "%",
    };
  }

  if (!Object.keys(seriesByKey).length) return null;

  const envelopesBand =
    hasFinite(tempMinN) && hasFinite(tempMaxN)
      ? {
          high: tempMaxN,
          low: tempMinN,
          axis: "right" as const,
          fill: UNIFIED_TEMP_BAND_FILL,
          fillOpacity: 0.12,
          legendLabel: "온도 산포",
        }
      : null;

  const envelopesCloud =
    hasFinite(cloudHigh) && hasFinite(cloudLow)
      ? {
          high: cloudHigh,
          low: cloudLow,
          axis: "right" as const,
          fill: UNIFIED_CLOUD_FILL,
          fillOpacity: 0.22,
          legendLabel: "클라우드",
        }
      : null;

  const hasMotors = Boolean(seriesByKey.A || seriesByKey.B || seriesByKey.C);

  return {
    categories,
    seriesByKey,
    envelopesBand,
    envelopesCloud,
    leftDomain: [0, 100],
    rightDomain: [0, 100],
    controllerCount: controllerSeriesList.length,
    tempRangeLabel,
    humidityRangeLabel,
    thresholds,
    available: {
      motors: hasMotors,
      temp: Boolean(seriesByKey.temp),
      hum: Boolean(seriesByKey.hum),
      band: Boolean(envelopesBand),
      cloud: Boolean(envelopesCloud),
    },
  };
}

/** 레이어 플래그에 맞춰 TrendChart props 조각 생성. */
export function pickUnifiedTrendLayers(
  built: UnifiedBarnTrendBuild,
  layers: UnifiedLayerFlags,
): { series: TrendSeries[]; envelopes: TrendEnvelope[] } {
  const series: TrendSeries[] = [];
  if (layers.motors) {
    for (const k of ["A", "B", "C"] as const) {
      const s = built.seriesByKey[k];
      if (s) series.push(s);
    }
  }
  if (layers.temp && built.seriesByKey.temp) series.push(built.seriesByKey.temp);
  if (layers.hum && built.seriesByKey.hum) series.push(built.seriesByKey.hum);

  const envelopes: TrendEnvelope[] = [];
  if (layers.band && built.envelopesBand) envelopes.push(built.envelopesBand);
  if (layers.cloud && layers.temp && layers.hum && built.envelopesCloud) {
    envelopes.push(built.envelopesCloud);
  }

  return { series, envelopes };
}
