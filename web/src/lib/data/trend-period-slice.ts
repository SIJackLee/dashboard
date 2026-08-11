/**
 * Canonical 30d(15m) → shorter periods — 동일 bucket·stride only.
 */
import {
  TREND_PERIODS,
  type TrendControllerPeriodData,
  type TrendControllerSeries,
  type TrendPeriodData,
  type TrendPeriodId,
  type TrendStallSeries,
} from "@/lib/data/farm-trend-types";

function sliceNumericCols<T extends TrendStallSeries>(
  series: T,
  start: number,
  count: number,
): T {
  return {
    ...series,
    temp: series.temp.slice(start, start + count),
    humidity: series.humidity.slice(start, start + count),
    fanSupply: series.fanSupply.slice(start, start + count),
    fanExhaust: series.fanExhaust.slice(start, start + count),
    fanIntake: series.fanIntake.slice(start, start + count),
    sampleCount: series.sampleCount.slice(start, start + count),
  };
}

function tailSliceStart(
  sourceLength: number,
  targetPeriod: Exclude<TrendPeriodId, "30d">,
): number | null {
  const dstCfg = TREND_PERIODS[targetPeriod];
  if (sourceLength < dstCfg.bucketCount) return null;
  return sourceLength - dstCfg.bucketCount;
}

/** 30d(15m×2880) → 7d(672) | 24h(96). bucket 불일치·길이 부족 시 null. */
export function sliceControllerTrendFromLonger(
  source: TrendControllerPeriodData,
  targetPeriod: Exclude<TrendPeriodId, "30d">,
): TrendControllerPeriodData | null {
  if (source.period !== "30d") return null;
  const srcCfg = TREND_PERIODS[source.period];
  const dstCfg = TREND_PERIODS[targetPeriod];
  if (srcCfg.bucket !== dstCfg.bucket) return null;
  if (srcCfg.strideMs !== dstCfg.strideMs) return null;

  const start = tailSliceStart(source.bucketAts.length, targetPeriod);
  if (start == null) return null;

  let totalSamples = 0;
  const sp = source.sp.map((s) => ({
    ...s,
    stalls: s.stalls.map((st) => ({
      stallNo: st.stallNo,
      controllers: st.controllers.map((c) => {
        const sliced = sliceNumericCols(c, start, dstCfg.bucketCount);
        totalSamples += sliced.sampleCount.reduce((a, n) => a + n, 0);
        return sliced as TrendControllerSeries;
      }),
    })),
  }));

  return {
    period: targetPeriod,
    categories: source.categories.slice(start),
    bucketAts: source.bucketAts.slice(start),
    sp,
    totalSamples,
  };
}

export function sliceStallTrendFromLonger(
  source: TrendPeriodData,
  targetPeriod: Exclude<TrendPeriodId, "30d">,
): TrendPeriodData | null {
  if (source.period !== "30d") return null;
  const srcCfg = TREND_PERIODS[source.period];
  const dstCfg = TREND_PERIODS[targetPeriod];
  if (srcCfg.bucket !== dstCfg.bucket) return null;
  if (srcCfg.strideMs !== dstCfg.strideMs) return null;

  const start = tailSliceStart(source.bucketAts.length, targetPeriod);
  if (start == null) return null;

  let totalSamples = 0;
  const sp = source.sp.map((s) => ({
    ...s,
    stalls: s.stalls.map((st) => {
      const sliced = sliceNumericCols(st, start, dstCfg.bucketCount);
      totalSamples += sliced.sampleCount.reduce((a, n) => a + n, 0);
      return sliced;
    }),
  }));

  return {
    period: targetPeriod,
    categories: source.categories.slice(start),
    bucketAts: source.bucketAts.slice(start),
    sp,
    totalSamples,
  };
}
