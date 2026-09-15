import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import { stallTyCodeSortKey } from "@/lib/data/stall-type";
import {
  emptyTrendControllerPeriodData,
  TREND_OVERVIEW_30D,
  TREND_PERIODS,
  type TrendControllerPeriodData,
  type TrendControllerSeries,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import {
  collapseThermoRange,
  emptyChannelThermo,
  holdForwardThermo,
} from "@/lib/farm/channel-thermo";

/**
 * slot, temp, humidity, fanSupply, fanExhaust, fanIntake,
 * fanA, fanB, fanC, sampleCount
 * (fanSupply/Exhaust/Intake = eqpmnCode-role 하위호환, fanA/B/C = 슬롯 표시 정본)
 */
export type CompactControllerPoint = [
  number,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number,
];

/** slot + A/B/C thermo 4값. 희소 — 설정이 있는 칸만. */
export type CompactThermoPoint = [
  number,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
];

export type CompactControllerSeries = {
  ty: string;
  lb: string;
  sn: string;
  k: string;
  e: string;
  p: CompactControllerPoint[];
  th?: CompactThermoPoint[];
};

export type CompactControllerPeriod = {
  v: 1;
  period: TrendPeriodId;
  fromMs: number;
  bucketCount: number;
  strideMs: number;
  totalSamples: number;
  series: CompactControllerSeries[];
};

export function emptyCompactControllerPeriod(
  period: TrendPeriodId,
  fromMs = 0,
  bucketCount = 0,
  strideMs = 0,
): CompactControllerPeriod {
  return {
    v: 1,
    period,
    fromMs,
    bucketCount,
    strideMs,
    totalSamples: 0,
    series: [],
  };
}

export function formatTrendBucketLabel(
  date: Date,
  period: TrendPeriodId,
): string {
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  if (period === "24h") return `${hh}:${min}`;
  return `${mm}/${dd} ${hh}:${min}`;
}

export function buildTrendAxis(
  period: TrendPeriodId,
  fromMs: number,
  bucketCount: number,
  strideMs: number,
): { categories: string[]; bucketAts: string[] } {
  const bucketAts: string[] = [];
  const categories: string[] = [];
  const n = Math.max(0, bucketCount);
  const stride = strideMs > 0 ? strideMs : 1;
  for (let i = 0; i < n; i++) {
    const d = new Date(fromMs + i * stride);
    bucketAts.push(d.toISOString());
    categories.push(formatTrendBucketLabel(d, period));
  }
  return { categories, bucketAts };
}

function stallNoSortKey(stallNo: string): number {
  const n = Number(stallNo);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function eqpmnSortKey(eqpmnNo: string): number {
  const n = Number(normalizeEqpmnNo(eqpmnNo));
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function emptyControllerSeries(
  stallNo: string,
  controllerKey: string,
  eqpmnNo: string,
  bucketCount: number,
): TrendControllerSeries {
  const emptyCol = () => new Array<number | null>(bucketCount).fill(null);
  return {
    stallNo,
    controllerKey,
    eqpmnNo,
    temp: emptyCol(),
    humidity: emptyCol(),
    fanA: emptyCol(),
    fanB: emptyCol(),
    fanC: emptyCol(),
    fanSupply: emptyCol(),
    fanExhaust: emptyCol(),
    fanIntake: emptyCol(),
    sampleCount: new Array<number>(bucketCount).fill(0),
  };
}

export function isCompactControllerPeriod(
  value: unknown,
): value is CompactControllerPeriod {
  if (!value || typeof value !== "object") return false;
  const v = value as CompactControllerPeriod;
  return v.v === 1 && Array.isArray(v.series);
}

/** 클라이언트·서버 공용 — 희소 전송분을 기존 dense 시계열로 복원. */
export function expandCompactControllerPeriod(
  compact: CompactControllerPeriod | null | undefined,
): TrendControllerPeriodData {
  if (!compact || compact.v !== 1) {
    return emptyTrendControllerPeriodData("24h");
  }
  const bucketCount = Math.max(0, compact.bucketCount);
  const { categories, bucketAts } = buildTrendAxis(
    compact.period,
    compact.fromMs,
    bucketCount,
    compact.strideMs,
  );

  type StallBucket = {
    stallNo: string;
    controllers: Map<string, TrendControllerSeries>;
  };
  type SpBucket = {
    stallTyCode: string;
    label: string;
    stalls: Map<string, StallBucket>;
  };
  const spMap = new Map<string, SpBucket>();

  for (const row of compact.series) {
    const ty = row.ty;
    let sp = spMap.get(ty);
    if (!sp) {
      sp = { stallTyCode: ty, label: row.lb, stalls: new Map() };
      spMap.set(ty, sp);
    }
    const stallNo = row.sn;
    let stall = sp.stalls.get(stallNo);
    if (!stall) {
      stall = { stallNo, controllers: new Map() };
      sp.stalls.set(stallNo, stall);
    }
    let ctrl = stall.controllers.get(row.k);
    if (!ctrl) {
      ctrl = emptyControllerSeries(stallNo, row.k, row.e, bucketCount);
      stall.controllers.set(row.k, ctrl);
    }
    for (const point of row.p) {
      const slot = point[0];
      if (slot < 0 || slot >= bucketCount) continue;
      ctrl.temp[slot] = point[1];
      ctrl.humidity[slot] = point[2];
      ctrl.fanSupply[slot] = point[3];
      ctrl.fanExhaust[slot] = point[4];
      ctrl.fanIntake[slot] = point[5];
      ctrl.fanA[slot] = point[6];
      ctrl.fanB[slot] = point[7];
      ctrl.fanC[slot] = point[8];
      ctrl.sampleCount[slot] = point[9] ?? 0;
    }
    if (row.th?.length) {
      const a = emptyChannelThermo(bucketCount);
      const b = emptyChannelThermo(bucketCount);
      const c = emptyChannelThermo(bucketCount);
      for (const t of row.th) {
        const slot = t[0];
        if (slot < 0 || slot >= bucketCount) continue;
        a.setpoint[slot] = t[1];
        a.deviation[slot] = t[2];
        a.minVent[slot] = t[3];
        a.maxVent[slot] = t[4];
        b.setpoint[slot] = t[5];
        b.deviation[slot] = t[6];
        b.minVent[slot] = t[7];
        b.maxVent[slot] = t[8];
        c.setpoint[slot] = t[9];
        c.deviation[slot] = t[10];
        c.minVent[slot] = t[11];
        c.maxVent[slot] = t[12];
      }
      ctrl.thermoA = holdForwardThermo(a);
      ctrl.thermoB = holdForwardThermo(b);
      ctrl.thermoC = holdForwardThermo(c);
    }
  }

  const sp = [...spMap.values()]
    .sort((a, b) => stallTyCodeSortKey(a.stallTyCode) - stallTyCodeSortKey(b.stallTyCode))
    .map((s) => ({
      stallTyCode: s.stallTyCode,
      label: s.label,
      stalls: [...s.stalls.values()]
        .sort((a, b) => stallNoSortKey(a.stallNo) - stallNoSortKey(b.stallNo))
        .map((st) => ({
          stallNo: st.stallNo,
          controllers: [...st.controllers.values()].sort(
            (a, b) => eqpmnSortKey(a.eqpmnNo) - eqpmnSortKey(b.eqpmnNo),
          ),
        })),
    }));

  return {
    period: compact.period,
    categories,
    bucketAts,
    sp,
    totalSamples: compact.totalSamples,
  };
}

function avgRange(values: (number | null)[], from: number, to: number): number | null {
  let sum = 0;
  let n = 0;
  for (let i = from; i < to; i++) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) {
      sum += v;
      n += 1;
    }
  }
  return n > 0 ? sum / n : null;
}

function sumRange(values: number[], from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) {
    sum += values[i] ?? 0;
  }
  return sum;
}

/** 7일 1시간 → 브러시용 30일×1일. 앞 23일은 비우고 최근 7일만 채운다. RPC 없음. */
export function synthesizeOverview30dFrom7d(
  d7: TrendControllerPeriodData,
): TrendControllerPeriodData {
  const days7 = 7;
  const slotsPerDay = TREND_PERIODS["7d"].bucketCount / days7;
  if (
    d7.period !== "7d" ||
    d7.bucketAts.length !== TREND_PERIODS["7d"].bucketCount ||
    !Number.isFinite(days7)
  ) {
    return emptyTrendControllerPeriodData("30d");
  }
  const d7From = Date.parse(d7.bucketAts[0] ?? "");
  if (!Number.isFinite(d7From)) {
    return emptyTrendControllerPeriodData("30d");
  }
  const fromMs = d7From - (TREND_OVERVIEW_30D.bucketCount - days7) * TREND_OVERVIEW_30D.strideMs;
  const { categories, bucketAts } = buildTrendAxis(
    "30d",
    fromMs,
    TREND_OVERVIEW_30D.bucketCount,
    TREND_OVERVIEW_30D.strideMs,
  );
  const dayOffset = TREND_OVERVIEW_30D.bucketCount - days7;
  let totalSamples = 0;

  const sp = d7.sp.map((group) => ({
    stallTyCode: group.stallTyCode,
    label: group.label,
    stalls: group.stalls.map((stall) => ({
      stallNo: stall.stallNo,
      controllers: stall.controllers.map((c) => {
        const next = emptyControllerSeries(
          stall.stallNo,
          c.controllerKey,
          c.eqpmnNo,
          TREND_OVERVIEW_30D.bucketCount,
        );
        for (let day = 0; day < days7; day++) {
          const from = day * slotsPerDay;
          const to = from + slotsPerDay;
          const slot = dayOffset + day;
          next.temp[slot] = avgRange(c.temp, from, to);
          next.humidity[slot] = avgRange(c.humidity, from, to);
          next.fanA[slot] = avgRange(c.fanA, from, to);
          next.fanB[slot] = avgRange(c.fanB, from, to);
          next.fanC[slot] = avgRange(c.fanC, from, to);
          next.fanSupply[slot] = avgRange(c.fanSupply, from, to);
          next.fanExhaust[slot] = avgRange(c.fanExhaust, from, to);
          next.fanIntake[slot] = avgRange(c.fanIntake, from, to);
          next.sampleCount[slot] = sumRange(c.sampleCount, from, to);
          totalSamples += next.sampleCount[slot] ?? 0;
        }
        if (c.thermoA || c.thermoB || c.thermoC) {
          const a = emptyChannelThermo(TREND_OVERVIEW_30D.bucketCount);
          const b = emptyChannelThermo(TREND_OVERVIEW_30D.bucketCount);
          const cTh = emptyChannelThermo(TREND_OVERVIEW_30D.bucketCount);
          for (let day = 0; day < days7; day++) {
            const from = day * slotsPerDay;
            const to = from + slotsPerDay;
            const slot = dayOffset + day;
            const dayA = collapseThermoRange(c.thermoA, from, to);
            const dayB = collapseThermoRange(c.thermoB, from, to);
            const dayC = collapseThermoRange(c.thermoC, from, to);
            a.setpoint[slot] = dayA?.setpoint[0] ?? null;
            a.deviation[slot] = dayA?.deviation[0] ?? null;
            a.minVent[slot] = dayA?.minVent[0] ?? null;
            a.maxVent[slot] = dayA?.maxVent[0] ?? null;
            b.setpoint[slot] = dayB?.setpoint[0] ?? null;
            b.deviation[slot] = dayB?.deviation[0] ?? null;
            b.minVent[slot] = dayB?.minVent[0] ?? null;
            b.maxVent[slot] = dayB?.maxVent[0] ?? null;
            cTh.setpoint[slot] = dayC?.setpoint[0] ?? null;
            cTh.deviation[slot] = dayC?.deviation[0] ?? null;
            cTh.minVent[slot] = dayC?.minVent[0] ?? null;
            cTh.maxVent[slot] = dayC?.maxVent[0] ?? null;
          }
          next.thermoA = holdForwardThermo(a);
          next.thermoB = holdForwardThermo(b);
          next.thermoC = holdForwardThermo(cTh);
        }
        return next;
      }),
    })),
  }));

  return {
    period: "30d",
    categories,
    bucketAts,
    sp,
    totalSamples,
  };
}
