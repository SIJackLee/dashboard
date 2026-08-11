import {
  resolveUltraFcstBase,
  resolveUltraNcstBase,
} from "@/lib/weather/kma-base-time";
import { latLngToGrid } from "@/lib/weather/kma-grid";
import type {
  KmaBaseSlot,
  KmaFetchResult,
  KmaForecastPoint,
  KmaGrid,
  KmaReading,
} from "@/lib/weather/kma-types";

const KMA_BASE_URL =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

type KmaItem = {
  category?: string;
  obsrValue?: string;
  fcstValue?: string;
  fcstDate?: string;
  fcstTime?: string;
};

type KmaApiResponse = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: { item?: KmaItem | KmaItem[] } };
  };
};

function asItems(item: KmaItem | KmaItem[] | undefined): KmaItem[] {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

function parseNum(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function buildUrl(
  operation: "getUltraSrtNcst" | "getUltraSrtFcst",
  serviceKey: string,
  base: KmaBaseSlot,
  grid: KmaGrid,
): string {
  const params = new URLSearchParams({
    serviceKey,
    pageNo: "1",
    numOfRows: "1000",
    dataType: "JSON",
    base_date: base.baseDate,
    base_time: base.baseTime,
    nx: String(grid.nx),
    ny: String(grid.ny),
  });
  return `${KMA_BASE_URL}/${operation}?${params.toString()}`;
}

async function fetchKmaJson(
  url: string,
): Promise<{ ok: true; json: KmaApiResponse } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "fetch_failed",
    };
  }
  if (!res.ok) {
    return { ok: false, error: `http_${res.status}` };
  }
  try {
    const json = (await res.json()) as KmaApiResponse;
    return { ok: true, json };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}

function headerOf(json: KmaApiResponse) {
  return {
    resultCode: json.response?.header?.resultCode ?? "UNKNOWN",
    resultMsg: json.response?.header?.resultMsg ?? "",
  };
}

function parseNcstItems(items: KmaItem[]): Pick<
  KmaReading,
  "tempC" | "humidityPct" | "windMs" | "precipMm"
> {
  let tempC: number | null = null;
  let humidityPct: number | null = null;
  let windMs: number | null = null;
  let precipMm: number | null = null;
  for (const row of items) {
    const cat = row.category ?? "";
    const val = row.obsrValue;
    if (cat === "T1H") tempC = parseNum(val);
    else if (cat === "REH") humidityPct = parseNum(val);
    else if (cat === "WSD") windMs = parseNum(val);
    else if (cat === "RN1") precipMm = parseNum(val);
  }
  return { tempC, humidityPct, windMs, precipMm };
}

function fcstAtIso(fcstDate: string, fcstTime: string): string {
  const y = fcstDate.slice(0, 4);
  const mo = fcstDate.slice(4, 6);
  const d = fcstDate.slice(6, 8);
  const h = fcstTime.slice(0, 2);
  const mi = fcstTime.slice(2, 4);
  return `${y}-${mo}-${d}T${h}:${mi}:00+09:00`;
}

function parseFcstItems(items: KmaItem[]): KmaForecastPoint[] {
  const byKey = new Map<
    string,
    { at: string; tempC: number | null; humidityPct: number | null }
  >();
  for (const row of items) {
    const fcstDate = row.fcstDate ?? "";
    const fcstTime = row.fcstTime ?? "";
    if (!fcstDate || !fcstTime) continue;
    const key = `${fcstDate}${fcstTime}`;
    const slot = byKey.get(key) ?? {
      at: fcstAtIso(fcstDate, fcstTime),
      tempC: null,
      humidityPct: null,
    };
    const cat = row.category ?? "";
    const val = row.fcstValue;
    if (cat === "T1H") slot.tempC = parseNum(val);
    else if (cat === "REH") slot.humidityPct = parseNum(val);
    byKey.set(key, slot);
  }
  return [...byKey.values()].sort((a, b) => a.at.localeCompare(b.at));
}

async function fetchUltraNcst(
  serviceKey: string,
  grid: KmaGrid,
  base: KmaBaseSlot,
): Promise<
  | { ok: true; items: KmaItem[]; raw: KmaApiResponse; header: { resultCode: string; resultMsg: string } }
  | { ok: false; error: string; header?: { resultCode: string; resultMsg: string } }
> {
  const url = buildUrl("getUltraSrtNcst", serviceKey, base, grid);
  const res = await fetchKmaJson(url);
  if (!res.ok) return { ok: false, error: res.error };
  const header = headerOf(res.json);
  if (header.resultCode !== "00") {
    return { ok: false, error: "kma_result", header };
  }
  return {
    ok: true,
    items: asItems(res.json.response?.body?.items?.item),
    raw: res.json,
    header,
  };
}

async function fetchUltraFcst(
  serviceKey: string,
  grid: KmaGrid,
  base: KmaBaseSlot,
): Promise<
  | { ok: true; items: KmaItem[]; raw: KmaApiResponse; header: { resultCode: string; resultMsg: string } }
  | { ok: false; error: string; header?: { resultCode: string; resultMsg: string } }
> {
  const url = buildUrl("getUltraSrtFcst", serviceKey, base, grid);
  const res = await fetchKmaJson(url);
  if (!res.ok) return { ok: false, error: res.error };
  const header = headerOf(res.json);
  if (header.resultCode !== "00") {
    return { ok: false, error: "kma_result", header };
  }
  return {
    ok: true,
    items: asItems(res.json.response?.body?.items?.item),
    raw: res.json,
    header,
  };
}

/** lat/lng → KMA 초단기 실황+예보 merge */
export async function fetchKmaReading(
  lat: number,
  lng: number,
  serviceKey: string,
  now: Date = new Date(),
): Promise<KmaFetchResult> {
  const grid = latLngToGrid(lat, lng);
  const ncstBase = resolveUltraNcstBase(now);
  const fcstBase = resolveUltraFcstBase(now);

  let ncst = await fetchUltraNcst(serviceKey, grid, ncstBase);
  if (!ncst.ok && ncst.header?.resultCode === "03") {
    const prevHour = new Date(now.getTime() - 60 * 60 * 1000);
    const fallbackBase = resolveUltraNcstBase(prevHour);
    ncst = await fetchUltraNcst(serviceKey, grid, fallbackBase);
    if (ncst.ok) {
      Object.assign(ncstBase, fallbackBase);
    }
  }

  const fcst = await fetchUltraFcst(serviceKey, grid, fcstBase);

  if (!ncst.ok && !fcst.ok) {
    return {
      ok: false,
      error: ncst.error ?? fcst.error ?? "kma_failed",
      reading: {
        fetchOk: false,
        resultCode: ncst.header?.resultCode ?? fcst.header?.resultCode ?? "ERR",
        resultMsg: ncst.header?.resultMsg ?? fcst.header?.resultMsg ?? ncst.error,
        ncstBase,
        fcstBase,
      },
    };
  }

  const ncstParsed = ncst.ok ? parseNcstItems(ncst.items) : {
    tempC: null,
    humidityPct: null,
    windMs: null,
    precipMm: null,
  };
  const forecastPoints = fcst.ok ? parseFcstItems(fcst.items) : [];

  const header = ncst.ok
    ? ncst.header
    : fcst.ok
      ? fcst.header
      : { resultCode: "ERR", resultMsg: "" };

  const reading: KmaReading = {
    ...ncstParsed,
    forecastPoints,
    ncstBase,
    fcstBase,
    resultCode: header.resultCode,
    resultMsg: header.resultMsg,
    fetchOk: ncst.ok || fcst.ok,
    rawNcst: ncst.ok ? ncst.raw : null,
    rawFcst: fcst.ok ? fcst.raw : null,
  };

  return { ok: true, reading };
}

export { latLngToGrid, resolveUltraFcstBase, resolveUltraNcstBase };
