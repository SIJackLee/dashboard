import type {
  TrendEnvelope,
  TrendHistogram,
  TrendSeries,
} from "@/components/trends/trend-chart";
import type { AlarmThresholds } from "@/lib/data/alarms";
import type { TrendControllerSeries } from "@/lib/data/farm-trend-types";
import { TREND_CHART_COLORS } from "@/lib/farm/trend-chart-series";
import {
  formatHumidityAlarmRange,
  formatTempAlarmRange,
} from "@/lib/farm/controller-summary-display";

export const UNIFIED_TEMP_BAND_FILL = "#ef4444";
/** 온도 밴드 오버레이 편차 — 온도감 유지, 본선(#ef4444)과 구분 */
export const DEV_HIST_COLOR_UP = "#fb923c";
export const DEV_HIST_COLOR_DOWN = "#fb7185";
/** EMA 추세선 (온도) */
export const EMA_SHORT_COLOR = "#fca5a5";
export const EMA_LONG_COLOR = "#b91c1c";

export const UNIFIED_HUM_BAND_FILL = "#0ea5e9";
/** 습도 편차 — 본선(#0ea5e9)과 구분 */
export const HUM_DEV_HIST_COLOR_UP = "#38bdf8";
export const HUM_DEV_HIST_COLOR_DOWN = "#818cf8";
export const HUM_EMA_SHORT_COLOR = "#7dd3fc";
export const HUM_EMA_LONG_COLOR = "#0284c7";

export type SplitYLayout = {
  motorLo: number;
  motorHi: number;
  humLo: number;
  humHi: number;
  tempLo: number;
  tempHi: number;
  domain: [number, number];
};

/** 습도 ON — 모터 ~20% · 습도 ~30% · 온도 ~50% */
export const SPLIT_Y_WITH_HUM: SplitYLayout = {
  motorLo: 0,
  motorHi: 20,
  humLo: 20,
  humHi: 50,
  tempLo: 50,
  tempHi: 100,
  domain: [0, 100],
};

/** 습도 OFF — 온도가 습도 자리를 회수 (~80%) */
export const SPLIT_Y_TEMP_EXPANDED: SplitYLayout = {
  motorLo: 0,
  motorHi: 20,
  humLo: 20,
  humHi: 20,
  tempLo: 20,
  tempHi: 100,
  domain: [0, 100],
};

/** @deprecated 습도 포함 레이아웃 별칭 */
export const SPLIT_Y = SPLIT_Y_WITH_HUM;

export function resolveSplitYLayout(showHum: boolean): SplitYLayout {
  return showHum ? SPLIT_Y_WITH_HUM : SPLIT_Y_TEMP_EXPANDED;
}

/** 알람 lo–hi 대비 상·하 여유 비율 */
export const ALARM_PAD_RATIO = 0.2;

export type UnifiedLayerId =
  | "motors"
  | "motorCh"
  | "temp"
  | "hum"
  | "band"
  | "dev"
  | "ema"
  | "humBand"
  | "humDev"
  | "humEma";

export type UnifiedLayerFlags = Record<UnifiedLayerId, boolean>;

/** 기본: 온도·습도 본선 + 모터(max). 편차 등은 하위 메뉴에서 */
export const DEFAULT_UNIFIED_LAYERS: UnifiedLayerFlags = {
  motors: true,
  motorCh: false,
  temp: true,
  hum: true,
  band: false,
  dev: true,
  ema: false,
  humBand: false,
  humDev: false,
  humEma: false,
};

/** 습도 밴드가 필요한지 (본선·편차·산포·EMA) */
export function needsHumidityBand(layers: UnifiedLayerFlags): boolean {
  return layers.hum || layers.humDev || layers.humBand || layers.humEma;
}

export type UnifiedBuildOptions = {
  /** 습도 레이어 ON 여부 — OFF면 온도 밴드 확장 */
  showHum?: boolean;
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

/** 알람 상·하한 ± pad → 값 도메인 */
export function paddedAlarmDomain(lo: number, hi: number): [number, number] {
  const span = Math.max(hi - lo, 1e-6);
  const pad = span * ALARM_PAD_RATIO;
  return [lo - pad, hi + pad];
}

function mapToValueBand(
  value: number | null | undefined,
  valueLo: number,
  valueHi: number,
  bandLo: number,
  bandHi: number,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (!(valueHi > valueLo) || !(bandHi > bandLo)) return (bandLo + bandHi) / 2;
  const t = (value - valueLo) / (valueHi - valueLo);
  const clamped = Math.max(0, Math.min(1, t));
  return bandLo + clamped * (bandHi - bandLo);
}

/** 모터% → 모터 밴드 */
export function mapMotorPctToSplitY(
  pct: number | null | undefined,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
): number | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const t = Math.max(0, Math.min(100, pct)) / 100;
  return layout.motorLo + t * (layout.motorHi - layout.motorLo);
}

/** 습도% → 습도 밴드 (알람±여유) */
export function mapHumPctToSplitY(
  value: number | null | undefined,
  humidityLow: number,
  humidityHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
): number | null {
  const [vlo, vhi] = paddedAlarmDomain(humidityLow, humidityHigh);
  return mapToValueBand(value, vlo, vhi, layout.humLo, layout.humHi);
}

/** 온도℃ → 주패널 밴드 (알람±여유) */
export function mapTempCToSplitY(
  value: number | null | undefined,
  tempLow: number,
  tempHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
): number | null {
  const [vlo, vhi] = paddedAlarmDomain(tempLow, tempHigh);
  return mapToValueBand(value, vlo, vhi, layout.tempLo, layout.tempHi);
}

/**
 * 온도 편차(℃) → 온도 주패널에 오버레이.
 * 중점+편차를 온도 스케일로 매핑 (자연스러운 위치).
 */
export function mapTempDeviationToSplitY(
  deviationC: number | null | undefined,
  tempLow: number,
  tempHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
): number | null {
  if (deviationC == null || !Number.isFinite(deviationC)) return null;
  const mid = tempAlarmMidpoint(tempLow, tempHigh);
  return mapTempCToSplitY(mid + deviationC, tempLow, tempHigh, layout);
}

/**
 * 습도 편차(%p) → 습도 밴드에 오버레이.
 */
export function mapHumDeviationToSplitY(
  deviationPct: number | null | undefined,
  humidityLow: number,
  humidityHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
): number | null {
  if (deviationPct == null || !Number.isFinite(deviationPct)) return null;
  const mid = humidityAlarmMidpoint(humidityLow, humidityHigh);
  return mapHumPctToSplitY(mid + deviationPct, humidityLow, humidityHigh, layout);
}

/** 알람 중점 (편차 0) */
export function tempAlarmMidpoint(tempLow: number, tempHigh: number): number {
  return (tempLow + tempHigh) / 2;
}

export function humidityAlarmMidpoint(
  humidityLow: number,
  humidityHigh: number,
): number {
  return (humidityLow + humidityHigh) / 2;
}

/** 단순 EMA — null은 건너뛰고 직전 상태 유지하지 않음(갭 반영). */
export function computeEmaSeries(
  values: (number | null)[],
  period: number,
): (number | null)[] {
  const out = new Array<number | null>(values.length).fill(null);
  if (period < 1) return out;
  const k = 2 / (period + 1);
  let ema: number | null = null;
  let seedSum = 0;
  let seedN = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) {
      out[i] = null;
      continue;
    }
    if (ema == null) {
      seedSum += v;
      seedN += 1;
      if (seedN >= period) {
        ema = seedSum / seedN;
        out[i] = ema;
      } else {
        out[i] = null;
      }
      continue;
    }
    ema = v * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

/** @deprecated */
export function mapEnvAbsToSplitY(
  value: number | null | undefined,
  tempLow = 10,
  tempHigh = 35,
): number | null {
  return mapTempCToSplitY(value, tempLow, tempHigh);
}

function mapColumn(
  values: (number | null)[],
  map: (v: number | null | undefined) => number | null,
): (number | null)[] {
  return values.map((v) => map(v));
}

/** @deprecated */
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

/** @deprecated */
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

export type UnifiedSeriesKey =
  | "temp"
  | "hum"
  | "emaShort"
  | "emaLong"
  | "humEmaShort"
  | "humEmaLong";

export type UnifiedBarnTrendBuild = {
  categories: string[];
  seriesByKey: Partial<Record<UnifiedSeriesKey, TrendSeries>>;
  envelopesBand: TrendEnvelope | null;
  envelopesHumBand: TrendEnvelope | null;
  histogramDev: TrendHistogram | null;
  histogramHumDev: TrendHistogram | null;
  /** 모터 max(A,B,C) 단일 바 */
  histogramMotorsMax: TrendHistogram[];
  /** 모터 A·B·C 채널 바 */
  histogramMotorsChannels: TrendHistogram[];
  layout: SplitYLayout;
  leftDomain: [number, number];
  rightDomain: [number, number];
  controllerCount: number;
  tempRangeLabel: string;
  humidityRangeLabel: string;
  thresholds: AlarmThresholds;
  available: {
    motors: boolean;
    motorCh: boolean;
    temp: boolean;
    hum: boolean;
    band: boolean;
    dev: boolean;
    ema: boolean;
    humBand: boolean;
    humDev: boolean;
    humEma: boolean;
  };
};

/**
 * 패널 내 컨트롤러 equally 평균 → split Y.
 */
export function buildUnifiedBarnTrendSeries(
  controllerSeriesList: TrendControllerSeries[],
  categories: string[],
  thresholds: AlarmThresholds,
  options: UnifiedBuildOptions = {},
): UnifiedBarnTrendBuild | null {
  const len = categories.length;
  if (!len || !controllerSeriesList.length) return null;

  const showHum = options.showHum ?? false;
  const layout = resolveSplitYLayout(showHum);
  const { tempLow, tempHigh, humidityLow, humidityHigh } = thresholds;
  const tempMid = tempAlarmMidpoint(tempLow, tempHigh);
  const humMid = humidityAlarmMidpoint(humidityLow, humidityHigh);
  const tempAlarmHalfSpan = Math.max((tempHigh - tempLow) / 2, 1e-6);
  const humAlarmHalfSpan = Math.max((humidityHigh - humidityLow) / 2, 1e-6);

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
  const humSpread = minMaxColumns(
    controllerSeriesList,
    (c) => c.humidity,
    len,
  );

  const mapTemp = (v: number | null | undefined) =>
    mapTempCToSplitY(v, tempLow, tempHigh, layout);
  const mapHum = (v: number | null | undefined) =>
    mapHumPctToSplitY(v, humidityLow, humidityHigh, layout);
  const mapMotor = (v: number | null | undefined) =>
    mapMotorPctToSplitY(v, layout);

  const tempPlot = mapColumn(tempAvg, mapTemp);
  const humPlot = mapColumn(humAvg, mapHum);
  const tempMinPlot = mapColumn(tempSpread.min, mapTemp);
  const tempMaxPlot = mapColumn(tempSpread.max, mapTemp);
  const humMinPlot = mapColumn(humSpread.min, mapHum);
  const humMaxPlot = mapColumn(humSpread.max, mapHum);

  const emaShortPeriod = 5;
  const emaLongPeriod = 14;
  const emaShortRaw = computeEmaSeries(tempAvg, emaShortPeriod);
  const emaLongRaw = computeEmaSeries(tempAvg, emaLongPeriod);
  const emaShortPlot = mapColumn(emaShortRaw, mapTemp);
  const emaLongPlot = mapColumn(emaLongRaw, mapTemp);
  const humEmaShortRaw = computeEmaSeries(humAvg, emaShortPeriod);
  const humEmaLongRaw = computeEmaSeries(humAvg, emaLongPeriod);
  const humEmaShortPlot = mapColumn(humEmaShortRaw, mapHum);
  const humEmaLongPlot = mapColumn(humEmaLongRaw, mapHum);

  const tempDevRaw = tempAvg.map((t) =>
    t == null || !Number.isFinite(t) ? null : t - tempMid,
  );
  /** 미소 편차는 숨겨 면 채움처럼 보이지 않게 */
  const DEV_HIDE_ABS_C = 0.3;
  const HUM_DEV_HIDE_ABS = 0.5;
  const tempDevPlot = mapColumn(tempDevRaw, (d) => {
    if (d == null || !Number.isFinite(d) || Math.abs(d) < DEV_HIDE_ABS_C) {
      return null;
    }
    return mapTempDeviationToSplitY(d, tempLow, tempHigh, layout);
  });
  const tempMidPlot = mapTempCToSplitY(tempMid, tempLow, tempHigh, layout);
  /** 알람 밖(|편차| > 반폭) → 더 진하게, 안은 아주 옅게 */
  const tempDevOpacity = tempDevRaw.map((d) => {
    if (d == null || !Number.isFinite(d) || Math.abs(d) < DEV_HIDE_ABS_C) {
      return null;
    }
    return Math.abs(d) > tempAlarmHalfSpan ? 0.32 : 0.1;
  });

  const humDevRaw = humAvg.map((h) =>
    h == null || !Number.isFinite(h) ? null : h - humMid,
  );
  const humDevPlot = mapColumn(humDevRaw, (d) => {
    if (d == null || !Number.isFinite(d) || Math.abs(d) < HUM_DEV_HIDE_ABS) {
      return null;
    }
    return mapHumDeviationToSplitY(d, humidityLow, humidityHigh, layout);
  });
  const humMidPlot = mapHumPctToSplitY(humMid, humidityLow, humidityHigh, layout);
  const humDevOpacity = humDevRaw.map((d) => {
    if (d == null || !Number.isFinite(d) || Math.abs(d) < HUM_DEV_HIDE_ABS) {
      return null;
    }
    return Math.abs(d) > humAlarmHalfSpan ? 0.32 : 0.1;
  });

  const tempRangeLabel = formatTempAlarmRange(thresholds);
  const humidityRangeLabel = formatHumidityAlarmRange(thresholds);

  const seriesByKey: Partial<Record<UnifiedSeriesKey, TrendSeries>> = {};
  if (hasFinite(tempPlot)) {
    seriesByKey.temp = {
      name: "온도",
      data: tempPlot,
      color: TREND_CHART_COLORS.temp,
      axis: "left",
      hoverSecondary: tempAvg,
      hoverSecondaryUnit: "℃",
    };
  }
  if (hasFinite(humPlot)) {
    seriesByKey.hum = {
      name: "습도",
      data: humPlot,
      color: TREND_CHART_COLORS.humidity,
      axis: "left",
      hoverSecondary: humAvg,
      hoverSecondaryUnit: "%",
    };
  }
  if (hasFinite(emaShortPlot)) {
    seriesByKey.emaShort = {
      name: `온도EMA${emaShortPeriod}`,
      data: emaShortPlot,
      color: EMA_SHORT_COLOR,
      axis: "left",
      strokeDasharray: "4 3",
      hoverSecondary: emaShortRaw,
      hoverSecondaryUnit: "℃",
    };
  }
  if (hasFinite(emaLongPlot)) {
    seriesByKey.emaLong = {
      name: `온도EMA${emaLongPeriod}`,
      data: emaLongPlot,
      color: EMA_LONG_COLOR,
      axis: "left",
      strokeDasharray: "6 4",
      hoverSecondary: emaLongRaw,
      hoverSecondaryUnit: "℃",
    };
  }
  if (hasFinite(humEmaShortPlot)) {
    seriesByKey.humEmaShort = {
      name: `습도EMA${emaShortPeriod}`,
      data: humEmaShortPlot,
      color: HUM_EMA_SHORT_COLOR,
      axis: "left",
      strokeDasharray: "4 3",
      hoverSecondary: humEmaShortRaw,
      hoverSecondaryUnit: "%",
    };
  }
  if (hasFinite(humEmaLongPlot)) {
    seriesByKey.humEmaLong = {
      name: `습도EMA${emaLongPeriod}`,
      data: humEmaLongPlot,
      color: HUM_EMA_LONG_COLOR,
      axis: "left",
      strokeDasharray: "6 4",
      hoverSecondary: humEmaLongRaw,
      hoverSecondaryUnit: "%",
    };
  }

  const fanAPlot = mapColumn(fanA, mapMotor);
  const fanBPlot = mapColumn(fanB, mapMotor);
  const fanCPlot = mapColumn(fanC, mapMotor);

  const fanMaxRaw: (number | null)[] = new Array(len).fill(null);
  for (let i = 0; i < len; i++) {
    const slot: number[] = [];
    for (const v of [fanA[i], fanB[i], fanC[i]]) {
      if (v != null && Number.isFinite(v)) slot.push(v);
    }
    fanMaxRaw[i] = slot.length ? Math.max(...slot) : null;
  }
  const fanMaxPlot = mapColumn(fanMaxRaw, mapMotor);

  const histogramMotorsMax: TrendHistogram[] = hasFinite(fanMaxPlot)
    ? [
        {
          values: fanMaxPlot,
          baseline: layout.motorLo,
          colorUp: TREND_CHART_COLORS.fanIntake,
          colorDown: TREND_CHART_COLORS.fanIntake,
          style: "volume" as const,
          legendLabel: "모터",
          hoverSecondary: fanMaxRaw,
          hoverSecondaryUnit: "%",
        },
      ]
    : [];

  const motorDefs = [
    {
      plot: fanAPlot,
      raw: fanA,
      color: TREND_CHART_COLORS.fanIntake,
      label: "A",
    },
    {
      plot: fanBPlot,
      raw: fanB,
      color: TREND_CHART_COLORS.fanExhaust,
      label: "B",
    },
    {
      plot: fanCPlot,
      raw: fanC,
      color: TREND_CHART_COLORS.fanSupply,
      label: "C",
    },
  ].filter((m) => hasFinite(m.plot));

  const histogramMotorsChannels: TrendHistogram[] = motorDefs.map((m, i) => ({
    values: m.plot,
    baseline: layout.motorLo,
    colorUp: m.color,
    colorDown: m.color,
    style: "volume" as const,
    groupIndex: i,
    groupSize: motorDefs.length,
    legendLabel: m.label,
    hoverSecondary: m.raw,
    hoverSecondaryUnit: "%",
  }));

  const hasMotors =
    histogramMotorsMax.length > 0 || histogramMotorsChannels.length > 0;

  if (
    !Object.keys(seriesByKey).length &&
    !hasFinite(tempDevPlot) &&
    !hasFinite(humDevPlot) &&
    !hasMotors
  ) {
    return null;
  }

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

  const envelopesHumBand =
    hasFinite(humMinPlot) && hasFinite(humMaxPlot)
      ? {
          high: humMaxPlot,
          low: humMinPlot,
          axis: "left" as const,
          fill: UNIFIED_HUM_BAND_FILL,
          fillOpacity: 0.14,
          legendLabel: "습도 산포",
        }
      : null;

  const histogramDev =
    hasFinite(tempDevPlot) && tempMidPlot != null
      ? {
          values: tempDevPlot,
          baseline: tempMidPlot,
          colorUp: DEV_HIST_COLOR_UP,
          colorDown: DEV_HIST_COLOR_DOWN,
          style: "overlay" as const,
          fillOpacity: 0.14,
          fillOpacityValues: tempDevOpacity,
          legendLabel: "온도 편차",
          hoverSecondary: tempDevRaw,
          hoverSecondaryUnit: "℃",
          hoverFormat: "midpointDelta" as const,
        }
      : null;

  const histogramHumDev =
    hasFinite(humDevPlot) && humMidPlot != null
      ? {
          values: humDevPlot,
          baseline: humMidPlot,
          colorUp: HUM_DEV_HIST_COLOR_UP,
          colorDown: HUM_DEV_HIST_COLOR_DOWN,
          style: "overlay" as const,
          fillOpacity: 0.14,
          fillOpacityValues: humDevOpacity,
          legendLabel: "습도 편차",
          hoverSecondary: humDevRaw,
          hoverSecondaryUnit: "%",
          hoverFormat: "midpointDelta" as const,
        }
      : null;

  return {
    categories,
    seriesByKey,
    envelopesBand,
    envelopesHumBand,
    histogramDev,
    histogramHumDev,
    histogramMotorsMax,
    histogramMotorsChannels,
    layout,
    leftDomain: [...layout.domain],
    rightDomain: [...layout.domain],
    controllerCount: controllerSeriesList.length,
    tempRangeLabel,
    humidityRangeLabel,
    thresholds,
    available: {
      motors: hasMotors,
      motorCh: histogramMotorsChannels.length > 0,
      temp: Boolean(seriesByKey.temp),
      hum: Boolean(seriesByKey.hum),
      band: Boolean(envelopesBand),
      dev: Boolean(histogramDev),
      ema: Boolean(seriesByKey.emaShort || seriesByKey.emaLong),
      humBand: Boolean(envelopesHumBand),
      humDev: Boolean(histogramHumDev),
      humEma: Boolean(seriesByKey.humEmaShort || seriesByKey.humEmaLong),
    },
  };
}

export function pickUnifiedTrendLayers(
  built: UnifiedBarnTrendBuild,
  layers: UnifiedLayerFlags,
): {
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
} {
  const series: TrendSeries[] = [];
  if (layers.temp && built.seriesByKey.temp) series.push(built.seriesByKey.temp);
  if (layers.ema) {
    if (built.seriesByKey.emaShort) series.push(built.seriesByKey.emaShort);
    if (built.seriesByKey.emaLong) series.push(built.seriesByKey.emaLong);
  }
  if (layers.hum && built.seriesByKey.hum) series.push(built.seriesByKey.hum);
  if (layers.humEma) {
    if (built.seriesByKey.humEmaShort) series.push(built.seriesByKey.humEmaShort);
    if (built.seriesByKey.humEmaLong) series.push(built.seriesByKey.humEmaLong);
  }

  const envelopes: TrendEnvelope[] = [];
  if (layers.band && built.envelopesBand) envelopes.push(built.envelopesBand);
  if (layers.humBand && built.envelopesHumBand) {
    envelopes.push(built.envelopesHumBand);
  }

  const histograms: TrendHistogram[] = [];
  if (layers.dev && built.histogramDev) histograms.push(built.histogramDev);
  if (layers.humDev && built.histogramHumDev) {
    histograms.push(built.histogramHumDev);
  }
  if (layers.motors) {
    if (layers.motorCh && built.histogramMotorsChannels.length) {
      histograms.push(...built.histogramMotorsChannels);
    } else {
      histograms.push(...built.histogramMotorsMax);
    }
  }

  return { series, envelopes, histograms };
}

/** 유한값이 있는 첫·끝 인덱스 */
export function findFiniteIndexSpan(
  columns: ((number | null)[] | undefined | null)[],
): { start: number; end: number } | null {
  let start = -1;
  let end = -1;
  for (const col of columns) {
    if (!col?.length) continue;
    for (let i = 0; i < col.length; i++) {
      const v = col[i];
      if (v != null && Number.isFinite(v)) {
        if (start < 0 || i < start) start = i;
        if (i > end) end = i;
      }
    }
  }
  if (start < 0 || end < start) return null;
  return { start, end };
}

/**
 * 선두·후미 결측을 잘라 실데이터 구간에 맞춤 (좌우 소량 패딩).
 */
export function trimPickedUnifiedTrend(
  categories: string[],
  picked: {
    series: TrendSeries[];
    envelopes: TrendEnvelope[];
    histograms: TrendHistogram[];
  },
): {
  categories: string[];
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
  trimmed: boolean;
} {
  const n = categories.length;
  if (n < 4) {
    return { categories, ...picked, trimmed: false };
  }

  const span = findFiniteIndexSpan([
    ...picked.series.map((s) => s.data),
    ...picked.series.map((s) => s.hoverSecondary),
    ...picked.envelopes.flatMap((e) => [e.high, e.low]),
    ...picked.histograms.map((h) => h.values),
    ...picked.histograms.map((h) => h.hoverSecondary),
  ]);
  if (!span) {
    return { categories, ...picked, trimmed: false };
  }

  const pad = Math.max(1, Math.min(4, Math.round(n * 0.03)));
  const start = Math.max(0, span.start - pad);
  const end = Math.min(n - 1, span.end + pad);
  if (start <= 0 && end >= n - 1) {
    return { categories, ...picked, trimmed: false };
  }

  const sliceCol = <T,>(arr: (T | null)[] | undefined): (T | null)[] | undefined =>
    arr ? arr.slice(start, end + 1) : arr;

  return {
    categories: categories.slice(start, end + 1),
    series: picked.series.map((s) => ({
      ...s,
      data: s.data.slice(start, end + 1),
      hoverSecondary: sliceCol(s.hoverSecondary),
    })),
    envelopes: picked.envelopes.map((e) => ({
      ...e,
      high: e.high.slice(start, end + 1),
      low: e.low.slice(start, end + 1),
    })),
    histograms: picked.histograms.map((h) => ({
      ...h,
      values: h.values.slice(start, end + 1),
      hoverSecondary: sliceCol(h.hoverSecondary),
      fillOpacityValues: sliceCol(h.fillOpacityValues),
    })),
    trimmed: true,
  };
}
