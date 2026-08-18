/**
 * Shared trend types/constants — safe for both server and client modules.
 * Keep this file free of `server-only` imports.
 */

export type TrendPeriodId = "24h" | "7d" | "30d";

export type TrendPeriodConfig = {
  id: TrendPeriodId;
  label: string;
  /** Postgres interval passed to the RPC. */
  bucket: string;
  /** Window length in ms. */
  durationMs: number;
  /** Number of buckets spanning the window. */
  bucketCount: number;
  /** Bucket stride in ms (for building the continuous time axis). */
  strideMs: number;
};

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

/**
 * Canonical bucket: 15 minutes for all periods (shared time grid).
 * Source buckets are finer than GRAPH_BARS so heatmap can binWorst.
 * Display stays 24 / 28 / 30 columns.
 *   24h: 15m × 96   → 24 (worst of 4)
 *   7d:  15m × 672  → 28 (worst of 24)
 *   30d: 15m × 2880 → 30 (worst of 96)
 */
export const TREND_PERIODS: Record<TrendPeriodId, TrendPeriodConfig> = {
  "24h": {
    id: "24h",
    label: "24시간",
    bucket: "15 minutes",
    durationMs: DAY,
    bucketCount: 96,
    strideMs: 15 * MINUTE,
  },
  "7d": {
    id: "7d",
    label: "7일",
    bucket: "15 minutes",
    durationMs: 7 * DAY,
    bucketCount: 7 * 24 * 4,
    strideMs: 15 * MINUTE,
  },
  "30d": {
    id: "30d",
    label: "30일",
    bucket: "15 minutes",
    durationMs: 30 * DAY,
    bucketCount: 30 * 24 * 4,
    strideMs: 15 * MINUTE,
  },
};

export const DEFAULT_TREND_PERIOD: TrendPeriodId = "7d";

/** UI 순환 순서 — 24시간 → 7일 → 30일 → 24시간 */
export const TREND_PERIOD_ORDER: TrendPeriodId[] = ["24h", "7d", "30d"];

export function nextTrendPeriod(current: TrendPeriodId): TrendPeriodId {
  const i = TREND_PERIOD_ORDER.indexOf(current);
  const idx = i < 0 ? 0 : (i + 1) % TREND_PERIOD_ORDER.length;
  return TREND_PERIOD_ORDER[idx]!;
}

/** One barn (stall_no) aligned series across the full continuous time axis. */
export type TrendStallSeries = {
  stallNo: string;
  temp: (number | null)[];
  humidity: (number | null)[];
  fanSupply: (number | null)[];
  fanExhaust: (number | null)[];
  fanIntake: (number | null)[];
  sampleCount: number[];
};

/** One SP (stall type) grouping its barns. */
export type TrendSpSeries = {
  stallTyCode: string;
  label: string;
  stalls: TrendStallSeries[];
};

export type TrendPeriodData = {
  period: TrendPeriodId;
  /** Shared time axis (formatted labels). */
  categories: string[];
  /** Shared time axis (ISO bucket starts). */
  bucketAts: string[];
  sp: TrendSpSeries[];
  /** Total samples across all SPs/buckets — 0 means empty window. */
  totalSamples: number;
};

export function emptyTrendPeriodData(period: TrendPeriodId): TrendPeriodData {
  return { period, categories: [], bucketAts: [], sp: [], totalSamples: 0 };
}

/** 히트맵/그래프 활성 여부 — 빈 `{}`는 falsy로 취급 */
export function hasStallTrendByPeriod(
  trend: Partial<Record<TrendPeriodId, TrendPeriodData>> | null | undefined,
): boolean {
  return trend != null && trend["24h"] != null;
}

/** One controller (eqpmn) aligned series — list graph mode. */
export type TrendControllerSeries = TrendStallSeries & {
  controllerKey: string;
  eqpmnNo: string;
  /** 호버용 구역 표시명 (축사유형). */
  zoneLabel?: string;
  /** 호버용 장비 표시명 (컨트롤러 M). */
  equipmentLabel?: string;
  /** 스코프 이동용 축사유형 코드 (UI 미표시). */
  stallTyCode?: string;
};

export type TrendControllerStallGroup = {
  stallNo: string;
  controllers: TrendControllerSeries[];
};

/** One SP grouping controllers by barn. */
export type TrendControllerSpSeries = {
  stallTyCode: string;
  label: string;
  stalls: TrendControllerStallGroup[];
};

export type TrendControllerPeriodData = {
  period: TrendPeriodId;
  categories: string[];
  bucketAts: string[];
  sp: TrendControllerSpSeries[];
  totalSamples: number;
};

export function emptyTrendControllerPeriodData(
  period: TrendPeriodId,
): TrendControllerPeriodData {
  return { period, categories: [], bucketAts: [], sp: [], totalSamples: 0 };
}

export function isCompleteControllerTrendBundle(
  bundle: Record<TrendPeriodId, TrendControllerPeriodData> | null | undefined,
): boolean {
  return (
    (bundle?.["30d"]?.categories.length ?? 0) === TREND_PERIODS["30d"].bucketCount
  );
}
