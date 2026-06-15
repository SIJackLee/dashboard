import "server-only";
import { createClient } from "@/lib/supabase/server";
import { formatReplayIdxRange } from "@/lib/data/iot-firmware";
import { farmKeyEq, farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import {
  controllerKeyFromParts,
  legacyControllerKey,
  normalizeEqpmnNo,
} from "@/lib/data/controller-key";

export type ReplayBurstSummary = {
  farmKey: FarmKey;
  moduleUid: number;
  burstNo: number;
  burstStartedAt: string;
  burstEndedAt: string;
  packetCount: number;
  maxChunkSeq: number;
  hasLastChunk: boolean;
  totalCtrlRows: number;
  idxMin: number | null;
  idxMax: number | null;
};

export type ReplayControllerRow = {
  decodedId: number;
  rawId: number;
  farmKey: FarmKey;
  moduleUid: number;
  chunkSeq: number;
  wireVer: number | null;
  controllerKey: string;
  idx?: number;
  eqpmnNo: string;
  stallNo: string | null;
  stallTyCode: string | null;
  mesureDt: string | null;
  tempC: number | null;
  humidityPct: number | null;
  fanSupply: number | null;
  fanExhaust: number | null;
  fanIntake: number | null;
  receivedAt: string;
  decodedAt: string | null;
};

export type LogEvent = {
  id: string;
  eventType: "replay_burst" | "command" | "offline";
  occurredAt: string;
  farmKey: FarmKey;
  moduleUid: number;
  title: string;
  detail: string;
  burstNo?: number;
  linkHref?: string;
};

function rowFarmKey(row: Record<string, unknown>): FarmKey {
  return {
    lsindRegistNo: String(row.lsind_regist_no),
    itemCode: String(row.item_code),
  };
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickLast(arr: unknown): number | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return toNum(arr[arr.length - 1]);
}

function mapReplayController(row: Record<string, unknown>): ReplayControllerRow {
  const idxRaw = row.idx;
  const idx =
    idxRaw != null && Number.isInteger(Number(idxRaw)) ? Number(idxRaw) : undefined;
  const stallTyCode =
    row.stall_ty_code != null ? String(row.stall_ty_code) : null;
  const stallNo = row.stall_no != null ? String(row.stall_no) : null;
  const eqpmnNo = normalizeEqpmnNo(
    row.eqpmn_no ?? (idx != null ? idx + 1 : 1)
  );
  const controllerKey =
    controllerKeyFromParts(stallTyCode, stallNo, eqpmnNo) ??
    (idx != null ? legacyControllerKey(idx) : "legacy:unknown");
  return {
    decodedId: Number(row.decoded_id),
    rawId: Number(row.raw_id),
    farmKey: rowFarmKey(row),
    moduleUid: Number(row.module_uid),
    chunkSeq: Number(row.chunk_seq ?? 0),
    wireVer: row.wire_ver != null ? Number(row.wire_ver) : null,
    controllerKey,
    idx,
    eqpmnNo,
    stallNo: row.stall_no != null ? String(row.stall_no) : null,
    stallTyCode: row.stall_ty_code != null ? String(row.stall_ty_code) : null,
    mesureDt: row.mesure_dt != null ? String(row.mesure_dt) : null,
    tempC: pickLast(row.es01),
    humidityPct: pickLast(row.es02),
    fanSupply: pickLast(row.ec01),
    fanExhaust: pickLast(row.ec02),
    fanIntake: pickLast(row.ec03),
    receivedAt: String(row.received_at),
    decodedAt: row.decoded_at != null ? String(row.decoded_at) : null,
  };
}

export async function getReplayBurstSummary(
  limit = 50
): Promise<ReplayBurstSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_iot_replay_burst_summary")
    .select("*")
    .order("burst_started_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    farmKey: rowFarmKey(row as Record<string, unknown>),
    moduleUid: Number(row.module_uid),
    burstNo: Number(row.burst_no),
    burstStartedAt: String(row.burst_started_at),
    burstEndedAt: String(row.burst_ended_at),
    packetCount: Number(row.packet_count),
    maxChunkSeq: Number(row.max_chunk_seq),
    hasLastChunk: Boolean(row.has_last_chunk),
    totalCtrlRows: Number(row.total_ctrl_rows),
    idxMin: row.idx_min != null ? Number(row.idx_min) : null,
    idxMax: row.idx_max != null ? Number(row.idx_max) : null,
  }));
}

export type ReplayControllerFilter = {
  farmKey?: FarmKey;
  moduleUid?: number;
  idx?: number;
  burstNo?: number;
  limit?: number;
};

export async function getReplayControllers(
  filter: ReplayControllerFilter = {}
): Promise<ReplayControllerRow[]> {
  const supabase = await createClient();
  const limit = filter.limit ?? 200;

  let query = supabase
    .from("v_iot_replay_controllers")
    .select("*")
    .order("mesure_at", { ascending: false, nullsFirst: false })
    .order("received_at", { ascending: false })
    .limit(limit);

  if (filter.farmKey != null) {
    query = query
      .eq("lsind_regist_no", filter.farmKey.lsindRegistNo)
      .eq("item_code", filter.farmKey.itemCode);
  }
  if (filter.moduleUid != null) {
    query = query.eq("module_uid", filter.moduleUid);
  }
  if (filter.idx != null) {
    query = query.eq("idx", filter.idx);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  let rows = data.map((row) => mapReplayController(row as Record<string, unknown>));

  if (filter.burstNo != null) {
    const bursts = await getReplayBurstSummary(200);
    const target = bursts.find(
      (b) =>
        b.burstNo === filter.burstNo &&
        (filter.farmKey == null || farmKeyEq(b.farmKey, filter.farmKey)) &&
        (filter.moduleUid == null || b.moduleUid === filter.moduleUid)
    );
    if (target) {
      const start = new Date(target.burstStartedAt).getTime();
      const end = new Date(target.burstEndedAt).getTime() + 1000;
      rows = rows.filter((r) => {
        const t = new Date(r.receivedAt).getTime();
        return (
          t >= start &&
          t <= end &&
          (filter.farmKey == null || farmKeyEq(r.farmKey, filter.farmKey)) &&
          (filter.moduleUid == null || r.moduleUid === filter.moduleUid)
        );
      });
    }
  }

  return rows;
}

export async function getLogEvents(limit = 50): Promise<LogEvent[]> {
  const bursts = await getReplayBurstSummary(limit);
  return bursts.map((b) => {
    return {
      id: `replay-${farmKeyId(b.farmKey)}-${b.moduleUid}-${b.burstNo}`,
      eventType: "replay_burst" as const,
      occurredAt: b.burstEndedAt,
      farmKey: b.farmKey,
      moduleUid: b.moduleUid,
      title: "REPLAY 백필 완료",
      detail: `${formatReplayIdxRange(b.idxMin, b.idxMax)} ${b.totalCtrlRows}건 · 패킷 ${b.packetCount}개 · chunk 0~${b.maxChunkSeq}`,
      burstNo: b.burstNo,
    };
  });
}
