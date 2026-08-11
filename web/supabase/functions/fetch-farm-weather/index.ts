import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchKmaReading } from "./kma-client.ts";
import { latLngToGrid } from "./kma-grid.ts";
import type { KmaReading } from "./kma-types.ts";
import { runWeatherEvaluate, type WxConfig } from "./evaluate-runner.ts";

type WeatherFetchConfig = {
  enabled: boolean;
  farm_keys: string[] | null;
};

type FarmLocationRow = {
  lsind_regist_no: string;
  item_code: string;
  lat: number;
  lng: number;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", Connection: "keep-alive" },
  });

function parseFarmKey(key: string): { lsind: string; item: string } | null {
  const slash = key.indexOf("/");
  if (slash <= 0) return null;
  const lsind = key.slice(0, slash).trim();
  const item = key.slice(slash + 1).trim();
  if (!lsind || !item) return null;
  return { lsind, item };
}

function snapshotPayload(
  farm: FarmLocationRow,
  reading: KmaReading,
  observedAt: string,
) {
  const grid = latLngToGrid(farm.lat, farm.lng);
  return {
    lsind_regist_no: farm.lsind_regist_no,
    item_code: farm.item_code,
    observed_at: observedAt,
    grid_nx: grid.nx,
    grid_ny: grid.ny,
    lat: farm.lat,
    lng: farm.lng,
    kma_ncst_base_date: reading.ncstBase.baseDate,
    kma_ncst_base_time: reading.ncstBase.baseTime,
    kma_fcst_base_date: reading.fcstBase.baseDate,
    kma_fcst_base_time: reading.fcstBase.baseTime,
    temp_c: reading.tempC,
    humidity_pct: reading.humidityPct,
    wind_ms: reading.windMs,
    precip_mm: reading.precipMm,
    forecast_points: reading.forecastPoints,
    fetch_ok: reading.fetchOk,
    result_code: reading.resultCode,
    result_msg: reading.resultMsg,
    raw_ncst: reading.rawNcst,
    raw_fcst: reading.rawFcst,
    updated_at: observedAt,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const kmaKey = Deno.env.get("KMA_DATA_API_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "missing_supabase_env" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: iotCfg, error: iotCfgErr } = await supabase
    .from("iot_decode_config")
    .select("cron_secret")
    .eq("id", 1)
    .single();

  if (iotCfgErr || !iotCfg?.cron_secret) {
    return json({ error: "config_unavailable" }, 500);
  }

  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${iotCfg.cron_secret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const { data: wxCfg, error: wxCfgErr } = await supabase
    .from("weather_fetch_config")
    .select("enabled, farm_keys")
    .eq("id", 1)
    .single();

  if (wxCfgErr || !wxCfg) {
    return json({ error: "weather_config_unavailable", detail: wxCfgErr?.message }, 500);
  }

  const cfg = wxCfg as WeatherFetchConfig;
  if (!cfg.enabled) {
    return json({ ok: true, skipped: true, reason: "disabled" });
  }

  if (!kmaKey) {
    return json({ error: "missing_kma_api_key" }, 500);
  }

  const { data: wxCtrlCfg } = await supabase
    .from("weather_control_config")
    .select(
      "enabled, farm_keys, target_controller_key, pending_ttl_minutes, eval_after_weather_fetch",
    )
    .eq("id", 1)
    .single();

  const wxCtrl = wxCtrlCfg as WxConfig | null;

  const farmKeys = (cfg.farm_keys ?? []).filter(Boolean);
  if (farmKeys.length === 0) {
    return json({ ok: true, skipped: true, reason: "empty_farm_keys" });
  }

  const observedAt = new Date().toISOString();
  const results: Record<string, unknown>[] = [];

  for (const farmKey of farmKeys) {
    const parsed = parseFarmKey(farmKey);
    if (!parsed) {
      results.push({ farmKey, ok: false, error: "invalid_farm_key" });
      continue;
    }

    const { data: loc, error: locErr } = await supabase
      .from("farm_location")
      .select("lsind_regist_no, item_code, lat, lng")
      .eq("lsind_regist_no", parsed.lsind)
      .eq("item_code", parsed.item)
      .maybeSingle();

    if (locErr || !loc) {
      results.push({ farmKey, ok: false, error: "farm_location_missing" });
      continue;
    }

    const farm = loc as FarmLocationRow;
    const kma = await fetchKmaReading(farm.lat, farm.lng, kmaKey);

    if (!kma.ok || !kma.reading.fetchOk) {
      const failPatch = {
        observed_at: observedAt,
        fetch_ok: false,
        result_code: kma.reading.resultCode ?? "ERR",
        result_msg: kma.reading.resultMsg ?? kma.ok ? "" : kma.error,
        updated_at: observedAt,
      };

      const { data: existing } = await supabase
        .from("farm_weather_snapshot")
        .select("lsind_regist_no")
        .eq("lsind_regist_no", farm.lsind_regist_no)
        .eq("item_code", farm.item_code)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("farm_weather_snapshot")
          .update(failPatch)
          .eq("lsind_regist_no", farm.lsind_regist_no)
          .eq("item_code", farm.item_code);
      } else {
        const grid = latLngToGrid(farm.lat, farm.lng);
        await supabase.from("farm_weather_snapshot").insert({
          lsind_regist_no: farm.lsind_regist_no,
          item_code: farm.item_code,
          grid_nx: grid.nx,
          grid_ny: grid.ny,
          lat: farm.lat,
          lng: farm.lng,
          kma_ncst_base_date: kma.reading.ncstBase?.baseDate ?? "00000000",
          kma_ncst_base_time: kma.reading.ncstBase?.baseTime ?? "0000",
          kma_fcst_base_date: kma.reading.fcstBase?.baseDate ?? "00000000",
          kma_fcst_base_time: kma.reading.fcstBase?.baseTime ?? "0000",
          forecast_points: [],
          ...failPatch,
        });
      }

      results.push({
        farmKey,
        ok: false,
        error: kma.ok ? "kma_partial_fail" : kma.error,
        fetchOk: false,
      });
      continue;
    }

    const payload = snapshotPayload(farm, kma.reading, observedAt);
    const { error: upsertErr } = await supabase
      .from("farm_weather_snapshot")
      .upsert(payload, { onConflict: "lsind_regist_no,item_code" });

    results.push({
      farmKey,
      ok: !upsertErr,
      fetchOk: true,
      tempC: kma.reading.tempC,
      humidityPct: kma.reading.humidityPct,
      error: upsertErr?.message,
    });

    if (!upsertErr && wxCtrl && kma.reading.tempC != null) {
      const evalResult = await runWeatherEvaluate(
        supabase,
        {
          lsindRegistNo: farm.lsind_regist_no,
          itemCode: farm.item_code,
        },
        {
          tempC: kma.reading.tempC,
          humidityPct: kma.reading.humidityPct,
          forecastPoints: kma.reading.forecastPoints,
          observedAt,
        },
        wxCtrl,
      );
      results[results.length - 1] = {
        ...results[results.length - 1],
        evaluate: evalResult,
      };
    }
    continue;
  }

  return json({ ok: true, observedAt, farms: results });
});
