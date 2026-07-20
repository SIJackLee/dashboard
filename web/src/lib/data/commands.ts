import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  controllerKeyFromParts,
  legacyControllerKey,
  normalizeEqpmnNo,
} from "@/lib/data/controller-key";
import { parseFarmKeyId, type FarmKey } from "@/lib/data/farm-key";

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

/** insert/select 행 → ThermoCommand (서버 액션 공용) */
export type ThermoCommandRow = Row;

const THERMO_COMMAND_SELECT =
  "id, created_at, sent_at, applied_at, lsind_regist_no, item_code, module_uid, ctrl_idx, stall_ty_code, stall_no, eqpmn_no, channel, eqpmn_code, action, min_vent_pct, max_vent_pct, setpoint_temp, temp_deviation, status, note, error_msg";

export function mapThermoCommandRow(row: Row): ThermoCommand {
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

export type ThermoCommandHistoryOptions = {
  fromIso?: string;
  /** 비우면 상태 조건 없음 */
  statuses?: ThermoCommandStatus[];
  /** id·농장·축사·장비·메모·오류 부분 검색 */
  q?: string;
};

export type ThermoCommandHistoryResult = {
  commands: ThermoCommand[];
  error: string | null;
};

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function queryThermoCommandHistory(
  limit: number,
  options?: ThermoCommandHistoryOptions,
): Promise<ThermoCommandHistoryResult> {
  const supabase = await createClient();

  let query = supabase
    .from("ctrl_thermo_command")
    .select(THERMO_COMMAND_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  const fromIso = options?.fromIso?.trim();
  if (fromIso) {
    query = query.gte("created_at", fromIso);
  }

  const statuses = options?.statuses?.filter(Boolean);
  if (statuses && statuses.length === 1) {
    query = query.eq("status", statuses[0]);
  } else if (statuses && statuses.length > 1) {
    query = query.in("status", statuses);
  }

  const needle = options?.q?.trim().slice(0, 64) ?? "";
  if (needle) {
    const farm = parseFarmKeyId(needle);
    if (farm) {
      query = query
        .eq("lsind_regist_no", farm.lsindRegistNo)
        .eq("item_code", farm.itemCode);
    } else {
      // Strip chars that break PostgREST or() parsing
      const safe = needle.replace(/[,()]/g, " ").trim();
      if (safe) {
        const pattern = `%${escapeIlikePattern(safe)}%`;
        const quoted = `"${pattern.replace(/"/g, "")}"`;
        query = query.or(
          [
            `id.ilike.${quoted}`,
            `lsind_regist_no.ilike.${quoted}`,
            `item_code.ilike.${quoted}`,
            `stall_ty_code.ilike.${quoted}`,
            `stall_no.ilike.${quoted}`,
            `eqpmn_no.ilike.${quoted}`,
            `note.ilike.${quoted}`,
            `error_msg.ilike.${quoted}`,
          ].join(","),
        );
      }
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getThermoCommandHistory]", error.message);
    return { commands: [], error: error.message };
  }
  if (!data) return { commands: [], error: null };
  return {
    commands: (data as Row[]).map(mapThermoCommandRow),
    error: null,
  };
}

/** ctrl_thermo_command 최근 이력 (RLS: 본인·admin·농장 읽기권한 sent/applied) */
export async function getThermoCommandHistory(
  limit = 20,
  options?: ThermoCommandHistoryOptions,
): Promise<ThermoCommand[]> {
  const { commands } = await queryThermoCommandHistory(limit, options);
  return commands;
}

/** ops 조회 — 오류 메시지 포함 */
export async function getThermoCommandHistoryResult(
  limit = 20,
  options?: ThermoCommandHistoryOptions,
): Promise<ThermoCommandHistoryResult> {
  return queryThermoCommandHistory(limit, options);
}

/** 단건 조회 — 적용 배너 폴링용 */
export async function getThermoCommandById(
  id: string
): Promise<ThermoCommand | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ctrl_thermo_command")
    .select(THERMO_COMMAND_SELECT)
    .eq("id", trimmed)
    .maybeSingle();

  if (error || !data) return null;
  return mapThermoCommandRow(data as Row);
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
