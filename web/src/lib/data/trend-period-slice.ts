/**
 * Canonical 30d(15m) → shorter periods — 동일 bucket·stride only.
 */
import {
  TREND_PERIODS,
  emptyTrendPeriodData,
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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** sampleCount-weighted mean — stall RPC `avg()` over the same rows. */
function weightedSlotAvg(
  values: (number | null)[],
  weights: number[],
): number | null {
  let wsum = 0;
  let nsum = 0;
  let unweighted = 0;
  let unweightedN = 0;
  const len = Math.min(values.length, weights.length);
  for (let i = 0; i < len; i++) {
    const v = values[i];
    if (v == null) continue;
    const w = weights[i] ?? 0;
    unweighted += v;
    unweightedN += 1;
    if (w > 0) {
      wsum += v * w;
      nsum += w;
    }
  }
  if (nsum > 0) return round1(wsum / nsum);
  if (unweightedN > 0) return round1(unweighted / unweightedN);
  return null;
}

function avgStallFromControllers(
  controllers: TrendControllerSeries[],
  bucketCount: number,
  stallNo: string,
): TrendStallSeries {
  const temp: (number | null)[] = new Array(bucketCount).fill(null);
  const humidity: (number | null)[] = new Array(bucketCount).fill(null);
  const fanSupply: (number | null)[] = new Array(bucketCount).fill(null);
  const fanExhaust: (number | null)[] = new Array(bucketCount).fill(null);
  const fanIntake: (number | null)[] = new Array(bucketCount).fill(null);
  const sampleCount = new Array<number>(bucketCount).fill(0);

  for (let i = 0; i < bucketCount; i++) {
    const temps: (number | null)[] = [];
    const hums: (number | null)[] = [];
    const supplies: (number | null)[] = [];
    const exhausts: (number | null)[] = [];
    const intakes: (number | null)[] = [];
    const weights: number[] = [];
    for (const c of controllers) {
      temps.push(c.temp[i] ?? null);
      hums.push(c.humidity[i] ?? null);
      supplies.push(c.fanSupply[i] ?? null);
      exhausts.push(c.fanExhaust[i] ?? null);
      intakes.push(c.fanIntake[i] ?? null);
      weights.push(c.sampleCount[i] ?? 0);
    }
    temp[i] = weightedSlotAvg(temps, weights);
    humidity[i] = weightedSlotAvg(hums, weights);
    fanSupply[i] = weightedSlotAvg(supplies, weights);
    fanExhaust[i] = weightedSlotAvg(exhausts, weights);
    fanIntake[i] = weightedSlotAvg(intakes, weights);
    sampleCount[i] = weights.reduce((a, n) => a + n, 0);
  }

  return {
    stallNo,
    temp,
    humidity,
    fanSupply,
    fanExhaust,
    fanIntake,
    sampleCount,
  };
}

/** 컨트롤러 버킷 → 축사 평균 (히트맵). 별도 stall RPC 없음. */
export function stallTrendFromControllerPeriod(
  source: TrendControllerPeriodData,
): TrendPeriodData {
  const bucketCount = source.categories.length;
  if (bucketCount === 0) return emptyTrendPeriodData(source.period);

  let totalSamples = 0;
  const sp = source.sp.map((s) => ({
    stallTyCode: s.stallTyCode,
    label: s.label,
    stalls: s.stalls.map((st) => {
      const stall = avgStallFromControllers(
        st.controllers,
        bucketCount,
        st.stallNo,
      );
      totalSamples += stall.sampleCount.reduce((a, n) => a + n, 0);
      return stall;
    }),
  }));

  return {
    period: source.period,
    categories: source.categories,
    bucketAts: source.bucketAts,
    sp,
    totalSamples,
  };
}

export function stallTrendBundleFromController(
  bundle: Record<TrendPeriodId, TrendControllerPeriodData>,
): Record<TrendPeriodId, TrendPeriodData> {
  return {
    "24h": stallTrendFromControllerPeriod(bundle["24h"]),
    "7d": stallTrendFromControllerPeriod(bundle["7d"]),
    "30d": stallTrendFromControllerPeriod(bundle["30d"]),
  };
}
