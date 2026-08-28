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
const HOUR = 60 * MINUTE;
const DAY = 24 * 60 * 60 * 1000;

/**
 * Hub chart buckets.
 *   24h: 15m × 96   → GRAPH_BARS 24
 *   7d:  1h × 168   → GRAPH_BARS 28 (from 30d tail)
 *   30d: 1h × 720   → GRAPH_BARS 30
 * Zoom window ≤ 48h: 15m for that range only (TREND_ZOOM_15M_MAX_DAYS).
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
    bucketCount: 7 * 24,
    strideMs: HOUR,
  },
  "30d": {
    id: "30d",
    label: "30일",
    bucket: "1 hour",
    durationMs: 30 * DAY,
    bucketCount: 30 * 24,
    strideMs: HOUR,
  },
};

/** 브러시 줌 창(≤48h) 15분 축. 허브·PDF 기본 로드는 TREND_PERIODS. */
export const TREND_15M_PERIODS: Record<TrendPeriodId, TrendPeriodConfig> = {
  "24h": TREND_PERIODS["24h"],
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

export const TREND_ZOOM_15M_MAX_DAYS = 2;

export const DEFAULT_TREND_PERIOD: TrendPeriodId = "7d";

/** 차트 브러시 개요 — 30일×1일. 허브 기본은 30d 1시간(720). */
export const TREND_OVERVIEW_30D: TrendPeriodConfig = {
  id: "30d",
  label: "30일",
  bucket: "1 day",
  durationMs: 30 * DAY,
  bucketCount: 30,
  strideMs: DAY,
};

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
  /** 추이 차트 전용 — 희소/통신두절/없음. 목록 그래프는 두지 않음. */
  uplinkKind?: Array<"sample" | "sparse" | "offline" | "void">;
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

/** 브러시 창 ≤ 48h 일 때 받은 구간 15분. */
export type TrendWindow15m = {
  fromMs: number;
  toMs: number;
  data: TrendControllerPeriodData;
};

export function emptyTrendControllerPeriodData(
  period: TrendPeriodId,
): TrendControllerPeriodData {
  return { period, categories: [], bucketAts: [], sp: [], totalSamples: 0 };
}

/** 빈 시간축(카테고리만)이 아니라 실제 컨트롤러 시계열이 있는지. */
export function controllerTrendPeriodHasSeries(
  data: TrendControllerPeriodData | null | undefined,
): boolean {
  if (!data) return false;
  if (data.totalSamples > 0) return true;
  for (const sp of data.sp) {
    for (const stall of sp.stalls) {
      if (stall.controllers.length > 0) return true;
    }
  }
  return false;
}

/** 허브 30일 1시간 축이 채워졌는지. */
export function isContextControllerTrend30d(
  data: TrendControllerPeriodData | null | undefined,
): boolean {
  return (
    (data?.categories.length ?? 0) === TREND_PERIODS["30d"].bucketCount
  );
}

export function isControllerTrendPeriodComplete(
  data: TrendControllerPeriodData | null | undefined,
  period: TrendPeriodId,
): boolean {
  return (data?.categories.length ?? 0) === TREND_PERIODS[period].bucketCount;
}

/**
 * 30일 1시간이 있으면 브러시 캔버스.
 * 없으면 선택한 기간 → 7일 → 24시간 순.
 */
export function pickTrendCanvasPeriod(
  bundle: Partial<Record<TrendPeriodId, TrendControllerPeriodData>> | null | undefined,
  period: TrendPeriodId,
): TrendPeriodId {
  if (
    isContextControllerTrend30d(bundle?.["30d"]) &&
    controllerTrendPeriodHasSeries(bundle?.["30d"])
  ) {
    return "30d";
  }
  if (controllerTrendPeriodHasSeries(bundle?.[period])) return period;
  if (controllerTrendPeriodHasSeries(bundle?.["7d"])) return "7d";
  if (controllerTrendPeriodHasSeries(bundle?.["24h"])) return "24h";
  return period;
}

/** 기본 백그라운드 완료 — 30일 1시간 축. */
export function isCompleteControllerTrendBundle(
  bundle: Record<TrendPeriodId, TrendControllerPeriodData> | null | undefined,
): boolean {
  return isControllerTrendPeriodComplete(bundle?.["30d"], "30d");
}
