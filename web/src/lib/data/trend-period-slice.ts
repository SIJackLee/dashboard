/**
 * 동일 bucket(1h) 기간끼리 — 긴 창(30d)에서 짧은 창(7d)을 잘라낸다.
 * 24h(15m)와는 버킷이 달라 파생 불가.
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

/** 30d(1h×720) → 7d(1h×168). bucket 불일치·길이 부족 시 null. */
export function sliceControllerTrendFromLonger(
  source: TrendControllerPeriodData,
  targetPeriod: Extract<TrendPeriodId, "7d">,
): TrendControllerPeriodData | null {
  const srcCfg = TREND_PERIODS[source.period];
  const dstCfg = TREND_PERIODS[targetPeriod];
  if (srcCfg.bucket !== dstCfg.bucket) return null;
  if (srcCfg.strideMs !== dstCfg.strideMs) return null;
  if (source.bucketAts.length < dstCfg.bucketCount) return null;

  const start = source.bucketAts.length - dstCfg.bucketCount;
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
  targetPeriod: Extract<TrendPeriodId, "7d">,
): TrendPeriodData | null {
  const srcCfg = TREND_PERIODS[source.period];
  const dstCfg = TREND_PERIODS[targetPeriod];
  if (srcCfg.bucket !== dstCfg.bucket) return null;
  if (srcCfg.strideMs !== dstCfg.strideMs) return null;
  if (source.bucketAts.length < dstCfg.bucketCount) return null;

  const start = source.bucketAts.length - dstCfg.bucketCount;
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
