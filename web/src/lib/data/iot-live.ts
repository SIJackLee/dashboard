import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isValidFarmKey } from "@/lib/data/barn-catalog";
import { compareFarmKey, type FarmKey } from "@/lib/data/farm-key";
import {
  pickLatestMergedLiveSnapshots,
  type LiveDecodedRow,
} from "@/lib/data/iot-live-merge";

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
    .from("iot_room_state_decoded")
    .select(
      "id, lsind_regist_no, item_code, module_uid, wire_ver, lut_ver, mode, mesure_dt, received_at, chunk_seq, decoded_json"
    )
    .order("received_at", { ascending: false })
    .limit(200);

  if (error || !data) return [];

  const merged = pickLatestMergedLiveSnapshots(data as LiveDecodedRow[]);
  const snapshots: LiveModuleSnapshot[] = [];

  for (const row of merged) {
    const farmKey: FarmKey = {
      lsindRegistNo: String(row.lsind_regist_no),
      itemCode: String(row.item_code),
    };
    if (!isValidFarmKey(farmKey)) continue;

    const controllers = row.decoded_json?.controllers ?? [];

    snapshots.push({
      farmKey,
      moduleUid: Number(row.module_uid),
      wireVer: row.wire_ver != null ? Number(row.wire_ver) : null,
      lutVer: row.lut_ver != null ? Number(row.lut_ver) : null,
      mesureDt: row.mesure_dt != null ? String(row.mesure_dt) : null,
      receivedAt: String(row.received_at),
      ctrlCount: controllers.length,
    });
  }

  return snapshots.sort((a, b) => {
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
