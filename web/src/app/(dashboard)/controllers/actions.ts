"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canCommand, getCurrentUser } from "@/lib/auth/get-current-user";
import { upsertControllerDisplayName } from "@/lib/data/controller-meta";
import { normalizeEqpmnNo } from "@/lib/data/controller-key";

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
  const stallTyCode = String(formData.get("stall_ty_code") ?? "").trim();
  const stallNo = String(formData.get("stall_no") ?? "").trim();
  const eqpmnNo = normalizeEqpmnNo(formData.get("eqpmn_no") ?? "01");
  const minVentPct = Number(formData.get("min_vent_pct"));
  const maxVentPct = Number(formData.get("max_vent_pct"));
  const setpointTemp = Number(formData.get("setpoint_temp"));
  const tempDeviation = Number(formData.get("temp_deviation"));
  const note = String(formData.get("note") ?? "").trim() || null;
  const channelRaw = String(formData.get("channel") ?? "").trim().toUpperCase();
  const channel =
    channelRaw === "A" || channelRaw === "B" || channelRaw === "C"
      ? channelRaw
      : null;
  const eqpmnCode = String(formData.get("eqpmn_code") ?? "").trim() || null;
  const action =
    channel && eqpmnCode ? "SET_CHANNEL_THERMO" : "SET_CTRL_THERMO";

  if (
    !lsindRegistNo ||
    !itemCode ||
    !Number.isInteger(moduleUid) ||
    !stallTyCode ||
    !/^SP(0[1-9]|10)$/.test(stallTyCode) ||
    !stallNo ||
    !/^(0[1-9]|[12][0-9]|3[0-2])$/.test(stallNo)
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

  if (channel && !/^EC(0[1-9]|[1-9][0-9])$/.test(eqpmnCode ?? "")) {
    return { ok: false, error: "invalid_eqpmn_code" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ctrl_thermo_command")
    .insert({
      created_by: user.id,
      lsind_regist_no: lsindRegistNo,
      item_code: itemCode,
      module_uid: moduleUid,
      ctrl_idx: Math.max(0, parseInt(eqpmnNo, 10) - 1),
      stall_ty_code: stallTyCode,
      stall_no: stallNo,
      eqpmn_no: eqpmnNo,
      channel,
      eqpmn_code: eqpmnCode,
      min_vent_pct: Math.round(minVentPct),
      max_vent_pct: Math.round(maxVentPct),
      setpoint_temp: setpointTemp,
      temp_deviation: tempDeviation,
      note,
      action,
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

export async function saveControllerDisplayNameAction(
  controllerKey: string,
  eqpmnNo: string,
  displayName: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (!canCommand(user)) return { ok: false, error: "forbidden" };

  if (!controllerKey.trim()) {
    return { ok: false, error: "invalid_controller_key" };
  }

  const trimmed = displayName.trim();
  if (trimmed.length > 32) {
    return { ok: false, error: "name_too_long" };
  }

  const result = await upsertControllerDisplayName(
    controllerKey,
    eqpmnNo,
    trimmed
  );
  if (!result.ok) return result;

  revalidatePath("/controllers");
  revalidatePath("/alarms");
  return { ok: true };
}
