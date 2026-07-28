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

/**
 * 단일 Y — 상하 분리(정규화 없음).
 * 아래: 모터 0–100% → chart [motorLo, motorHi]
 * 위: 온℃·습% 원단위(0–100 공유) → chart [envLo, envHi]
 * 중간 gap은 구분선만.
 */
export const SPLIT_Y = {
  motorLo: 0,
  motorHi: 44,
  envLo: 56,
  envHi: 100,
  domain: [0, 100] as [number, number],
} as const;

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

function clamp01to100(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** 모터% → 하단 밴드 chart Y */
export function mapMotorPctToSplitY(pct: number | null | undefined): number | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const t = clamp01to100(pct) / 100;
  return SPLIT_Y.motorLo + t * (SPLIT_Y.motorHi - SPLIT_Y.motorLo);
}

/**
 * 온℃·습% 원단위 → 상단 밴드 chart Y.
 * 동일 0–100 절대 스케일(정규화 없음). 전형값에서 온·습은 거의 겹치지 않음.
 */
export function mapEnvAbsToSplitY(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const t = clamp01to100(value) / 100;
  return SPLIT_Y.envLo + t * (SPLIT_Y.envHi - SPLIT_Y.envLo);
}

function mapColumn(
  values: (number | null)[],
  map: (v: number | null | undefined) => number | null,
): (number | null)[] {
  return values.map((v) => map(v));
}

/** @deprecated 상하분리로 대체. 테스트·호환용 유지. */
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

/** @deprecated 상하분리로 대체. */
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
  /** 레이어 필터 전 전체 시리즈 (data=split Y 매핑값) */
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
 * 패널 내 컨트롤러 equally 평균 → 단일 Y 상하 분리.
 * 아래 모터% · 위 온·습 원단위(정규화 없음).
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

  const fanAPlot = mapColumn(fanA, mapMotorPctToSplitY);
  const fanBPlot = mapColumn(fanB, mapMotorPctToSplitY);
  const fanCPlot = mapColumn(fanC, mapMotorPctToSplitY);
  const tempPlot = mapColumn(tempAvg, mapEnvAbsToSplitY);
  const humPlot = mapColumn(humAvg, mapEnvAbsToSplitY);
  const tempMinPlot = mapColumn(tempSpread.min, mapEnvAbsToSplitY);
  const tempMaxPlot = mapColumn(tempSpread.max, mapEnvAbsToSplitY);

  const cloudHigh = tempPlot.map((t, i) => {
    const h = humPlot[i];
    if (t == null && h == null) return null;
    if (t == null) return h;
    if (h == null) return t;
    return Math.max(t, h);
  });
  const cloudLow = tempPlot.map((t, i) => {
    const h = humPlot[i];
    if (t == null && h == null) return null;
    if (t == null) return h;
    if (h == null) return t;
    return Math.min(t, h);
  });

  const tempRangeLabel = formatTempAlarmRange(thresholds);
  const humidityRangeLabel = formatHumidityAlarmRange(thresholds);

  const seriesByKey: Partial<Record<UnifiedSeriesKey, TrendSeries>> = {};
  if (hasFinite(fanAPlot)) {
    seriesByKey.A = {
      name: "A",
      data: fanAPlot,
      color: TREND_CHART_COLORS.fanIntake,
      axis: "left",
      hoverSecondary: fanA,
      hoverSecondaryUnit: "%",
    };
  }
  if (hasFinite(fanBPlot)) {
    seriesByKey.B = {
      name: "B",
      data: fanBPlot,
      color: TREND_CHART_COLORS.fanExhaust,
      axis: "left",
      hoverSecondary: fanB,
      hoverSecondaryUnit: "%",
    };
  }
  if (hasFinite(fanCPlot)) {
    seriesByKey.C = {
      name: "C",
      data: fanCPlot,
      color: TREND_CHART_COLORS.fanSupply,
      axis: "left",
      hoverSecondary: fanC,
      hoverSecondaryUnit: "%",
    };
  }
  if (hasFinite(tempPlot)) {
    seriesByKey.temp = {
      name: `온도 (${tempRangeLabel})`,
      data: tempPlot,
      color: TREND_CHART_COLORS.temp,
      axis: "left",
      strokeDasharray: "5 3",
      hoverSecondary: tempAvg,
      hoverSecondaryUnit: "℃",
    };
  }
  if (hasFinite(humPlot)) {
    seriesByKey.hum = {
      name: `습도 (${humidityRangeLabel})`,
      data: humPlot,
      color: TREND_CHART_COLORS.humidity,
      axis: "left",
      strokeDasharray: "2 2",
      hoverSecondary: humAvg,
      hoverSecondaryUnit: "%",
    };
  }

  if (!Object.keys(seriesByKey).length) return null;

  const envelopesBand =
    hasFinite(tempMinPlot) && hasFinite(tempMaxPlot)
      ? {
          high: tempMaxPlot,
          low: tempMinPlot,
          axis: "left" as const,
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
          axis: "left" as const,
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
    leftDomain: [...SPLIT_Y.domain],
    rightDomain: [...SPLIT_Y.domain],
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
