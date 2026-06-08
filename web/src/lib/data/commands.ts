import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ThermoCommandStatus = "pending" | "sent" | "failed" | "cancelled";

export type ThermoCommand = {
  id: string;
  createdAt: string;
  farmUid: number;
  moduleUid: number;
  ctrlIdx: number;
  minVentPct: number;
  maxVentPct: number;
  setpointTemp: number;
  tempDeviation: number;
  status: ThermoCommandStatus;
  note: string | null;
  errorMsg: string | null;
};

type Row = {
  id: string;
  created_at: string;
  farm_uid: number;
  module_uid: number;
  ctrl_idx: number;
  min_vent_pct: number;
  max_vent_pct: number;
  setpoint_temp: string | number;
  temp_deviation: string | number;
  status: string;
  note: string | null;
  error_msg: string | null;
};

function mapRow(row: Row): ThermoCommand {
  return {
    id: row.id,
    createdAt: row.created_at,
    farmUid: row.farm_uid,
    moduleUid: row.module_uid,
    ctrlIdx: row.ctrl_idx,
    minVentPct: row.min_vent_pct,
    maxVentPct: row.max_vent_pct,
    setpointTemp: Number(row.setpoint_temp),
    tempDeviation: Number(row.temp_deviation),
    status: row.status as ThermoCommandStatus,
    note: row.note,
    errorMsg: row.error_msg,
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
      "id, created_at, farm_uid, module_uid, ctrl_idx, min_vent_pct, max_vent_pct, setpoint_temp, temp_deviation, status, note, error_msg"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as Row[]).map(mapRow);
}
