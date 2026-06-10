"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export type SendThermoCommandResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendThermoCommandAction(
  formData: FormData
): Promise<SendThermoCommandResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const lsindRegistNo = String(formData.get("lsind_regist_no") ?? "").trim();
  const itemCode = String(formData.get("item_code") ?? "").trim();
  const moduleUid = Number(formData.get("module_uid"));
  const ctrlIdx = Number(formData.get("ctrl_idx"));
  const minVentPct = Number(formData.get("min_vent_pct"));
  const maxVentPct = Number(formData.get("max_vent_pct"));
  const setpointTemp = Number(formData.get("setpoint_temp"));
  const tempDeviation = Number(formData.get("temp_deviation"));
  const note = String(formData.get("note") ?? "").trim() || null;

  if (
    !lsindRegistNo ||
    !itemCode ||
    !Number.isInteger(moduleUid) ||
    !Number.isInteger(ctrlIdx) ||
    ctrlIdx < 0 ||
    ctrlIdx >= 50
  ) {
    return { ok: false, error: "invalid_target" };
  }

  if (
    !Number.isFinite(minVentPct) ||
    !Number.isFinite(maxVentPct) ||
    !Number.isFinite(setpointTemp) ||
    !Number.isFinite(tempDeviation)
  ) {
    return { ok: false, error: "invalid_values" };
  }

  if (
    minVentPct < 0 ||
    minVentPct > 100 ||
    maxVentPct < 0 ||
    maxVentPct > 100 ||
    minVentPct > maxVentPct
  ) {
    return { ok: false, error: "invalid_vent_range" };
  }

  if (setpointTemp < -30 || setpointTemp > 50) {
    return { ok: false, error: "invalid_setpoint" };
  }

  if (tempDeviation < 0 || tempDeviation > 20) {
    return { ok: false, error: "invalid_deviation" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ctrl_thermo_command")
    .insert({
      created_by: user.id,
      lsind_regist_no: lsindRegistNo,
      item_code: itemCode,
      module_uid: moduleUid,
      ctrl_idx: ctrlIdx,
      min_vent_pct: Math.round(minVentPct),
      max_vent_pct: Math.round(maxVentPct),
      setpoint_temp: setpointTemp,
      temp_deviation: tempDeviation,
      note,
      action: "SET_CTRL_THERMO",
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "insert_failed" };
  }

  revalidatePath("/controllers");
  return { ok: true, id: data.id as string };
}
