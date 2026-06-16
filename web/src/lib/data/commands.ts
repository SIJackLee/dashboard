import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  controllerKeyFromParts,
  legacyControllerKey,
  normalizeEqpmnNo,
} from "@/lib/data/controller-key";
import type { FarmKey } from "@/lib/data/farm-key";

export type ThermoCommandStatus =
  | "pending"
  | "sent"
  | "applied"
  | "failed"
  | "cancelled";

export type ThermoCommand = {
  id: string;
  createdAt: string;
  sentAt: string | null;
  appliedAt: string | null;
  farmKey: FarmKey;
  moduleUid: number;
  controllerKey: string;
  stallTyCode: string;
  stallNo: string;
  eqpmnNo: string;
  /** @deprecated legacy v0x09 */
  ctrlIdx?: number;
  minVentPct: number;
  maxVentPct: number;
  setpointTemp: number;
  tempDeviation: number;
  status: ThermoCommandStatus;
  note: string | null;
  errorMsg: string | null;
  channel?: import("@/lib/data/iot-channel").ChannelSlot;
  eqpmnCode?: string;
};

type Row = {
  id: string;
  created_at: string;
  sent_at: string | null;
  applied_at: string | null;
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  ctrl_idx: number | null;
  stall_ty_code: string | null;
  stall_no: string | null;
  eqpmn_no: string | null;
  min_vent_pct: number;
  max_vent_pct: number;
  setpoint_temp: string | number;
  temp_deviation: string | number;
  status: string;
  note: string | null;
  error_msg: string | null;
  channel: string | null;
  eqpmn_code: string | null;
  action: string | null;
};

function mapRow(row: Row): ThermoCommand {
  const stallTyCode = row.stall_ty_code?.trim() ?? "";
  const stallNo = row.stall_no?.trim() ?? "";
  const eqpmnNo = row.eqpmn_no
    ? normalizeEqpmnNo(row.eqpmn_no)
    : row.ctrl_idx != null
      ? normalizeEqpmnNo(row.ctrl_idx + 1)
      : "01";

  const controllerKey =
    controllerKeyFromParts(stallTyCode, stallNo, eqpmnNo) ??
    (row.ctrl_idx != null ? legacyControllerKey(row.ctrl_idx) : "legacy:unknown");

  const channelRaw = row.channel?.trim().toUpperCase();
  const channel =
    channelRaw === "A" || channelRaw === "B" || channelRaw === "C"
      ? channelRaw
      : undefined;

  return {
    id: row.id,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    appliedAt: row.applied_at,
    farmKey: {
      lsindRegistNo: row.lsind_regist_no,
      itemCode: row.item_code,
    },
    moduleUid: row.module_uid,
    controllerKey,
    stallTyCode: stallTyCode || "SP01",
    stallNo: stallNo || "01",
    eqpmnNo,
    ctrlIdx: row.ctrl_idx ?? undefined,
    minVentPct: row.min_vent_pct,
    maxVentPct: row.max_vent_pct,
    setpointTemp: Number(row.setpoint_temp),
    tempDeviation: Number(row.temp_deviation),
    status: row.status as ThermoCommandStatus,
    note: row.note,
    errorMsg: row.error_msg,
    channel,
    eqpmnCode: row.eqpmn_code?.trim() || undefined,
  };
}

/** ctrl_thermo_command 최근 이력 (RLS: 본인 발행 또는 admin) */
export async function getThermoCommandHistory(
  limit = 20
): Promise<ThermoCommand[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ctrl_thermo_command")
    .select(
      "id, created_at, sent_at, applied_at, lsind_regist_no, item_code, module_uid, ctrl_idx, stall_ty_code, stall_no, eqpmn_no, channel, eqpmn_code, action, min_vent_pct, max_vent_pct, setpoint_temp, temp_deviation, status, note, error_msg"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as Row[]).map(mapRow);
}

/** ctrl별 최신 설정 (v0x08 LIVE thermo fallback; DB pending/sent 명령 우선) */
export async function getThermoSettingsMap(
  limit = 500
): Promise<Record<string, import("@/lib/controllers/controller-settings").ControllerThermoSettings>> {
  const { buildThermoSettingsMap } = await import(
    "@/lib/controllers/controller-settings"
  );
  const commands = await getThermoCommandHistory(limit);
  return buildThermoSettingsMap(commands);
}
