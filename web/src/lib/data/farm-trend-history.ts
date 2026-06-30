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
  type TrendPeriodData,
  type TrendPeriodId,
  type TrendSpSeries,
  type TrendStallSeries,
} from "@/lib/data/farm-trend-types";

export type {
  TrendPeriodId,
  TrendPeriodData,
  TrendSpSeries,
  TrendStallSeries,
} from "@/lib/data/farm-trend-types";
export { TREND_PERIODS, DEFAULT_TREND_PERIOD } from "@/lib/data/farm-trend-types";

/** Cache/query alignment slot — keeps `now` stable for 5 minutes. */
const CACHE_SLOT_MS = 5 * 60 * 1000;

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

async function fetchTrendRows(
  accessToken: string,
  farmKey: FarmKey,
  fromIso: string,
  toIso: string,
  bucket: string,
): Promise<RpcRow[]> {
  const supabase = createRlsClient(accessToken);
  const { data, error } = await supabase.rpc(
    "farm_trend_history" as never,
    {
      p_lsind: farmKey.lsindRegistNo,
      p_item: farmKey.itemCode,
      p_from: fromIso,
      p_to: toIso,
      p_bucket: bucket,
    } as never,
  );
  if (error || !data) return [];
  return data as unknown as RpcRow[];
}

function formatBucketLabel(date: Date, period: TrendPeriodId): string {
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const hh = String(date.getHours()).padStart(2, "0");
  if (period === "24h") return `${hh}시`;
  if (period === "7d") return `${mm}/${dd} ${hh}시`;
  return `${mm}/${dd}`;
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
    ["farm-trend", userId, scopeKey, params.period, String(toMs)],
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

/** SSR all three periods so the client can toggle without re-fetching. */
export async function getFarmTrendAllPeriods(params: {
  farmKey: FarmKey;
  now?: number;
}): Promise<Record<TrendPeriodId, TrendPeriodData>> {
  const now = params.now ?? Date.now();
  const [h24, d7, d30] = await Promise.all([
    getFarmTrendHistory({ farmKey: params.farmKey, period: "24h", now }),
    getFarmTrendHistory({ farmKey: params.farmKey, period: "7d", now }),
    getFarmTrendHistory({ farmKey: params.farmKey, period: "30d", now }),
  ]);
  return { "24h": h24, "7d": d7, "30d": d30 };
}
