import { moduleKey, type FarmKey } from "@/lib/data/farm-key";

export type LiveDecodedController = {
  idx?: number;
  controllerKey?: string;
  eqpmnNo?: string;
  stallNo?: unknown;
  stallTyCode?: unknown;
  ES01?: unknown;
  ES02?: unknown;
  EC01?: unknown;
  EC02?: unknown;
  EC03?: unknown;
  mesureDt?: string;
  thermo?: {
    setpointTemp?: string | number;
    tempDeviation?: string | number;
    minVentPct?: number;
    maxVentPct?: number;
  } | null;
};

export type LiveDecodedJson = {
  mode?: string;
  chunk_seq?: number;
  partial?: boolean;
  last_chunk?: boolean;
  controllers?: LiveDecodedController[];
};

export type LiveDecodedRow = {
  id?: number;
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  wire_ver?: number | null;
  lut_ver?: number | null;
  mode?: string | null;
  mesure_dt: string | null;
  received_at: string;
  chunk_seq?: number | null;
  decoded_json: LiveDecodedJson | null;
};

function rowFarmKey(row: LiveDecodedRow): FarmKey {
  return { lsindRegistNo: row.lsind_regist_no, itemCode: row.item_code };
}

export function isLivePacketMode(mode: string | null | undefined): boolean {
  return !mode || mode === "live";
}

export function liveChunkSeq(row: LiveDecodedRow): number {
  if (row.chunk_seq != null) return Number(row.chunk_seq);
  return Number(row.decoded_json?.chunk_seq ?? 0);
}

export function liveSnapshotKey(row: LiveDecodedRow): string {
  const mk = moduleKey(rowFarmKey(row), row.module_uid);
  const mesure = row.mesure_dt ?? row.received_at;
  return `${mk}|${mesure}`;
}

function pickStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/** v0x09 idx 또는 v0x0A controllerKey / stall+eqpmn 로 chunk 간 컨트롤러 병합 키 */
function controllerMergeKey(ctrl: LiveDecodedController): string | null {
  const ck = pickStr(ctrl.controllerKey);
  if (ck) return ck;

  const idx = Number(ctrl.idx ?? -1);
  if (idx >= 0) return `legacy:idx:${idx}`;

  const ty = pickStr(ctrl.stallTyCode);
  const sn = pickStr(ctrl.stallNo);
  const eq = pickStr(ctrl.eqpmnNo);
  if (ty && sn && eq) return `${ty}:${sn}:${eq}`;

  return null;
}

function mergeControllers(rows: LiveDecodedRow[]): LiveDecodedController[] {
  const byKey = new Map<string, LiveDecodedController>();
  const sorted = [...rows].sort((a, b) => liveChunkSeq(a) - liveChunkSeq(b));

  for (const row of sorted) {
    for (const ctrl of row.decoded_json?.controllers ?? []) {
      const key = controllerMergeKey(ctrl);
      if (!key) continue;
      byKey.set(key, ctrl);
    }
  }

  return [...byKey.values()].sort((a, b) => {
    const ak = controllerMergeKey(a) ?? "";
    const bk = controllerMergeKey(b) ?? "";
    return ak.localeCompare(bk, "ko", { numeric: true });
  });
}

/** 같은 mesure_dt·모듈의 LIVE chunk row들을 하나의 decoded row로 병합 */
export function mergeLiveChunkRows(rows: LiveDecodedRow[]): LiveDecodedRow {
  const sorted = [...rows].sort((a, b) => liveChunkSeq(a) - liveChunkSeq(b));
  const base = sorted[sorted.length - 1] ?? rows[0];
  const controllers = mergeControllers(rows);

  return {
    ...base,
    decoded_json: {
      ...(base.decoded_json ?? {}),
      controllers,
      partial: rows.some((r) => r.decoded_json?.partial),
      last_chunk: rows.some((r) => r.decoded_json?.last_chunk),
    },
  };
}

/**
 * 모듈별 최신 LIVE snapshot 선택 후 chunk 병합.
 * v0x08 multi-chunk LIVE: chunk0+chunk1을 mesure_dt 기준으로 합침.
 */
export function pickLatestMergedLiveSnapshots(
  rows: LiveDecodedRow[]
): LiveDecodedRow[] {
  const snapshotGroups = new Map<string, LiveDecodedRow[]>();

  for (const row of rows) {
    const mode = row.mode ?? row.decoded_json?.mode;
    if (!isLivePacketMode(mode)) continue;

    const snapKey = liveSnapshotKey(row);
    const group = snapshotGroups.get(snapKey) ?? [];
    group.push(row);
    snapshotGroups.set(snapKey, group);
  }

  const latestByModule = new Map<
    string,
    { rows: LiveDecodedRow[]; latestReceived: string }
  >();

  for (const [, group] of snapshotGroups) {
    if (group.length === 0) continue;
    const mk = moduleKey(rowFarmKey(group[0]), group[0].module_uid);
    const latestReceived = group.reduce(
      (max, r) => (r.received_at > max ? r.received_at : max),
      group[0].received_at
    );

    const existing = latestByModule.get(mk);
    if (!existing || latestReceived > existing.latestReceived) {
      latestByModule.set(mk, { rows: group, latestReceived });
    }
  }

  return [...latestByModule.values()].map(({ rows: group }) =>
    mergeLiveChunkRows(group)
  );
}
