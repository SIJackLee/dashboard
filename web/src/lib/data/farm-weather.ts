import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { FarmKey } from "@/lib/data/farm-key";
import type { KmaForecastPoint } from "@/lib/weather/kma-types";
import { isWeatherStale } from "@/lib/weather/weather-stale";

export { isWeatherStale } from "@/lib/weather/weather-stale";

export type FarmWeatherForecastPoint = KmaForecastPoint;

export type FarmWeatherSnapshot = {
  farmKey: FarmKey;
  observedAt: string;
  gridNx: number;
  gridNy: number;
  lat: number;
  lng: number;
  tempC: number | null;
  humidityPct: number | null;
  windMs: number | null;
  precipMm: number | null;
  forecastPoints: FarmWeatherForecastPoint[];
  fetchOk: boolean;
  resultCode: string | null;
  resultMsg: string | null;
  updatedAt: string;
};

type DbRow = {
  lsind_regist_no: string;
  item_code: string;
  observed_at: string;
  grid_nx: number;
  grid_ny: number;
  lat: number;
  lng: number;
  temp_c: number | null;
  humidity_pct: number | null;
  wind_ms: number | null;
  precip_mm: number | null;
  forecast_points: FarmWeatherForecastPoint[] | null;
  fetch_ok: boolean;
  result_code: string | null;
  result_msg: string | null;
  updated_at: string;
};

const SELECT =
  "lsind_regist_no, item_code, observed_at, grid_nx, grid_ny, lat, lng, temp_c, humidity_pct, wind_ms, precip_mm, forecast_points, fetch_ok, result_code, result_msg, updated_at";

function mapRow(row: DbRow): FarmWeatherSnapshot {
  return {
    farmKey: {
      lsindRegistNo: row.lsind_regist_no,
      itemCode: row.item_code,
    },
    observedAt: row.observed_at,
    gridNx: row.grid_nx,
    gridNy: row.grid_ny,
    lat: row.lat,
    lng: row.lng,
    tempC: row.temp_c,
    humidityPct: row.humidity_pct,
    windMs: row.wind_ms,
    precipMm: row.precip_mm,
    forecastPoints: row.forecast_points ?? [],
    fetchOk: row.fetch_ok,
    resultCode: row.result_code,
    resultMsg: row.result_msg,
    updatedAt: row.updated_at,
  };
}

export async function getFarmWeatherSnapshot(
  farmKey: FarmKey,
): Promise<FarmWeatherSnapshot | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_weather_snapshot")
    .select(SELECT)
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as DbRow);
}

export function withStaleFlag(
  snapshot: FarmWeatherSnapshot,
  maxAgeMin = 20,
): FarmWeatherSnapshot & { stale: boolean } {
  return {
    ...snapshot,
    stale: isWeatherStale(snapshot.observedAt, maxAgeMin),
  };
}
