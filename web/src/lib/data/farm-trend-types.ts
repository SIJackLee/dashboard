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

export const TREND_PERIODS: Record<TrendPeriodId, TrendPeriodConfig> = {
  "24h": {
    id: "24h",
    label: "24시간",
    bucket: "15 minutes",
    durationMs: DAY,
    bucketCount: 96,
    strideMs: 15 * MINUTE,
  },
  "7d": { id: "7d", label: "7일", bucket: "6 hours", durationMs: 7 * DAY, bucketCount: 28, strideMs: 6 * HOUR },
  "30d": { id: "30d", label: "30일", bucket: "1 day", durationMs: 30 * DAY, bucketCount: 30, strideMs: DAY },
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

/** One controller (eqpmn) aligned series — list graph mode. */
export type TrendControllerSeries = TrendStallSeries & {
  controllerKey: string;
  eqpmnNo: string;
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
