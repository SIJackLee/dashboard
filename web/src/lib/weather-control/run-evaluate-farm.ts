import "server-only";

import { createClient } from "@/lib/supabase/server";
import { farmKeyId, parseFarmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { getFarmWeatherSnapshot } from "@/lib/data/farm-weather";
import { isWeatherStale } from "@/lib/weather/weather-stale";
import { getLiveReadings } from "@/lib/data/iot";
import { getThermoCommandHistory } from "@/lib/data/commands";
import { buildControllerCandidates } from "@/lib/weather-control/build-candidates";
import { evaluateWeatherDraft } from "@/lib/weather-control/evaluate-draft";
import {
  upsertPendingRecommendation,
} from "@/lib/weather-control/recommendation-store";

export type WeatherControlConfig = {
  enabled: boolean;
  farmKeys: string[];
  targetControllerKey: string | null;
  pendingTtlMinutes: number;
};

export type RunEvaluateFarmResult =
  | { ok: true; action: "pending"; id: string; ruleId: string }
  | { ok: true; action: "cleared" | "skipped" | "no_match"; reason: string }
  | { ok: false; error: string };

async function loadConfig(): Promise<WeatherControlConfig | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weather_control_config")
    .select("enabled, farm_keys, target_controller_key, pending_ttl_minutes")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    enabled: data.enabled === true,
    farmKeys: (data.farm_keys as string[] | null) ?? [],
    targetControllerKey: data.target_controller_key ?? null,
    pendingTtlMinutes: data.pending_ttl_minutes ?? 30,
  };
}

export async function runEvaluateFarm(
  farmKey: FarmKey,
  options?: { dryRun?: boolean; config?: WeatherControlConfig | null },
): Promise<RunEvaluateFarmResult> {
  const config = options?.config ?? (await loadConfig());
  if (!config?.enabled) {
    return { ok: true, action: "skipped", reason: "disabled" };
  }

  const farmId = farmKeyId(farmKey);
  if (!config.farmKeys.includes(farmId)) {
    return { ok: true, action: "skipped", reason: "farm_not_in_allowlist" };
  }

  const weather = await getFarmWeatherSnapshot(farmKey);
  if (!weather?.fetchOk || weather.tempC == null) {
    return { ok: true, action: "skipped", reason: "weather_unavailable" };
  }
  if (isWeatherStale(weather.observedAt, 20)) {
    return { ok: true, action: "skipped", reason: "weather_stale" };
  }

  const readings = await getLiveReadings({ farmKey, slim: true });
  const commands = await getThermoCommandHistory(200, { q: farmId });
  const candidates = buildControllerCandidates(readings, commands);

  const draft = evaluateWeatherDraft({
    weather: {
      tempC: weather.tempC,
      humidityPct: weather.humidityPct,
      forecastPoints: weather.forecastPoints,
      observedAt: weather.observedAt,
    },
    candidates,
    targetControllerKey: config.targetControllerKey,
    pendingTtlMinutes: config.pendingTtlMinutes,
  });

  if (options?.dryRun) {
    if (!draft) {
      return { ok: true, action: "no_match", reason: "no_rule" };
    }
    return {
      ok: true,
      action: "pending",
      id: "dry-run",
      ruleId: draft.ruleId,
    };
  }

  const supabase = await createClient();
  const c = draft?.controller;

  if (!draft || !c) {
    await supabase
      .from("weather_control_recommendation")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("lsind_regist_no", farmKey.lsindRegistNo)
      .eq("item_code", farmKey.itemCode)
      .eq("status", "pending");
    return { ok: true, action: "no_match", reason: "no_rule" };
  }

  const saved = await upsertPendingRecommendation(supabase, draft);
  if (!saved.ok) return { ok: false, error: saved.error };

  return {
    ok: true,
    action: "pending",
    id: saved.id,
    ruleId: draft.ruleId,
  };
}

export async function runEvaluateAllConfiguredFarms(options?: {
  dryRun?: boolean;
}): Promise<Record<string, RunEvaluateFarmResult>> {
  const config = await loadConfig();
  if (!config?.enabled) return {};

  const out: Record<string, RunEvaluateFarmResult> = {};
  for (const key of config.farmKeys) {
    const farmKey = parseFarmKeyId(key);
    if (!farmKey) continue;
    out[key] = await runEvaluateFarm(farmKey, { ...options, config });
  }
  return out;
}
