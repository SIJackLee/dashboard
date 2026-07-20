import type { TrendReferenceLine, TrendSeries } from "@/components/trends/trend-chart";
import {
  DEFAULT_ALARM_THRESHOLDS,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import type { TrendStallSeries } from "@/lib/data/farm-trend-types";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import {
  type Band,
  fanBand,
  humidityBand,
  statBand,
  tempBand,
} from "@/lib/farm/severity-score";

/** 온도 추이 Y축 — 알람 구간과 동일 (기간 전환 시 스케일 고정). */
export function tempTrendLeftDomain(
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): [number, number] {
  return [thresholds.tempLow, thresholds.tempHigh];
}

export function tempTrendReferenceLines(
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): TrendReferenceLine[] {
  return [
    {
      value: thresholds.tempLow,
      axis: "left",
      color: "#d97706",
      label: `${thresholds.tempLow}℃`,
    },
    {
      value: thresholds.tempHigh,
      axis: "left",
      color: "#d97706",
      label: `${thresholds.tempHigh}℃`,
    },
  ];
}

export function humidityTrendReferenceLines(
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS,
  axis: "left" | "right" = "left"
): TrendReferenceLine[] {
  return [
    {
      value: thresholds.humidityLow,
      axis,
      color: "#d97706",
      label: `${thresholds.humidityLow}%`,
    },
    {
      value: thresholds.humidityHigh,
      axis,
      color: "#d97706",
      label: `${thresholds.humidityHigh}%`,
    },
  ];
}

/** 복합 환경 차트(온도 left + 습도 right)용 알람 점선. */
export function envTrendReferenceLines(
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): TrendReferenceLine[] {
  return [
    ...tempTrendReferenceLines(thresholds),
    ...humidityTrendReferenceLines(thresholds, "right"),
  ];
}

export const TREND_CHART_COLORS = {
  temp: "#ef4444",
  humidity: "#0ea5e9",
  fanSupply: "#10b981",
  fanExhaust: "#8b5cf6",
  fanIntake: "#f59e0b",
} as const;

/** 히트맵/스몰멀티플 지표 id(T/H/A/B/C) → 목록 그래프와 동일한 선 색. */
export const METRIC_ID_COLORS: Record<string, string> = {
  T: TREND_CHART_COLORS.temp,
  H: TREND_CHART_COLORS.humidity,
  A: TREND_CHART_COLORS.fanIntake,
  B: TREND_CHART_COLORS.fanExhaust,
  C: TREND_CHART_COLORS.fanSupply,
};

type StallMetrics = Pick<
  TrendStallSeries,
  "temp" | "humidity" | "fanSupply" | "fanExhaust" | "fanIntake"
>;

export function humidityTrendLeftDomain(
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): [number, number] {
  return [thresholds.humidityLow, thresholds.humidityHigh];
}

export function fanTrendReferenceLines(
  band: Band,
  axis: "left" | "right" = "left"
): TrendReferenceLine[] {
  return [
    {
      value: band.lo,
      axis,
      color: "#d97706",
      label: `${band.lo}%`,
    },
    {
      value: band.hi,
      axis,
      color: "#d97706",
      label: `${band.hi}%`,
    },
  ];
}

/** 온도 시리즈 — 알람 band + severity 마커. */
export function tempTrendSeries(
  m: Pick<TrendStallSeries, "temp">,
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): TrendSeries {
  return {
    name: "온도",
    data: m.temp,
    color: TREND_CHART_COLORS.temp,
    axis: "left",
    band: tempBand(thresholds),
  };
}

/** 습도 시리즈 — 알람 band + severity 마커. */
export function humidityTrendSeries(
  m: Pick<TrendStallSeries, "humidity">,
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): TrendSeries {
  return {
    name: "습도",
    data: m.humidity,
    color: TREND_CHART_COLORS.humidity,
    axis: "left",
    band: humidityBand(thresholds),
  };
}

export function envTrendSeries(m: StallMetrics): TrendSeries[] {
  return [
    { name: "온도", data: m.temp, color: TREND_CHART_COLORS.temp, axis: "left" },
    {
      name: "습도",
      data: m.humidity,
      color: TREND_CHART_COLORS.humidity,
      axis: "right",
    },
  ];
}

const CHANNEL_SLOT_META: Record<
  ChannelSlot,
  { field: keyof Pick<TrendStallSeries, "fanIntake" | "fanExhaust" | "fanSupply">; color: string; label: string }
> = {
  A: { field: "fanIntake", color: TREND_CHART_COLORS.fanIntake, label: "채널 A" },
  B: { field: "fanExhaust", color: TREND_CHART_COLORS.fanExhaust, label: "채널 B" },
  C: { field: "fanSupply", color: TREND_CHART_COLORS.fanSupply, label: "채널 C" },
};

export function channelFanTrendSeries(
  m: StallMetrics,
  thermoByChannel:
    | Partial<
        Record<
          ChannelSlot,
          Pick<ControllerThermoSettings, "minVentPct" | "maxVentPct"> | null
        >
      >
    | null = null
): TrendSeries[] {
  return (["A", "B", "C"] as const).map((slot) => {
    const meta = CHANNEL_SLOT_META[slot];
    const data = m[meta.field];
    const thermo = thermoByChannel?.[slot] ?? null;
    const band = fanBand(thermo) ?? statBand(data);
    return {
      name: meta.label,
      data,
      color: meta.color,
      band: band ?? undefined,
    };
  });
}

/** 모터 pill / 채널 스트rip — 단일 채널 line trend. */
export function channelSlotTrendSeries(
  m: StallMetrics,
  slot: ChannelSlot,
  thermo: Pick<ControllerThermoSettings, "minVentPct" | "maxVentPct"> | null = null
): TrendSeries {
  const meta = CHANNEL_SLOT_META[slot];
  const data = m[meta.field];
  const band = fanBand(thermo) ?? statBand(data);
  return {
    name: meta.label,
    data,
    color: meta.color,
    band: band ?? undefined,
  };
}

export function humidityOnlyTrendSeries(
  m: Pick<TrendStallSeries, "humidity">,
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): TrendSeries {
  return humidityTrendSeries(m, thresholds);
}

export function stallTrendHasData(stall: TrendStallSeries | null): boolean {
  if (!stall) return false;
  const cols = [
    ...stall.temp,
    ...stall.humidity,
    ...stall.fanSupply,
    ...stall.fanExhaust,
    ...stall.fanIntake,
  ];
  return cols.some((v) => v != null && Number.isFinite(v));
}
