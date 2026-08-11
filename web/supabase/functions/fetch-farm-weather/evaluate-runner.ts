import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { evaluateWeatherDraft } from "./wx-control/evaluate-draft.ts";
import type {
  ControllerCandidate,
  FarmKey,
  SettingsSource,
  ThermoValues,
  WeatherRecommendationDraft,
} from "./wx-control/types.ts";
import type { KmaForecastPoint } from "./kma-types.ts";

type WxConfig = {
  enabled: boolean;
  farm_keys: string[] | null;
  target_controller_key: string | null;
  pending_ttl_minutes: number;
  eval_after_weather_fetch: boolean;
};

type ListRow = {
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  controller_key: string;
  eqpmn_no: string | null;
  stall_ty_code: string | null;
  stall_no: string | null;
  temp_c: number | null;
  humidity_pct: number | null;
  setpoint_temp: number | null;
  temp_deviation: number | null;
  min_vent_pct: number | null;
  max_vent_pct: number | null;
  received_at: string;
  packet_mode: string | null;
};

type CmdRow = {
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  controller_key: string | null;
  stall_ty_code: string | null;
  stall_no: string | null;
  eqpmn_no: string | null;
  min_vent_pct: number;
  max_vent_pct: number;
  setpoint_temp: string | number;
  temp_deviation: string | number;
  status: string;
  created_at: string;
  sent_at: string | null;
  applied_at: string | null;
  channel: string | null;
};

const LIST_COLS =
  "lsind_regist_no, item_code, module_uid, controller_key, eqpmn_no, stall_ty_code, stall_no, temp_c, humidity_pct, setpoint_temp, temp_deviation, min_vent_pct, max_vent_pct, received_at, packet_mode";

function farmKeyId(fk: FarmKey): string {
  return `${fk.lsindRegistNo}/${fk.itemCode}`;
}

function statusFromAge(receivedAt: string): "normal" | "caution" | "offline" {
  const ageMin = (Date.now() - new Date(receivedAt).getTime()) / 60000;
  if (ageMin <= 15) return "normal";
  if (ageMin <= 60) return "caution";
  return "offline";
}

function thermoKey(
  fk: FarmKey,
  moduleUid: number,
  controllerKey: string,
  channel?: string,
): string {
  const base = `${farmKeyId(fk)}:${moduleUid}:${controllerKey}`;
  return channel ? `${base}:${channel}` : base;
}

function parseThermo(row: ListRow): ThermoValues | null {
  if (
    row.setpoint_temp == null ||
    row.temp_deviation == null ||
    row.min_vent_pct == null ||
    row.max_vent_pct == null
  ) {
    return null;
  }
  return {
    setpointTemp: Number(row.setpoint_temp),
    tempDeviation: Number(row.temp_deviation),
    minVentPct: Number(row.min_vent_pct),
    maxVentPct: Number(row.max_vent_pct),
  };
}

function buildCommandMap(commands: CmdRow[]): Record<
  string,
  { settings: ThermoValues; source: SettingsSource; updatedAt: string }
> {
  const out: Record<
    string,
    { settings: ThermoValues; source: SettingsSource; updatedAt: string }
  > = {};

  for (const cmd of commands) {
    if (cmd.status === "failed" || cmd.status === "cancelled") continue;
    if (!cmd.controller_key) continue;
    const fk: FarmKey = {
      lsindRegistNo: cmd.lsind_regist_no,
      itemCode: cmd.item_code,
    };
    const key = thermoKey(
      fk,
      cmd.module_uid,
      cmd.controller_key,
      cmd.channel ?? undefined,
    );
    const settings: ThermoValues = {
      setpointTemp: Number(cmd.setpoint_temp),
      tempDeviation: Number(cmd.temp_deviation),
      minVentPct: cmd.min_vent_pct,
      maxVentPct: cmd.max_vent_pct,
    };
    const source: SettingsSource =
      cmd.status === "pending"
        ? "pending"
        : cmd.status === "applied"
          ? "applied"
          : "sent";
    const updatedAt = cmd.applied_at ?? cmd.sent_at ?? cmd.created_at;
    const existing = out[key];
    if (existing && existing.updatedAt >= updatedAt) continue;
    out[key] = { settings, source, updatedAt };
  }
  return out;
}

function buildCandidates(
  rows: ListRow[],
  commandMap: ReturnType<typeof buildCommandMap>,
): ControllerCandidate[] {
  const out: ControllerCandidate[] = [];
  for (const row of rows) {
    if (row.packet_mode !== "live") continue;
    const status = statusFromAge(row.received_at);
    if (status === "offline") continue;
    const thermo = parseThermo(row);
    if (!thermo) continue;

    const fk: FarmKey = {
      lsindRegistNo: row.lsind_regist_no,
      itemCode: row.item_code,
    };
    const cmdEntry =
      commandMap[thermoKey(fk, row.module_uid, row.controller_key)] ??
      commandMap[thermoKey(fk, row.module_uid, row.controller_key, "A")];

    const current = cmdEntry?.settings ?? thermo;
    const settingsSource = cmdEntry?.source ?? "live";

    const parts = row.controller_key.split(":");
    out.push({
      farmKey: fk,
      moduleUid: row.module_uid,
      controllerKey: row.controller_key,
      stallTyCode: row.stall_ty_code ?? parts[0] ?? "SP01",
      stallNo: row.stall_no ?? parts[1] ?? "01",
      eqpmnNo: row.eqpmn_no ?? parts[2] ?? "01",
      label: row.controller_key,
      tempC: row.temp_c != null ? Number(row.temp_c) : null,
      humidityPct: row.humidity_pct != null ? Number(row.humidity_pct) : null,
      status,
      current,
      settingsSource,
      liveReceivedAt: row.received_at,
    });
  }
  return out;
}

function isWeatherStale(observedAt: string, maxAgeMin = 20): boolean {
  return Date.now() - new Date(observedAt).getTime() > maxAgeMin * 60 * 1000;
}

async function upsertDraft(
  supabase: SupabaseClient,
  draft: WeatherRecommendationDraft,
): Promise<string | null> {
  const c = draft.controller;
  const payload = {
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

  const { data: existing } = await supabase
    .from("weather_control_recommendation")
    .select("id")
    .eq("lsind_regist_no", c.farmKey.lsindRegistNo)
    .eq("item_code", c.farmKey.itemCode)
    .eq("controller_key", c.controllerKey)
    .eq("status", "pending")
    .maybeSingle();

  if (existing?.id) {
    const { data } = await supabase
      .from("weather_control_recommendation")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();
    return (data?.id as string) ?? null;
  }

  const { data } = await supabase
    .from("weather_control_recommendation")
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select("id")
    .single();
  return (data?.id as string) ?? null;
}

export async function runWeatherEvaluate(
  supabase: SupabaseClient,
  farmKey: FarmKey,
  weather: {
    tempC: number;
    humidityPct: number | null;
    forecastPoints: KmaForecastPoint[];
    observedAt: string;
  },
  config: WxConfig,
): Promise<{ action: string; ruleId?: string; id?: string }> {
  if (!config.enabled || !config.eval_after_weather_fetch) {
    return { action: "skipped" };
  }

  const farmId = farmKeyId(farmKey);
  if (!(config.farm_keys ?? []).includes(farmId)) {
    return { action: "skipped" };
  }

  if (isWeatherStale(weather.observedAt, 20)) {
    return { action: "skipped" };
  }

  const { data: listRows } = await supabase
    .from("v_iot_dashboard_list")
    .select(LIST_COLS)
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode);

  const { data: cmdRows } = await supabase
    .from("ctrl_thermo_command")
    .select(
      "lsind_regist_no, item_code, module_uid, controller_key, stall_ty_code, stall_no, eqpmn_no, min_vent_pct, max_vent_pct, setpoint_temp, temp_deviation, status, created_at, sent_at, applied_at, channel",
    )
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode)
    .order("created_at", { ascending: false })
    .limit(200);

  const commandMap = buildCommandMap((cmdRows ?? []) as CmdRow[]);
  const candidates = buildCandidates((listRows ?? []) as ListRow[], commandMap);

  const draft = evaluateWeatherDraft({
    weather: {
      tempC: weather.tempC,
      humidityPct: weather.humidityPct,
      forecastPoints: weather.forecastPoints,
      observedAt: weather.observedAt,
    },
    candidates,
    targetControllerKey: config.target_controller_key,
    pendingTtlMinutes: config.pending_ttl_minutes ?? 30,
  });

  if (!draft) {
    await supabase
      .from("weather_control_recommendation")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("lsind_regist_no", farmKey.lsindRegistNo)
      .eq("item_code", farmKey.itemCode)
      .eq("status", "pending");
    return { action: "no_match" };
  }

  const id = await upsertDraft(supabase, draft);
  return { action: "pending", ruleId: draft.ruleId, id: id ?? undefined };
}

export type { WxConfig };
