import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_DISPLAY_SETTINGS,
  parseDisplaySettings,
  type DisplaySettings,
} from "@/lib/data/display-settings-shared";

export type {
  DisplaySettingKey,
  DisplaySettings,
} from "@/lib/data/display-settings-shared";

export {
  DEFAULT_DISPLAY_SETTINGS,
  DISPLAY_SETTING_GROUPS,
  isDisplayEnabled,
} from "@/lib/data/display-settings-shared";

export async function getDisplaySettings(): Promise<DisplaySettings> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_DISPLAY_SETTINGS;

  const { data, error } = await supabase
    .from("profiles")
    .select("ui_config")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return DEFAULT_DISPLAY_SETTINGS;
  const cfg = data.ui_config as Record<string, unknown> | null;
  return parseDisplaySettings(cfg?.displaySettings);
}

export async function saveDisplaySettings(
  settings: DisplaySettings
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

  const ui_config = { ...prev, displaySettings: settings };

  const { error } = await supabase
    .from("profiles")
    .update({ ui_config })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
