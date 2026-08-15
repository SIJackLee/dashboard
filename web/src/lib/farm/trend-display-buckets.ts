import type { TrendPeriodId } from "@/lib/data/farm-trend-types";
import { computeBinnedMetricValues } from "@/lib/farm/stack-metric";

/**
 * 그리드·sheet 공용 표시 막대 수.
 * 원본은 TREND_PERIODS(더 세밀) → 히트맵 색은 binWorst, 값/라인은 구간 평균.
 * 24h=1시간(15m×4), 7d=6시간(15m×24), 30d=1일(15m×96).
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

/** 차트 표시 점 — 약 2.5px당 1점. 소스보다 늘리지 않음. */
export const CHART_PX_PER_POINT = 2.5;

export function targetChartDisplayBars(
  sourceLen: number,
  plotWidthPx = 800,
): number {
  if (sourceLen <= 1) return Math.max(0, sourceLen);
  const width = Number.isFinite(plotWidthPx) && plotWidthPx > 32 ? plotWidthPx : 800;
  const byPixel = Math.max(32, Math.floor(width / CHART_PX_PER_POINT));
  return Math.min(sourceLen, byPixel);
}

function lttbY(v: number | null | undefined): number {
  return v != null && Number.isFinite(v) ? v : 0;
}

/** LTTB — 첫·끝점 고정, 피크를 남기는 인덱스. */
export function pickLttbIndices(
  values: (number | null)[],
  target: number,
): number[] {
  const n = values.length;
  if (n <= 0) return [];
  if (target >= n || n <= 2) {
    return Array.from({ length: n }, (_, i) => i);
  }
  const threshold = Math.max(2, Math.min(target, n));
  if (threshold === 2) return [0, n - 1];

  const sampled: number[] = [0];
  const bucketSize = (n - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);
    const avgLen = Math.max(1, avgRangeEnd - avgRangeStart);
    let avgX = 0;
    let avgY = 0;
    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += j;
      avgY += lttbY(values[j]);
    }
    avgX /= avgLen;
    avgY /= avgLen;

    const rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.floor((i + 1) * bucketSize) + 1;
    const ax = a;
    const ay = lttbY(values[a]);
    let maxArea = -1;
    let nextA = rangeOffs;
    for (let j = rangeOffs; j < rangeTo && j < n - 1; j++) {
      const area = Math.abs(
        (ax - avgX) * (lttbY(values[j]) - ay) - (ax - j) * (avgY - ay),
      );
      if (area > maxArea) {
        maxArea = area;
        nextA = j;
      }
    }
    sampled.push(nextA);
    a = nextA;
  }
  sampled.push(n - 1);
  return sampled;
}

export function downsampleByIndices<T>(arr: T[], indices: number[]): T[] {
  return indices.map((i) => arr[i]!);
}

export function downsampleTrendAxisToBars(
  categories: string[],
  dataColumns: (number | null)[][],
  bars: number,
): { categories: string[]; columns: (number | null)[][] } {
  return {
    categories: binTrendCategories(categories, bars),
    columns: dataColumns.map((col) => downsampleTrendValues(col, bars)),
  };
}

/** 원본 RPC 버킷 → GRAPH_BARS 표시 해상도(평균 집계). */
export function downsampleTrendAxis(
  categories: string[],
  dataColumns: (number | null)[][],
  period: TrendPeriodId,
): { categories: string[]; columns: (number | null)[][] } {
  return downsampleTrendAxisToBars(categories, dataColumns, GRAPH_BARS[period]);
}

/** 라인 차트용 — 플롯 너비 기준 LTTB. 히트맵은 GRAPH_BARS 유지. */
export function downsampleColumnsForChart(
  categories: string[],
  dataColumns: (number | null)[][],
  plotWidthPx: number,
): { categories: string[]; columns: (number | null)[][] } {
  const n = categories.length;
  const bars = targetChartDisplayBars(n, plotWidthPx);
  if (n <= 1 || bars >= n) {
    return { categories, columns: dataColumns };
  }
  const driver =
    dataColumns.find((col) =>
      col.some((v) => v != null && Number.isFinite(v)),
    ) ??
    dataColumns[0] ??
    [];
  const idx = pickLttbIndices(driver, bars);
  return {
    categories: downsampleByIndices(categories, idx),
    columns: dataColumns.map((col) => downsampleByIndices(col, idx)),
  };
}

/** X축 tick 목표 개수 — 축약 라벨(월 1회·일만) 기준 */
export const TREND_CHART_TICK_TARGET = 8;
export const TREND_CHART_TICK_TARGET_COMPACT = 6;

/** compact/TrendChart — 기간별 표시 막대 수에 맞춘 tick 간격. */
export function tickEveryForDisplayBars(
  count: number,
  opts?: { compact?: boolean },
): number {
  const target = opts?.compact
    ? TREND_CHART_TICK_TARGET_COMPACT
    : TREND_CHART_TICK_TARGET;
  if (count <= target) return 1;
  return Math.max(1, Math.ceil(count / target));
}

/** tickIndices dedup — 라벨 겹침 방지 최소 인덱스 간격 */
export function trendChartTickMinGap(
  count: number,
  every: number,
  target = TREND_CHART_TICK_TARGET,
): number {
  if (count <= 0) return 1;
  return Math.max(every, Math.ceil(count / target));
}

/** 풀 라벨 `M/D` · `M/D HH` · `M/D HH:mm` 파싱 (호버용 categories 형식). */
export function parseTrendAxisMdLabel(
  fullLabel: string,
): { month: number; day: number } | null {
  const m = fullLabel.match(
    /^(\d{1,2})\/(\d{1,2})(?:\s+\d{1,2}(?::\d{2})?)?$/,
  );
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { month, day };
}

/** `M/D HH:mm` · `M/D HH` · `HH:mm` — 24h tick·스코프용 */
export function parseTrendAxisTimeLabel(fullLabel: string): {
  month: number;
  day: number;
  hour: number;
  minute: number;
} | null {
  const mdHm = fullLabel.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (mdHm) {
    return {
      month: Number(mdHm[1]),
      day: Number(mdHm[2]),
      hour: Number(mdHm[3]),
      minute: Number(mdHm[4]),
    };
  }
  const mdH = fullLabel.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2})$/);
  if (mdH) {
    return {
      month: Number(mdH[1]),
      day: Number(mdH[2]),
      hour: Number(mdH[3]),
      minute: 0,
    };
  }
  const hm = fullLabel.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    return {
      month: 0,
      day: 0,
      hour: Number(hm[1]),
      minute: Number(hm[2]),
    };
  }
  return null;
}

/**
 * X축 tick 표시용 축약.
 * categories는 풀 라벨(호버/툴팁용)을 유지하고, tick만 축약.
 *
 * - 24h: 양끝 `HH:mm` · 중간 `HH` (categories는 `M/D HH:mm` — 월/일은 tick에 노출 안 함)
 *   자정 넘김 틱만 `M/D HH`로 일 맥락 유지.
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
    const t = parseTrendAxisTimeLabel(fullLabel);
    if (!t) return fullLabel;
    const hh = String(t.hour).padStart(2, "0");
    const mm = String(t.minute).padStart(2, "0");
    const prev = opts.prevLabel
      ? parseTrendAxisTimeLabel(opts.prevLabel)
      : null;
    const dayChanged =
      prev != null &&
      t.month > 0 &&
      (prev.month !== t.month || prev.day !== t.day);

    if (opts.endpoint) {
      return `${hh}:${mm}`;
    }
    if (dayChanged) {
      return `${t.month}/${t.day} ${hh}`;
    }
    return hh;
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

  const startHm = start.match(/\s(\d{1,2}:\d{2})$/)?.[1];
  const endHm = end.match(/\s(\d{1,2}:\d{2})$/)?.[1];
  if (startHm && endHm) {
    return `${startHm} ~ ${endHm}`;
  }

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

