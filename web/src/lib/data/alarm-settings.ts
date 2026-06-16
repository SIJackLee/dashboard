import "server-only";

import {
  DEFAULT_ALARM_SETTINGS,
  DEFAULT_ALARM_THRESHOLDS,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import { mergeProfileUiConfig } from "@/lib/data/profile-ui-config";
import { createClient } from "@/lib/supabase/server";

export type { AlarmSettings, AlarmThresholds };
export {
  DEFAULT_ALARM_SETTINGS,
  DEFAULT_ALARM_THRESHOLDS,
  resolveThresholds,
} from "@/lib/data/alarms";

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
  const byScope: Record<string, AlarmThresholds> = {};
  if (obj.byScope && typeof obj.byScope === "object") {
    for (const [key, val] of Object.entries(
      obj.byScope as Record<string, unknown>
    )) {
      if (key.trim()) byScope[key] = parseThresholds(val, global);
    }
  }
  return { global, byStallTyCode, byScope };
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
  const normalized = parseAlarmSettings(settings);
  return mergeProfileUiConfig((prev) => ({
    ...prev,
    alarmSettings: normalized,
  }));
}
