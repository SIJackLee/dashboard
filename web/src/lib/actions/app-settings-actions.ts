"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminOpsHref } from "@/lib/admin/ops-tabs";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { saveAlarmSettings } from "@/lib/data/alarm-settings";
import { saveDisplaySettings } from "@/lib/data/display-settings";
import { savePiggyPlayerId } from "@/lib/data/piggy-settings";
import { parseDisplaySettings } from "@/lib/data/display-settings-shared";
import { validateAlarmThresholds, type AlarmSettings } from "@/lib/data/alarms";
import {
  saveFarmLocation,
  saveFarmLocationsBatch,
  type SaveFarmLocationInput,
} from "@/lib/data/farm-location";
import {
  devicesAlarmSettingsHref,
  devicesDisplayPanelHref,
  devicesFarmPanelHref,
} from "@/lib/monitoring/devices-panel";

function revalidateFarmPaths() {
  revalidatePath("/farm");
}

export async function saveFarmLocationInlineAction(
  input: SaveFarmLocationInput
): Promise<{ ok: boolean; error?: string }> {
  const result = await saveFarmLocation(input);
  if (result.ok) revalidateFarmPaths();
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function saveFarmLocationsBatchInlineAction(
  inputs: SaveFarmLocationInput[]
): Promise<{
  ok: boolean;
  saved: number;
  failed: { lsindRegistNo: string; itemCode: string; error: string }[];
}> {
  const result = await saveFarmLocationsBatch(inputs);
  if (result.saved > 0) revalidateFarmPaths();
  return {
    ok: result.ok,
    saved: result.saved,
    failed: result.failed.map((f) => ({
      lsindRegistNo: f.farmKey.lsindRegistNo,
      itemCode: f.farmKey.itemCode,
      error: f.error,
    })),
  };
}

export async function saveFarmLocationAction(formData: FormData) {
  const lsind = String(formData.get("lsind") ?? "").trim();
  const item = String(formData.get("item") ?? "").trim();
  const sido = String(formData.get("sido") ?? "").trim();
  const sigungu = String(formData.get("sigungu") ?? "").trim();
  const addressDetail = String(formData.get("address_detail") ?? "").trim();
  const farmKey = lsind && item ? { lsindRegistNo: lsind, itemCode: item } : undefined;

  if (!lsind || !item || !sido || !sigungu) {
    redirect(`${devicesFarmPanelHref(farmKey)}&error=invalid`);
  }

  const result = await saveFarmLocation({
    farmKey: { lsindRegistNo: lsind, itemCode: item },
    sido,
    sigungu,
    addressDetail: addressDetail || undefined,
  });

  if (!result.ok) {
    if (result.error === "invalid_region") {
      redirect(`${devicesFarmPanelHref(farmKey)}&error=invalid`);
    }
    if (result.error === "forbidden") {
      redirect(`${devicesFarmPanelHref(farmKey)}&error=forbidden`);
    }
    redirect(`${devicesFarmPanelHref(farmKey)}&error=save`);
  }

  revalidateFarmPaths();
  redirect(`${devicesFarmPanelHref(farmKey)}&ok=saved`);
}

export async function saveAlarmSettingsAction(formData: FormData) {
  const raw = String(formData.get("settings_json") ?? "{}");
  let settings: AlarmSettings;
  try {
    settings = JSON.parse(raw) as AlarmSettings;
    if (!settings.global) throw new Error("invalid");
  } catch {
    redirect(`${devicesAlarmSettingsHref()}&error=invalid`);
  }

  const validationErr =
    validateAlarmThresholds(settings.global) ??
    Object.values(settings.byStallTyCode ?? {})
      .map(validateAlarmThresholds)
      .find(Boolean) ??
    Object.values(settings.byScope ?? {})
      .map(validateAlarmThresholds)
      .find(Boolean);
  if (validationErr) {
    redirect(`${devicesAlarmSettingsHref()}&error=invalid`);
  }

  const result = await saveAlarmSettings(settings);
  if (!result.ok) {
    redirect(`${devicesAlarmSettingsHref()}&error=save`);
  }

  revalidatePath("/alarms");
  revalidatePath("/farm");
  redirect(`${devicesAlarmSettingsHref()}&ok=saved`);
}

export async function saveDisplaySettingsAction(formData: FormData) {
  const user = await getCurrentUser();
  const isAdmin = Boolean(user?.isAdmin);
  const successRedirect = isAdmin
    ? `${adminOpsHref("display")}&ok=saved`
    : `${devicesDisplayPanelHref()}&ok=saved`;
  const invalidRedirect = isAdmin
    ? `${adminOpsHref("display")}&error=invalid`
    : `${devicesDisplayPanelHref()}&error=invalid`;
  const saveErrorRedirect = isAdmin
    ? `${adminOpsHref("display")}&error=save`
    : `${devicesDisplayPanelHref()}&error=save`;

  const raw = String(formData.get("settings_json") ?? "{}");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    redirect(invalidRedirect);
  }

  const settings = parseDisplaySettings(parsed);
  const result = await saveDisplaySettings(settings);
  if (!result.ok) {
    redirect(saveErrorRedirect);
  }

  revalidatePath("/", "layout");
  revalidatePath("/farm");
  revalidatePath("/controllers");
  revalidatePath("/alarms");
  revalidatePath("/admin/ops");
  redirect(successRedirect);
}

export async function savePiggyPlayerIdAction(formData: FormData) {
  const raw = String(formData.get("player_id") ?? "").trim();

  const result = await savePiggyPlayerId(raw);
  if (!result.ok) {
    if (result.error === "invalid") {
      redirect("/play?error=invalid");
    }
    redirect("/play?error=save");
  }

  revalidatePath("/play");
  redirect("/play?ok=saved");
}
