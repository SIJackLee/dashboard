"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveAlarmSettings } from "@/lib/data/alarm-settings";
import { saveDisplaySettings } from "@/lib/data/display-settings";
import { savePiggyPlayerId } from "@/lib/data/piggy-settings";
import type { DisplaySettings } from "@/lib/data/display-settings-shared";
import { validateAlarmThresholds, type AlarmSettings } from "@/lib/data/alarms";
import { saveBarnMetas, type BarnMeta } from "@/lib/data/barn-meta";
import {
  saveControllerMetas,
  type ControllerMetaEntry,
} from "@/lib/data/controller-meta";
import { saveFarmLocation } from "@/lib/data/farm-location";

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
    redirect("/settings?tab=farm&error=save");
  }

  revalidatePath("/farm");
  revalidatePath("/settings");
  redirect("/settings?tab=farm&ok=saved");
}

export async function saveBarnMetasAction(formData: FormData) {
  const raw = String(formData.get("barns_json") ?? "[]");
  let barns: BarnMeta[];
  try {
    barns = JSON.parse(raw) as BarnMeta[];
    if (!Array.isArray(barns)) throw new Error("invalid");
  } catch {
    redirect("/settings?tab=barn&error=invalid");
  }

  const result = await saveBarnMetas(barns);
  if (!result.ok) {
    redirect("/settings?tab=barn&error=save");
  }

  revalidatePath("/farm");
  revalidatePath("/settings");
  redirect("/settings?tab=barn&ok=saved");
}

export async function saveControllerMetasAction(formData: FormData) {
  const raw = String(formData.get("controllers_json") ?? "[]");
  let controllers: ControllerMetaEntry[];
  try {
    controllers = JSON.parse(raw) as ControllerMetaEntry[];
    if (!Array.isArray(controllers)) throw new Error("invalid");
  } catch {
    redirect("/settings?tab=controller&error=invalid");
  }

  const result = await saveControllerMetas(controllers);
  if (!result.ok) {
    redirect("/settings?tab=controller&error=save");
  }

  revalidatePath("/controllers");
  revalidatePath("/settings");
  redirect("/settings?tab=controller&ok=saved");
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
  let settings: DisplaySettings;
  try {
    settings = JSON.parse(raw) as DisplaySettings;
  } catch {
    redirect("/settings?tab=dashboard&error=invalid");
  }

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
