"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveAlarmSettings } from "@/lib/data/alarm-settings";
import { saveDisplaySettings } from "@/lib/data/display-settings";
import { savePiggyPlayerId } from "@/lib/data/piggy-settings";
import { parseDisplaySettings } from "@/lib/data/display-settings-shared";
import { validateAlarmThresholds, type AlarmSettings } from "@/lib/data/alarms";
import { saveFarmLocation, saveFarmLocationsBatch, type SaveFarmLocationInput } from "@/lib/data/farm-location";

function revalidateFarmPaths() {
  revalidatePath("/farm");
  revalidatePath("/settings");
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

  if (!lsind || !item || !sido || !sigungu) {
    redirect("/settings?tab=farm&error=invalid");
  }

  const result = await saveFarmLocation({
    farmKey: { lsindRegistNo: lsind, itemCode: item },
    sido,
    sigungu,
    addressDetail: addressDetail || undefined,
  });

  if (!result.ok) {
    if (result.error === "invalid_region") {
      redirect("/settings?tab=farm&error=invalid");
    }
    if (result.error === "forbidden") {
      redirect("/settings?tab=farm&error=forbidden");
    }
    redirect("/settings?tab=farm&error=save");
  }

  revalidateFarmPaths();
  redirect("/settings?tab=farm&ok=saved");
}

export async function saveAlarmSettingsAction(formData: FormData) {
  const raw = String(formData.get("settings_json") ?? "{}");
  let settings: AlarmSettings;
  try {
    settings = JSON.parse(raw) as AlarmSettings;
    if (!settings.global) throw new Error("invalid");
  } catch {
    redirect("/settings?tab=alarm&error=invalid");
  }

  const validationErr =
    validateAlarmThresholds(settings.global) ??
    Object.values(settings.byStallTyCode ?? {})
      .map(validateAlarmThresholds)
      .find(Boolean);
  if (validationErr) {
    redirect("/settings?tab=alarm&error=invalid");
  }

  const result = await saveAlarmSettings(settings);
  if (!result.ok) {
    redirect("/settings?tab=alarm&error=save");
  }

  revalidatePath("/alarms");
  revalidatePath("/settings");
  redirect("/settings?tab=alarm&ok=saved");
}

export async function saveDisplaySettingsAction(formData: FormData) {
  const raw = String(formData.get("settings_json") ?? "{}");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    redirect("/settings?tab=dashboard&error=invalid");
  }

  const settings = parseDisplaySettings(parsed);
  const result = await saveDisplaySettings(settings);
  if (!result.ok) {
    redirect("/settings?tab=dashboard&error=save");
  }

  revalidatePath("/", "layout");
  revalidatePath("/farm");
  revalidatePath("/controllers");
  revalidatePath("/alarms");
  revalidatePath("/settings");
  redirect("/settings?tab=dashboard&ok=saved");
}

export async function savePiggyPlayerIdAction(formData: FormData) {
  const raw = String(formData.get("player_id") ?? "").trim();

  const result = await savePiggyPlayerId(raw);
  if (!result.ok) {
    if (result.error === "invalid") {
      redirect("/settings?tab=dashboard&error=invalid");
    }
    redirect("/settings?tab=dashboard&error=save");
  }

  revalidatePath("/play");
  revalidatePath("/settings");
  redirect("/settings?tab=dashboard&ok=saved");
}
