import type { TrendSeries } from "@/components/trends/trend-chart";
import type { TrendStallSeries } from "@/lib/data/farm-trend-types";

export const TREND_CHART_COLORS = {
  temp: "#ef4444",
  humidity: "#0ea5e9",
  fanSupply: "#10b981",
  fanExhaust: "#8b5cf6",
  fanIntake: "#f59e0b",
} as const;

type StallMetrics = Pick<
  TrendStallSeries,
  "temp" | "humidity" | "fanSupply" | "fanExhaust" | "fanIntake"
>;

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

export function channelFanTrendSeries(m: StallMetrics): TrendSeries[] {
  return [
    { name: "채널 A", data: m.fanIntake, color: TREND_CHART_COLORS.fanIntake },
    { name: "채널 B", data: m.fanExhaust, color: TREND_CHART_COLORS.fanExhaust },
    { name: "채널 C", data: m.fanSupply, color: TREND_CHART_COLORS.fanSupply },
  ];
}

export function fanTrendSeries(m: StallMetrics): TrendSeries[] {
  return [
    { name: "송풍", data: m.fanSupply, color: TREND_CHART_COLORS.fanSupply },
    { name: "배기", data: m.fanExhaust, color: TREND_CHART_COLORS.fanExhaust },
    { name: "입기", data: m.fanIntake, color: TREND_CHART_COLORS.fanIntake },
  ];
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
