import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_ALARM_SETTINGS,
  DEFAULT_ALARM_THRESHOLDS,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";

export type { AlarmSettings, AlarmThresholds };
export { DEFAULT_ALARM_SETTINGS, DEFAULT_ALARM_THRESHOLDS, resolveThresholds } from "@/lib/data/alarms";

function parseThresholds(raw: unknown, fallback: AlarmThresholds): AlarmThresholds {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const num = (k: keyof AlarmThresholds) => {
    const v = Number(o[k]);
    return Number.isFinite(v) ? v : fallback[k];
  };
  return {
    tempHigh: num("tempHigh"),
    tempLow: num("tempLow"),
    humidityHigh: num("humidityHigh"),
    humidityLow: num("humidityLow"),
  };
}

function parseAlarmSettings(raw: unknown): AlarmSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_ALARM_SETTINGS;
  const obj = raw as Record<string, unknown>;
  const global = parseThresholds(obj.global, DEFAULT_ALARM_THRESHOLDS);
  const byStallTyCode: Record<string, AlarmThresholds> = {};
  if (obj.byStallTyCode && typeof obj.byStallTyCode === "object") {
    for (const [code, val] of Object.entries(
      obj.byStallTyCode as Record<string, unknown>
    )) {
      if (code.trim()) byStallTyCode[code] = parseThresholds(val, global);
    }
  }
  return { global, byStallTyCode };
}

export async function getAlarmSettings(): Promise<AlarmSettings> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_ALARM_SETTINGS;

  const { data, error } = await supabase
    .from("profiles")
    .select("ui_config")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return DEFAULT_ALARM_SETTINGS;
  const cfg = data.ui_config as Record<string, unknown> | null;
  return parseAlarmSettings(cfg?.alarmSettings);
}

export async function saveAlarmSettings(
  settings: AlarmSettings
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data, error: loadErr } = await supabase
    .from("profiles")
    .select("ui_config")
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };

  const prev =
    data?.ui_config && typeof data.ui_config === "object"
      ? (data.ui_config as Record<string, unknown>)
      : {};

  const ui_config = { ...prev, alarmSettings: settings };

  const { error } = await supabase
    .from("profiles")
    .update({ ui_config })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
