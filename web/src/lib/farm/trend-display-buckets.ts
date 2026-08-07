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

/** 풀 라벨 `M/D` · `M/D HH` 파싱 (호버용 categories 형식). */
export function parseTrendAxisMdLabel(
  fullLabel: string,
): { month: number; day: number } | null {
  const m = fullLabel.match(/^(\d{1,2})\/(\d{1,2})(?:\s+\d{1,2})?$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { month, day };
}

/**
 * X축 tick 표시용 축약.
 * categories는 풀 라벨(호버/툴팁용)을 유지하고, tick만 축약.
 *
 * - 24h: 양끝 풀 `HH:mm` · 중간 `HH`
 * - 7d/30d: 월이 바뀌는 틱(또는 1일) → `N월`, 그 외 → 일 숫자만.
 *   구간 첫 틱이 월 중이면 `M/D`로 월 맥락 유지.
 */
export function abbreviateTrendAxisLabel(
  period: TrendPeriodId,
  fullLabel: string,
  opts: { endpoint: boolean; prevLabel?: string | null },
): string {
  if (!fullLabel) return fullLabel;

  if (period === "24h") {
    if (opts.endpoint) return fullLabel;
    const m = fullLabel.match(/^(\d{1,2}):\d{2}$/);
    return m ? m[1]! : fullLabel;
  }

  const cur = parseTrendAxisMdLabel(fullLabel);
  if (!cur) return fullLabel;

  const prev = opts.prevLabel ? parseTrendAxisMdLabel(opts.prevLabel) : null;
  const monthChanged = !prev || prev.month !== cur.month;

  if (monthChanged) {
    // 1일·월 경계 → 월만. 첫 틱이 월 중이면 M/D로 맥락 유지.
    if (!prev && cur.day !== 1) return `${cur.month}/${cur.day}`;
    return `${cur.month}월`;
  }
  return String(cur.day);
}

/** 구간 줌 칩 — `8/3 ~ 5` (같은 달이면 끝쪽 월 생략). 24h는 `HH:mm ~ HH:mm`. */
export function formatTrendScopeRangeLabel(
  startLabel: string,
  endLabel: string,
): string {
  const start = startLabel.trim();
  const end = endLabel.trim();
  if (!start && !end) return "…";
  if (!start) return end;
  if (!end) return start;

  if (/^\d{1,2}:\d{2}$/.test(start) && /^\d{1,2}:\d{2}$/.test(end)) {
    return `${start} ~ ${end}`;
  }

  const a = parseTrendAxisMdLabel(start);
  const b = parseTrendAxisMdLabel(end);
  if (!a || !b) return `${start} ~ ${end}`;

  const startHour = start.match(/\s+(\d{1,2})$/)?.[1];
  const endHour = end.match(/\s+(\d{1,2})$/)?.[1];
  const left = startHour
    ? `${a.month}/${a.day} ${startHour}`
    : `${a.month}/${a.day}`;
  const right =
    a.month === b.month
      ? endHour
        ? `${b.day} ${endHour}`
        : String(b.day)
      : endHour
        ? `${b.month}/${b.day} ${endHour}`
        : `${b.month}/${b.day}`;
  return `${left} ~ ${right}`;
}

