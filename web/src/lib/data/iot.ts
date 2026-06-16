import "server-only";

import { cache } from "react";
import { farmKeysFromAccess } from "@/lib/auth/farm-access";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";
import {
  summarizeControllers,
  toBarnSummary,
  toFarmOverview,
} from "@/lib/data/dashboard-summary";

import type { BarnMeta } from "@/lib/data/barn-meta";

import { isValidFarmKey } from "@/lib/data/barn-catalog";
import { compareReadings, sortReadings } from "@/lib/data/reading-hierarchy";
import {
  normalizeEqpmnNo,
  resolveControllerKey,
} from "@/lib/data/controller-key";
import { formatControllerSlotLabel } from "@/lib/ui/controller-labels";
import {
  compareFarmKey,
  farmKeyEq,
  farmKeyId,
  moduleKey,
  readingKey,
  stallCatalogKey,
  type FarmKey,
} from "@/lib/data/farm-key";
import {
  isLivePacketMode,
  pickLatestMergedLiveSnapshots,
  type LiveDecodedRow,
} from "@/lib/data/iot-live-merge";
import {
  legacyFieldsFromChannels,
  mapDecodedChannels,
  type ChannelReading,
} from "@/lib/data/iot-channel";

export type { StallCatalogEntry } from "@/lib/data/stall-catalog";

export { buildStallCatalog } from "@/lib/data/stall-catalog";



// ES/EC 배열의 어느 원소를 "현재값"으로 볼지. (가정: 마지막 원소가 최신)

const READING_AT: "last" | "first" = "last";



export type ControllerStatus = "normal" | "caution" | "offline";



export type PacketMode = "live" | "replay";



export type BarnReading = {

  key: string;

  farmKey: FarmKey;

  moduleUid: number;

  /** v0x0A business key SPxx:stallNo:eqpmnNo (legacy: legacy:idx:N) */
  controllerKey: string;

  /** @deprecated v0x09 legacy; v0x0A decoded rows omit idx */
  idx?: number;

  eqpmnNo: string;

  stallNo: string | null;

  stallTyCode: string | null;

  label: string;

  tempC: number | null;

  humidityPct: number | null;

  fanSupply: number | null; // EC01 송풍팬

  fanExhaust: number | null; // EC02 배기팬

  fanIntake: number | null; // EC03 입기팬

  fanSupplySeries: number[]; // EC01 추이

  fanExhaustSeries: number[]; // EC02 추이

  fanIntakeSeries: number[]; // EC03 추이

  mesureDt: string | null;

  receivedAt: string;

  status: ControllerStatus;

  packetMode: PacketMode;

  wireVer: number | null;

  decodedId?: number;

  thermo?: DecodedController["thermo"];

  /** v0x0B schema 2.0 — A/B/C channel readings */
  channels?: ChannelReading[];

};



/** BarnReading 과 동일 구조 (컨트롤러 페이지에서 의미상 사용) */

export type ControllerReading = BarnReading;



export type BarnSummary = {

  total: number;

  normal: number;

  caution: number;

  offline: number;

};



type DecodedController = {

  controllerKey?: string;

  idx?: number;

  eqpmnNo?: string;

  stallNo?: unknown;

  stallTyCode?: unknown;

  ES01?: unknown;

  ES02?: unknown;

  EC01?: unknown;

  EC02?: unknown;

  EC03?: unknown;

  mesureDt?: string;

  channels?: import("@/lib/data/iot-channel").DecodedChannel[];

  thermo?: {
    setpointTemp?: string | number;
    tempDeviation?: string | number;
    minVentPct?: number;
    maxVentPct?: number;
  } | null;

};



function pickStallField(v: unknown): string | null {

  if (v == null) return null;

  const s = String(v).trim();

  return s.length > 0 ? s : null;

}



type DecodedJson = {

  controllers?: DecodedController[];

};



type DecodedRow = {

  id?: number;

  lsind_regist_no: string;

  item_code: string;

  module_uid: number;

  wire_ver?: number | null;

  mode?: string | null;

  mesure_dt: string | null;

  received_at: string;

  decoded_json: DecodedJson | null;

};



function rowFarmKey(row: DecodedRow): FarmKey {

  return { lsindRegistNo: row.lsind_regist_no, itemCode: row.item_code };

}



function toNum(v: unknown): number | null {

  if (v == null) return null;

  const n = Number(v);

  return Number.isFinite(n) ? n : null;

}



function pick(arr: unknown): number | null {

  if (!Array.isArray(arr) || arr.length === 0) return null;

  return toNum(READING_AT === "last" ? arr[arr.length - 1] : arr[0]);

}



function pickSeries(arr: unknown): number[] {

  if (!Array.isArray(arr)) return [];

  return arr.map(toNum).filter((n): n is number => n !== null);

}



function statusFromAge(receivedAt: string): ControllerStatus {

  const ageMin = (Date.now() - new Date(receivedAt).getTime()) / 60000;

  if (ageMin <= 15) return "normal";

  if (ageMin <= 60) return "caution";

  return "offline";

}



function expandDecodedRowToReadings(row: DecodedRow): BarnReading[] {

  const farmKey = rowFarmKey(row);

  const packetMode = (

    isLivePacketMode(row.mode ?? (row.decoded_json as { mode?: string })?.mode)

      ? "live"

      : "replay"

  ) as PacketMode;

  const status = statusFromAge(row.received_at);

  const controllers = row.decoded_json?.controllers ?? [];

  const wireVer = row.wire_ver != null ? Number(row.wire_ver) : null;



  return controllers.map((c) => {

    const controllerKey = resolveControllerKey(c);
    const idxRaw = c.idx;
    const idx =
      typeof idxRaw === "number" && Number.isInteger(idxRaw) ? idxRaw : undefined;
    const eqpmnNo = normalizeEqpmnNo(
      c.eqpmnNo ?? (idx != null ? idx + 1 : 1)
    );
    const stallNo = pickStallField(c.stallNo);
    const stallTyCode = pickStallField(c.stallTyCode);
    const channels = mapDecodedChannels(c.channels);
    const fromChannels =
      channels.length > 0 ? legacyFieldsFromChannels(channels) : null;

    return {

      key: readingKey(farmKey, row.module_uid, controllerKey),

      farmKey,

      moduleUid: row.module_uid,

      controllerKey,

      idx,

      eqpmnNo,

      stallNo,

      stallTyCode,

      label: formatControllerSlotLabel({ stallNo, eqpmnNo, idx }),

      tempC: fromChannels?.tempC ?? pick(c.ES01),

      humidityPct: fromChannels?.humidityPct ?? pick(c.ES02),

      fanSupply: fromChannels?.fanSupply ?? pick(c.EC01),

      fanExhaust: fromChannels?.fanExhaust ?? pick(c.EC02),

      fanIntake: fromChannels?.fanIntake ?? pick(c.EC03),

      fanSupplySeries: fromChannels?.fanSupplySeries ?? pickSeries(c.EC01),

      fanExhaustSeries: fromChannels?.fanExhaustSeries ?? pickSeries(c.EC02),

      fanIntakeSeries: fromChannels?.fanIntakeSeries ?? pickSeries(c.EC03),

      mesureDt: c.mesureDt ?? row.mesure_dt,

      receivedAt: row.received_at,

      status,

      packetMode,

      wireVer,

      decodedId: row.id,

      thermo: fromChannels?.thermo ?? c.thermo ?? null,

      channels: channels.length > 0 ? channels : undefined,

    };

  });

}



/**

 * 모듈별 최신 LIVE snapshot(chunk 병합)을 펼쳐 컨트롤러(idx) 단위 반환.

 * REPLAY 수신 직후에도 LIVE UI가 깨지지 않도록 mode=live 만 채택.

 */

/** 요청당 1회 조회 — 동일 RSC 트리 내 페이지·설정 공유 */
export const getLiveReadings = cache(async (): Promise<BarnReading[]> => {
  const readings = await fetchLiveReadingsRaw();
  return readings.filter((r) => isValidFarmKey(r.farmKey));
});

const GLOBAL_LIVE_ROW_LIMIT = 200;
/** 비관리자 농장 스코프 — 모듈별 최신 LIVE chunk 수집용 */
const SCOPED_LIVE_ROW_LIMIT = 2000;

async function fetchLiveReadingsRaw(): Promise<BarnReading[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const scopedFarms =
    user && !user.isAdmin ? farmKeysFromAccess(user) : null;

  let query = supabase
    .from("iot_room_state_decoded")
    .select(
      "id, lsind_regist_no, item_code, module_uid, wire_ver, mode, mesure_dt, received_at, chunk_seq, session_id, decoded_json"
    )
    .order("received_at", { ascending: false });

  if (scopedFarms && scopedFarms.length > 0) {
    if (scopedFarms.length === 1) {
      const fk = scopedFarms[0]!;
      query = query
        .eq("lsind_regist_no", fk.lsindRegistNo)
        .eq("item_code", fk.itemCode);
    } else {
      const orClause = scopedFarms
        .map(
          (fk) =>
            `and(lsind_regist_no.eq.${fk.lsindRegistNo},item_code.eq.${fk.itemCode})`
        )
        .join(",");
      query = query.or(orClause);
    }
    query = query.limit(SCOPED_LIVE_ROW_LIMIT);
  } else {
    query = query.limit(GLOBAL_LIVE_ROW_LIMIT);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  const mergedSnapshots = pickLatestMergedLiveSnapshots(
    data as LiveDecodedRow[]
  );

  const readings = mergedSnapshots.flatMap((row) =>
    expandDecodedRowToReadings(row as DecodedRow)
  );

  return sortReadings(readings);
}



/** @deprecated getLiveReadings() 사용 */

export async function getBarnReadings(): Promise<BarnReading[]> {

  return getLiveReadings();

}



export function summarizeBarns(readings: BarnReading[]): BarnSummary {
  return toBarnSummary(summarizeControllers(readings));
}



/** 축사 페이지 차트·비교용. stallNo 있으면 축사별 평균, 없으면 컨트롤러 단위. */

export type BarnCompareRow = {

  key: string;

  label: string;

  tempC: number | null;

  humidityPct: number | null;

  fanSupply: number | null;

  fanExhaust: number | null;

  fanIntake: number | null;

  status: ControllerStatus;

};



export {

  buildControllerSlotSeries,

  CONTROLLER_SLOT_COUNT,

  LIVE_SLOT_COUNT,

  LEGACY_SLOT_COUNT,

  resolveSlotCount,

  type ControllerMetricKey,

  type ControllerSlotReading,

  type ChartSlotItem,

} from "@/lib/data/iot-chart";



export function buildBarnCompareRows(readings: BarnReading[]): BarnCompareRow[] {

  const groups = new Map<string, BarnReading[]>();

  for (const r of readings) {

    const gk = r.stallNo

      ? stallCatalogKey(r.farmKey, r.moduleUid, r.stallNo)

      : r.key;

    const list = groups.get(gk) ?? [];

    list.push(r);

    groups.set(gk, list);

  }



  const entries = [...groups.entries()].sort(([, a], [, b]) =>
    compareReadings(a[0], b[0])
  );

  return entries.map(([key, matched]) => {
    const head = matched[0];
    return {
      key,
      label: head.stallNo ? `축사 ${head.stallNo}` : head.label,
      tempC: avg(matched.map((m) => m.tempC)),
      humidityPct: avg(matched.map((m) => m.humidityPct)),
      fanSupply: avg(matched.map((m) => m.fanSupply)),
      fanExhaust: avg(matched.map((m) => m.fanExhaust)),
      fanIntake: avg(matched.map((m) => m.fanIntake)),
      status: worstStatus(matched.map((m) => m.status)),
    };
  });

}

export type ModuleReceipt = {

  farmKey: FarmKey;

  moduleUid: number;

  receivedAt: string;

  status: ControllerStatus;

};



export type FarmOverview = {

  farmCount: number;

  moduleCount: number;

  controllerCount: number;

  connectedCount: number;

  expectedControllerCount: number;

  offlineCount: number;

  avgTempC: number | null;

  avgHumidityPct: number | null;

  avgFanSupply: number | null;

  avgFanExhaust: number | null;

  avgFanIntake: number | null;

  receipts: ModuleReceipt[];

};



function avg(nums: (number | null)[]): number | null {

  const v = nums.filter((n): n is number => n !== null);

  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;

}



const STATUS_RANK: Record<ControllerStatus, number> = {

  normal: 0,

  caution: 1,

  offline: 2,

};



function worstStatus(statuses: ControllerStatus[]): ControllerStatus {

  if (statuses.length === 0) return "offline";

  return statuses.reduce((w, s) =>

    STATUS_RANK[s] > STATUS_RANK[w] ? s : w

  );

}



export type BarnMapSnapshot = {

  meta: BarnMeta;

  controllerCount: number;

  /** SP 그룹 내 고유 축사번호(stallNo) 수 */
  stallCount?: number;

  tempC: number | null;

  humidityPct: number | null;

  fanSupply: number | null;

  fanExhaust: number | null;

  fanIntake: number | null;

  status: ControllerStatus;

  receivedAt: string | null;

};



/** stallNo 기준 집계. 축사 1개에 컨트롤러 여러 대 (통신박스 idx별 동일 stall_no). */

export function aggregateByBarn(

  readings: BarnReading[],

  barnMetas: BarnMeta[]

): BarnMapSnapshot[] {

  return barnMetas.map((meta) => {

    const matched = readings.filter(

      (r) =>

        farmKeyEq(r.farmKey, meta.farmKey) &&

        r.moduleUid === meta.moduleUid &&

        r.stallNo === meta.stallNo

    );



    const latestReceived = matched.reduce<string | null>((latest, r) => {

      if (!latest) return r.receivedAt;

      return new Date(r.receivedAt) > new Date(latest) ? r.receivedAt : latest;

    }, null);



    return {

      meta,

      controllerCount: matched.length,

      tempC: avg(matched.map((r) => r.tempC)),

      humidityPct: avg(matched.map((r) => r.humidityPct)),

      fanSupply: avg(matched.map((r) => r.fanSupply)),

      fanExhaust: avg(matched.map((r) => r.fanExhaust)),

      fanIntake: avg(matched.map((r) => r.fanIntake)),

      status: worstStatus(matched.map((r) => r.status)),

      receivedAt: latestReceived,

    };

  });

}



export function summarizeFarm(
  readings: BarnReading[],
  expectedControllerCount = 48
): FarmOverview {
  return toFarmOverview(
    summarizeControllers(readings, expectedControllerCount)
  );
}


