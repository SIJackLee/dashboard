import "server-only";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { cachedLiveQuery } from "@/lib/data/live-cache";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { createRlsClient, getAccessTokenOrNull } from "@/lib/supabase/rls-client";
import {
  getStallTypeName,
  normalizeStallTyCode,
  stallTyCodeSortKey,
} from "@/lib/data/stall-type";
import {
  TREND_PERIODS,
  type TrendControllerPeriodData,
  type TrendControllerSeries,
  type TrendControllerSpSeries,
  type TrendPeriodData,
  type TrendPeriodId,
  type TrendSpSeries,
  type TrendStallSeries,
} from "@/lib/data/farm-trend-types";
import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import {
  sliceControllerTrendFromLonger,
  sliceStallTrendFromLonger,
} from "@/lib/data/trend-period-slice";

export type {
  TrendPeriodId,
  TrendPeriodData,
  TrendSpSeries,
  TrendStallSeries,
  TrendControllerPeriodData,
  TrendControllerSeries,
} from "@/lib/data/farm-trend-types";
export { TREND_PERIODS, DEFAULT_TREND_PERIOD } from "@/lib/data/farm-trend-types";

/** Cache/query alignment slot — keeps `now` stable for 5 minutes. */
const CACHE_SLOT_MS = 5 * 60 * 1000;

/** RPC buckets by mesure_at (sensor time); live card freshness stays on received_at. */

type RpcRow = {
  bucket_at: string;
  stall_ty_code: string | null;
  stall_no: string | null;
  avg_temp_c: number | string | null;
  avg_humidity_pct: number | string | null;
  avg_fan_supply: number | string | null;
  avg_fan_exhaust: number | string | null;
  avg_fan_intake: number | string | null;
  sample_count: number | string | null;
};

type ControllerRpcRow = RpcRow & {
  controller_key: string | null;
  eqpmn_no: string | null;
};

function stallNoSortKey(stallNo: string): number {
  const n = Number(stallNo);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function toNum(v: number | string | null): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function alignedToMs(now: number): number {
  return Math.floor(now / CACHE_SLOT_MS) * CACHE_SLOT_MS;
}

/** PostgREST page size — must match supabase/config.toml max_rows. */
const RPC_PAGE_SIZE = 1000;
/** Safety cap: 30d×15m×~20 controllers ≈ 38 pages. */
const RPC_MAX_PAGES = 50;

async function fetchRpcAllPages<T>(
  accessToken: string,
  rpcName: string,
  args: Record<string, string>,
): Promise<T[]> {
  const supabase = createRlsClient(accessToken);
  const out: T[] = [];
  for (let page = 0; page < RPC_MAX_PAGES; page++) {
    const from = page * RPC_PAGE_SIZE;
    const to = from + RPC_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .rpc(rpcName as never, args as never)
      .range(from, to);
    if (error || !data?.length) break;
    out.push(...(data as T[]));
    if (data.length < RPC_PAGE_SIZE) break;
  }
  return out;
}

async function fetchTrendRows(
  accessToken: string,
  farmKey: FarmKey,
  fromIso: string,
  toIso: string,
  bucket: string,
): Promise<RpcRow[]> {
  return fetchRpcAllPages<RpcRow>(accessToken, "farm_trend_history", {
    p_lsind: farmKey.lsindRegistNo,
    p_item: farmKey.itemCode,
    p_from: fromIso,
    p_to: toIso,
    p_bucket: bucket,
  });
}

async function fetchControllerTrendRows(
  accessToken: string,
  farmKey: FarmKey,
  fromIso: string,
  toIso: string,
  bucket: string,
): Promise<ControllerRpcRow[]> {
  return fetchRpcAllPages<ControllerRpcRow>(
    accessToken,
    "farm_trend_history_by_controller",
    {
      p_lsind: farmKey.lsindRegistNo,
      p_item: farmKey.itemCode,
      p_from: fromIso,
      p_to: toIso,
      p_bucket: bucket,
    },
  );
}

function eqpmnSortKey(eqpmnNo: string): number {
  const n = Number(normalizeEqpmnNo(eqpmnNo));
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function newEmptyStallSeries(stallNo: string, bucketCount: number): TrendStallSeries {
  const emptyCol = () => new Array<number | null>(bucketCount).fill(null);
  return {
    stallNo,
    temp: emptyCol(),
    humidity: emptyCol(),
    fanSupply: emptyCol(),
    fanExhaust: emptyCol(),
    fanIntake: emptyCol(),
    sampleCount: new Array<number>(bucketCount).fill(0),
  };
}

function formatBucketLabel(date: Date, period: TrendPeriodId): string {
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  if (period === "24h") return `${hh}:${min}`;
  // 7d/30d — 15m canonical · M/D HH (툴팁·호버; tick은 abbreviateTrendAxisLabel)
  return `${mm}/${dd} ${hh}:${min}`;
}

/** Build a continuous, gap-aware time axis grouped by SP. */
function buildPeriodData(
  rows: RpcRow[],
  period: TrendPeriodId,
  fromMs: number,
): TrendPeriodData {
  const cfg = TREND_PERIODS[period];

  const bucketAts: string[] = [];
  const categories: string[] = [];
  const indexByIso = new Map<string, number>();
  for (let i = 0; i < cfg.bucketCount; i++) {
    const ms = fromMs + i * cfg.strideMs;
    const d = new Date(ms);
    const iso = d.toISOString();
    bucketAts.push(iso);
    categories.push(formatBucketLabel(d, period));
    indexByIso.set(iso, i);
  }

  const emptyCol = () => new Array<number | null>(cfg.bucketCount).fill(null);
  type SpBucket = { stallTyCode: string; label: string; stalls: Map<string, TrendStallSeries> };
  const spMap = new Map<string, SpBucket>();
  let totalSamples = 0;

  for (const row of rows) {
    const code = normalizeStallTyCode(row.stall_ty_code);
    let sp = spMap.get(code);
    if (!sp) {
      sp = { stallTyCode: code, label: getStallTypeName(code), stalls: new Map() };
      spMap.set(code, sp);
    }
    const stallNo = (row.stall_no ?? "").trim() || "—";
    let stall = sp.stalls.get(stallNo);
    if (!stall) {
      stall = {
        stallNo,
        temp: emptyCol(),
        humidity: emptyCol(),
        fanSupply: emptyCol(),
        fanExhaust: emptyCol(),
        fanIntake: emptyCol(),
        sampleCount: new Array<number>(cfg.bucketCount).fill(0),
      };
      sp.stalls.set(stallNo, stall);
    }
    // Align RPC bucket to the nearest axis slot.
    const bucketMs = Date.parse(row.bucket_at);
    const slot = Math.round((bucketMs - fromMs) / cfg.strideMs);
    if (slot < 0 || slot >= cfg.bucketCount) continue;
    stall.temp[slot] = toNum(row.avg_temp_c);
    stall.humidity[slot] = toNum(row.avg_humidity_pct);
    stall.fanSupply[slot] = toNum(row.avg_fan_supply);
    stall.fanExhaust[slot] = toNum(row.avg_fan_exhaust);
    stall.fanIntake[slot] = toNum(row.avg_fan_intake);
    const n = toNum(row.sample_count) ?? 0;
    stall.sampleCount[slot] = n;
    totalSamples += n;
  }

  const sp: TrendSpSeries[] = [...spMap.values()]
    .sort((a, b) => stallTyCodeSortKey(a.stallTyCode) - stallTyCodeSortKey(b.stallTyCode))
    .map((s) => ({
      stallTyCode: s.stallTyCode,
      label: s.label,
      stalls: [...s.stalls.values()].sort(
        (a, b) => stallNoSortKey(a.stallNo) - stallNoSortKey(b.stallNo),
      ),
    }));

  return { period, categories, bucketAts, sp, totalSamples };
}

/** Build controller-level series grouped by SP → stall → controller. */
function buildControllerPeriodData(
  rows: ControllerRpcRow[],
  period: TrendPeriodId,
  fromMs: number,
): TrendControllerPeriodData {
  const cfg = TREND_PERIODS[period];

  const bucketAts: string[] = [];
  const categories: string[] = [];
  for (let i = 0; i < cfg.bucketCount; i++) {
    const ms = fromMs + i * cfg.strideMs;
    const d = new Date(ms);
    bucketAts.push(d.toISOString());
    categories.push(formatBucketLabel(d, period));
  }

  type StallBucket = { stallNo: string; controllers: Map<string, TrendControllerSeries> };
  type SpBucket = { stallTyCode: string; label: string; stalls: Map<string, StallBucket> };
  const spMap = new Map<string, SpBucket>();
  let totalSamples = 0;

  for (const row of rows) {
    const code = normalizeStallTyCode(row.stall_ty_code);
    let sp = spMap.get(code);
    if (!sp) {
      sp = { stallTyCode: code, label: getStallTypeName(code), stalls: new Map() };
      spMap.set(code, sp);
    }
    const stallNo = (row.stall_no ?? "").trim() || "—";
    let stall = sp.stalls.get(stallNo);
    if (!stall) {
      stall = { stallNo, controllers: new Map() };
      sp.stalls.set(stallNo, stall);
    }
    const controllerKey = (row.controller_key ?? "").trim();
    if (!controllerKey) continue;
    let ctrl = stall.controllers.get(controllerKey);
    if (!ctrl) {
      ctrl = {
        ...newEmptyStallSeries(stallNo, cfg.bucketCount),
        controllerKey,
        eqpmnNo: normalizeEqpmnNo(row.eqpmn_no ?? "01"),
      };
      stall.controllers.set(controllerKey, ctrl);
    }
    const bucketMs = Date.parse(row.bucket_at);
    const slot = Math.round((bucketMs - fromMs) / cfg.strideMs);
    if (slot < 0 || slot >= cfg.bucketCount) continue;
    ctrl.temp[slot] = toNum(row.avg_temp_c);
    ctrl.humidity[slot] = toNum(row.avg_humidity_pct);
    ctrl.fanSupply[slot] = toNum(row.avg_fan_supply);
    ctrl.fanExhaust[slot] = toNum(row.avg_fan_exhaust);
    ctrl.fanIntake[slot] = toNum(row.avg_fan_intake);
    const n = toNum(row.sample_count) ?? 0;
    ctrl.sampleCount[slot] = n;
    totalSamples += n;
  }

  const sp: TrendControllerSpSeries[] = [...spMap.values()]
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

  return { period, categories, bucketAts, sp, totalSamples };
}

export async function getFarmTrendHistory(params: {
  farmKey: FarmKey;
  period: TrendPeriodId;
  now?: number;
}): Promise<TrendPeriodData> {
  const cfg = TREND_PERIODS[params.period];
  const toMs = alignedToMs(params.now ?? Date.now());
  const fromMs = toMs - cfg.durationMs;
  const emptyResult: TrendPeriodData = {
    period: params.period,
    categories: [],
    bucketAts: [],
    sp: [],
    totalSamples: 0,
  };

  const accessToken = await getAccessTokenOrNull();
  if (!accessToken) return emptyResult;

  const user = await getCurrentUser();
  const userId = user?.id ?? "anon";
  const scopeKey = farmKeyId(params.farmKey);

  const rows = await cachedLiveQuery(
    ["farm-trend", userId, scopeKey, params.period, String(toMs), "rpc-paged"],
    ["live", `trend:${scopeKey}`],
    () =>
      fetchTrendRows(
        accessToken,
        params.farmKey,
        new Date(fromMs).toISOString(),
        new Date(toMs).toISOString(),
        cfg.bucket,
      ),
  );

  return buildPeriodData(rows, params.period, fromMs);
}

/** SSR — canonical 30d(15m) 1회 → 7d/24h slice. */
export async function getFarmTrendAllPeriods(params: {
  farmKey: FarmKey;
  now?: number;
}): Promise<Record<TrendPeriodId, TrendPeriodData>> {
  const now = params.now ?? Date.now();
  const d30 = await getFarmTrendHistory({
    farmKey: params.farmKey,
    period: "30d",
    now,
  });
  const d7Slice = sliceStallTrendFromLonger(d30, "7d");
  const d7 =
    d7Slice && d7Slice.totalSamples > 0
      ? d7Slice
      : await getFarmTrendHistory({ farmKey: params.farmKey, period: "7d", now });
  const h24Slice = sliceStallTrendFromLonger(d30, "24h");
  const h24 =
    h24Slice && h24Slice.totalSamples > 0
      ? h24Slice
      : await getFarmTrendHistory({ farmKey: params.farmKey, period: "24h", now });
  return { "24h": h24, "7d": d7, "30d": d30 };
}

export async function getFarmControllerTrendHistory(params: {
  farmKey: FarmKey;
  period: TrendPeriodId;
  now?: number;
}): Promise<TrendControllerPeriodData> {
  const cfg = TREND_PERIODS[params.period];
  const toMs = alignedToMs(params.now ?? Date.now());
  const fromMs = toMs - cfg.durationMs;
  const emptyResult: TrendControllerPeriodData = {
    period: params.period,
    categories: [],
    bucketAts: [],
    sp: [],
    totalSamples: 0,
  };

  const accessToken = await getAccessTokenOrNull();
  if (!accessToken) return emptyResult;

  const user = await getCurrentUser();
  const userId = user?.id ?? "anon";
  const scopeKey = farmKeyId(params.farmKey);

  const rows = await cachedLiveQuery(
    [
      "farm-controller-trend",
      userId,
      scopeKey,
      params.period,
      String(toMs),
      "rpc-paged",
    ],
    ["live", `controller-trend:${scopeKey}`],
    () =>
      fetchControllerTrendRows(
        accessToken,
        params.farmKey,
        new Date(fromMs).toISOString(),
        new Date(toMs).toISOString(),
        cfg.bucket,
      ),
  );

  return buildControllerPeriodData(rows, params.period, fromMs);
}

/** 목록 그래프 — canonical 30d(15m) 1회 → 7d/24h slice. */
export async function getFarmControllerTrendAllPeriods(params: {
  farmKey: FarmKey;
  now?: number;
}): Promise<Record<TrendPeriodId, TrendControllerPeriodData>> {
  const now = params.now ?? Date.now();
  const d30 = await getFarmControllerTrendHistory({
    farmKey: params.farmKey,
    period: "30d",
    now,
  });
  const d7Slice = sliceControllerTrendFromLonger(d30, "7d");
  const d7 =
    d7Slice && d7Slice.totalSamples > 0
      ? d7Slice
      : await getFarmControllerTrendHistory({
          farmKey: params.farmKey,
          period: "7d",
          now,
        });
  const h24Slice = sliceControllerTrendFromLonger(d30, "24h");
  const h24 =
    h24Slice && h24Slice.totalSamples > 0
      ? h24Slice
      : await getFarmControllerTrendHistory({
          farmKey: params.farmKey,
          period: "24h",
          now,
        });
  return { "24h": h24, "7d": d7, "30d": d30 };
}
