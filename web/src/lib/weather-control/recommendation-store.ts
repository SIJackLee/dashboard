import type { SupabaseClient } from "@supabase/supabase-js";
import type { WeatherRecommendationDraft } from "@/lib/weather-control/types";

type DbRow = {
  id: string;
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  controller_key: string;
  stall_ty_code: string;
  stall_no: string;
  eqpmn_no: string;
  status: string;
  rule_id: string;
  current_setpoint_temp: number;
  current_temp_deviation: number;
  current_min_vent_pct: number;
  current_max_vent_pct: number;
  proposed_setpoint_temp: number;
  proposed_temp_deviation: number;
  proposed_min_vent_pct: number;
  proposed_max_vent_pct: number;
  internal_temp_c: number | null;
  internal_humidity_pct: number | null;
  external_temp_c: number | null;
  external_humidity_pct: number | null;
  reason_ko: string;
  reason_facts: Record<string, number>;
  weather_observed_at: string;
  live_received_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

function draftToRow(draft: WeatherRecommendationDraft) {
  const c = draft.controller;
  return {
    lsind_regist_no: c.farmKey.lsindRegistNo,
    item_code: c.farmKey.itemCode,
    module_uid: c.moduleUid,
    controller_key: c.controllerKey,
    stall_ty_code: c.stallTyCode,
    stall_no: c.stallNo,
    eqpmn_no: c.eqpmnNo,
    status: "pending",
    rule_id: draft.ruleId,
    current_setpoint_temp: c.current.setpointTemp,
    current_temp_deviation: c.current.tempDeviation,
    current_min_vent_pct: c.current.minVentPct,
    current_max_vent_pct: c.current.maxVentPct,
    proposed_setpoint_temp: draft.proposed.setpointTemp,
    proposed_temp_deviation: draft.proposed.tempDeviation,
    proposed_min_vent_pct: draft.proposed.minVentPct,
    proposed_max_vent_pct: draft.proposed.maxVentPct,
    internal_temp_c: c.tempC,
    internal_humidity_pct: c.humidityPct,
    external_temp_c: draft.externalTempC,
    external_humidity_pct: draft.externalHumidityPct,
    reason_ko: draft.reasonKo,
    reason_facts: draft.reasonFacts,
    weather_observed_at: draft.weatherObservedAt,
    live_received_at: c.liveReceivedAt,
    expires_at: draft.expiresAt,
    updated_at: new Date().toISOString(),
  };
}

export async function clearPendingRecommendation(
  client: SupabaseClient,
  lsind: string,
  item: string,
  controllerKey: string,
): Promise<void> {
  await client
    .from("weather_control_recommendation")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("lsind_regist_no", lsind)
    .eq("item_code", item)
    .eq("controller_key", controllerKey)
    .eq("status", "pending");
}

export async function upsertPendingRecommendation(
  client: SupabaseClient,
  draft: WeatherRecommendationDraft,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const c = draft.controller;
  const payload = draftToRow(draft);

  const { data: existing } = await client
    .from("weather_control_recommendation")
    .select("id")
    .eq("lsind_regist_no", c.farmKey.lsindRegistNo)
    .eq("item_code", c.farmKey.itemCode)
    .eq("controller_key", c.controllerKey)
    .eq("status", "pending")
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await client
      .from("weather_control_recommendation")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "update_failed" };
    }
    return { ok: true, id: data.id as string };
  }

  const { data, error } = await client
    .from("weather_control_recommendation")
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "insert_failed" };
  }
  return { ok: true, id: data.id as string };
}

export type PendingRecommendationRow = DbRow;

export async function fetchPendingRecommendation(
  client: SupabaseClient,
  lsind: string,
  item: string,
): Promise<DbRow | null> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("weather_control_recommendation")
    .select("*")
    .eq("lsind_regist_no", lsind)
    .eq("item_code", item)
    .eq("status", "pending")
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as DbRow;
}

export async function dismissPendingRecommendation(
  client: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await client.rpc("dismiss_weather_control_recommendation", {
    p_id: id,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  if (data !== true) {
    return { ok: false, error: "dismiss_failed" };
  }
  return { ok: true };
}

export async function fetchRecommendationById(
  client: SupabaseClient,
  id: string,
): Promise<PendingRecommendationRow | null> {
  const { data, error } = await client
    .from("weather_control_recommendation")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as PendingRecommendationRow;
}

export async function markRecommendationApproved(
  client: SupabaseClient,
  id: string,
  commandId: string,
  approvedBy: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await client.rpc(
    "approve_weather_control_recommendation",
    {
      p_id: id,
      p_command_id: commandId,
      p_approved_by: approvedBy,
    },
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  if (data !== true) {
    return { ok: false, error: "approve_failed" };
  }
  return { ok: true };
}
