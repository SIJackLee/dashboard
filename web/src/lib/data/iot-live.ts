import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isValidFarmKey } from "@/lib/data/barn-catalog";
import { compareFarmKey, type FarmKey } from "@/lib/data/farm-key";
import {
  isLivePacketMode,
} from "@/lib/data/iot-live-merge";
import {
  pickLatestLiveControllerRows,
} from "@/lib/data/iot-raw-live";
import { decodeV0bPayloadFromDb } from "@/lib/data/wire-decode-v0b";

export type PacketMode = "live" | "replay";

export type LiveModuleSnapshot = {
  farmKey: FarmKey;
  moduleUid: number;
  wireVer: number | null;
  lutVer: number | null;
  mesureDt: string | null;
  receivedAt: string;
  ctrlCount: number;
};

export type LiveSummary = {
  modules: LiveModuleSnapshot[];
  totalControllers: number;
};

export async function getLiveModuleSnapshots(): Promise<LiveModuleSnapshot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("iot_room_state_raw")
    .select(
      "id, lsind_regist_no, item_code, module_uid, payload_bytea, received_at"
    )
    .order("received_at", { ascending: false })
    .limit(5000);

  if (error || !data) return [];

  type RawRow = {
    id: number;
    lsind_regist_no: string;
    item_code: string;
    module_uid: number;
    payload_bytea: unknown;
    received_at: string;
  };

  const liveRows = (data as RawRow[])
    .map((row) => {
      const decoded = decodeV0bPayloadFromDb(row.payload_bytea);
      if (!decoded || !isLivePacketMode(decoded.packetMode)) return null;
      return {
        rawId: row.id,
        lsind_regist_no: row.lsind_regist_no,
        item_code: row.item_code,
        module_uid: row.module_uid,
        received_at: row.received_at,
        wire_ver: decoded.wireVer,
        packet_mode: decoded.packetMode,
        controller_key: decoded.controllerKey,
        mesure_dt: decoded.mesureDt,
        channels: decoded.channels,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  const latest = pickLatestLiveControllerRows(liveRows);
  const byModule = new Map<
    string,
    { snap: LiveModuleSnapshot; ctrlCount: number; latestReceived: string }
  >();

  for (const row of latest) {
    const farmKey: FarmKey = {
      lsindRegistNo: String(row.lsind_regist_no),
      itemCode: String(row.item_code),
    };
    if (!isValidFarmKey(farmKey)) continue;
    const mk = `${farmKey.lsindRegistNo}:${farmKey.itemCode}:${row.module_uid}`;
    const existing = byModule.get(mk);
    if (!existing) {
      byModule.set(mk, {
        snap: {
          farmKey,
          moduleUid: Number(row.module_uid),
          wireVer: row.wire_ver,
          lutVer: null,
          mesureDt: row.mesure_dt,
          receivedAt: String(row.received_at),
          ctrlCount: 1,
        },
        ctrlCount: 1,
        latestReceived: row.received_at,
      });
      continue;
    }
    existing.ctrlCount += 1;
    if (row.received_at > existing.latestReceived) {
      existing.latestReceived = row.received_at;
      existing.snap.receivedAt = String(row.received_at);
      existing.snap.mesureDt = row.mesure_dt;
    }
  }

  return [...byModule.values()]
    .map(({ snap, ctrlCount }) => ({ ...snap, ctrlCount }))
    .sort((a, b) => {
      const farmCmp = compareFarmKey(a.farmKey, b.farmKey);
      return farmCmp !== 0 ? farmCmp : a.moduleUid - b.moduleUid;
    });
}

export async function getLiveSummary(): Promise<LiveSummary> {
  const modules = await getLiveModuleSnapshots();
  return {
    modules,
    totalControllers: modules.reduce((sum, m) => sum + m.ctrlCount, 0),
  };
}
