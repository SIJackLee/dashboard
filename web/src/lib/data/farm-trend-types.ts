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

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Source buckets are finer than GRAPH_BARS so heatmap can binWorst
 * (crisis / short excursions). Display stays 24 / 28 / 30 columns.
 *   24h: 15m × 96  → 24 (worst of 4)
 *   7d:  1h × 168  → 28 (worst of 6)
 *   30d: 1h × 720  → 30 (worst of 24 = 1 day)
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
    bucket: "1 hour",
    durationMs: 7 * DAY,
    bucketCount: 168,
    strideMs: HOUR,
  },
  "30d": {
    id: "30d",
    label: "30일",
    bucket: "1 hour",
    durationMs: 30 * DAY,
    bucketCount: 720,
    strideMs: HOUR,
  },
};

export const DEFAULT_TREND_PERIOD: TrendPeriodId = "24h";

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
  /** 호버용 장비 표시명 (N번 축사 M). */
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
