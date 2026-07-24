import type { TrendPeriodId } from "@/lib/data/farm-trend-types";
import { computeBinnedMetricValues } from "@/lib/farm/stack-metric";

/**
 * 그리드·sheet 공용 표시 막대 수.
 * 원본은 TREND_PERIODS(더 세밀) → 히트맵 색은 binWorst, 값/라인은 구간 평균.
 * 24h=1시간(15m×4), 7d=6시간(1h×6), 30d=1일(1h×24).
 */
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

/** compact/TrendChart — 약 5개 tick (7d·30d 라벨 겹침 방지). */
export function tickEveryForDisplayBars(count: number): number {
  if (count <= 5) return 1;
  return Math.max(1, Math.ceil(count / 5));
}

/**
 * X축 tick 표시용 축약.
 * categories는 풀 라벨(호버/툴팁용)을 유지하고, tick만 양끝=풀 · 중간=축약.
 *
 * - 24h 풀 `HH:mm` → 중간 `HH`
 * - 7d 풀 `M/D HH` → 중간 `M/D`
 * - 30d 풀 `M/D` → 중간 `D`
 */
export function abbreviateTrendAxisLabel(
  period: TrendPeriodId,
  fullLabel: string,
  opts: { endpoint: boolean },
): string {
  if (opts.endpoint || !fullLabel) return fullLabel;

  if (period === "24h") {
    const m = fullLabel.match(/^(\d{1,2}):\d{2}$/);
    return m ? m[1]! : fullLabel;
  }
  if (period === "7d") {
    const m = fullLabel.match(/^(\d{1,2}\/\d{1,2})\s+\d{1,2}$/);
    return m ? m[1]! : fullLabel;
  }
  // 30d — `M/D` → 일만
  const m = fullLabel.match(/^\d{1,2}\/(\d{1,2})$/);
  return m ? m[1]! : fullLabel;
}

