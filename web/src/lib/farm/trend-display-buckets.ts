import type { TrendPeriodId } from "@/lib/data/farm-trend-types";
import { computeBinnedMetricValues } from "@/lib/farm/stack-metric";

/** 그리드·sheet 공용 표시 막대 수 — 24h=1시간, 7d=6시간, 30d=1일. */
export const GRAPH_BARS: Record<TrendPeriodId, number> = {
  "24h": 24,
  "7d": 28,
  "30d": 30,
};

/** 표시 구간의 대표 라벨(구간 시작 bucket). */
export function binTrendCategories(categories: string[], bars: number): string[] {
  const n = categories.length;
  if (!bars || bars >= n) return categories.slice();
  const g = Math.ceil(n / bars);
  const out: string[] = [];
  for (let i = 0; i < n; i += g) {
    out.push(categories[i] ?? "");
  }
  return out;
}

export function downsampleTrendValues(
  values: (number | null)[],
  bars: number,
): (number | null)[] {
  return computeBinnedMetricValues(values, bars);
}

/** 원본 RPC 버킷 → GRAPH_BARS 표시 해상도(평균 집계). */
export function downsampleTrendAxis(
  categories: string[],
  dataColumns: (number | null)[][],
  period: TrendPeriodId,
): { categories: string[]; columns: (number | null)[][] } {
  const bars = GRAPH_BARS[period];
  return {
    categories: binTrendCategories(categories, bars),
    columns: dataColumns.map((col) => downsampleTrendValues(col, bars)),
  };
}

/** compact line chart — 약 6개 tick. */
export function tickEveryForDisplayBars(count: number): number {
  if (count <= 6) return 1;
  return Math.max(1, Math.ceil(count / 6));
}
