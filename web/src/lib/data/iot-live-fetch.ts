import "server-only";

import { cache } from "react";
import { farmKeysFromAccess } from "@/lib/auth/farm-access";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";
import { createRlsClient, getAccessTokenOrNull } from "@/lib/supabase/rls-client";
import { GLOBAL_LIVE_ROW_LIMIT } from "@/lib/admin/health/constants";
import {
  normalizeEqpmnNo,
  resolveControllerKey,
} from "@/lib/data/controller-key";
import { formatControllerSlotLabel } from "@/lib/ui/controller-labels";
import {
  compareFarmKey,
  farmKeyId,
  readingKey,
  type FarmKey,
} from "@/lib/data/farm-key";
import { cachedLiveQuery } from "@/lib/data/live-cache";
import {
  liveReadTier,
  LIVE_FARM_ROW_LIMIT,
} from "@/lib/data/live-config";
import { isLivePacketMode } from "@/lib/data/iot-live-merge";
import {
  legacyFieldsFromChannels,
  mapDecodedChannels,
} from "@/lib/data/iot-channel";
import type { RawLiveControllerRow } from "@/lib/data/iot-raw-live";
import type { BarnReading, ControllerStatus } from "@/lib/data/iot";
import { sortReadings } from "@/lib/data/reading-hierarchy";

export type LiveReadingsScope = {
  farmKey?: FarmKey | null;
};

const LEGACY_SOURCE = "v_iot_decoded_latest" as const;
const LIST_SOURCE = "v_iot_dashboard_list" as const;

const LEGACY_COLS =
  "raw_id, lsind_regist_no, item_code, module_uid, controller_key, wire_ver, packet_mode, run_mode, temp_c, humidity_pct, mesure_dt, decoded_json, received_at";

const LIST_COLS_CORE =
  "raw_id, lsind_regist_no, item_code, module_uid, controller_key, eqpmn_no, stall_ty_code, stall_no, wire_ver, packet_mode, run_mode, temp_c, humidity_pct, fan_supply_pct, fan_exhaust_pct, fan_intake_pct, mesure_dt, received_at";

const LIST_COLS_THERMO =
  "setpoint_temp, temp_deviation, min_vent_pct, max_vent_pct";

const LIST_COLS = `${LIST_COLS_CORE}, ${LIST_COLS_THERMO}`;

function isListThermoColumnError(message: string): boolean {
  return /setpoint_temp|temp_deviation|min_vent_pct|max_vent_pct/.test(message);
}

const DETAIL_COLS =
  "raw_id, lsind_regist_no, item_code, module_uid, controller_key, wire_ver, packet_mode, run_mode, temp_c, humidity_pct, mesure_dt, decoded_json, received_at";

function statusFromAge(receivedAt: string): ControllerStatus {
  const ageMin = (Date.now() - new Date(receivedAt).getTime()) / 60000;
  if (ageMin <= 15) return "normal";
  if (ageMin <= 60) return "caution";
  return "offline";
}

function pickStallField(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function toNumList(values: (string | null | undefined)[] | undefined): (number | null)[] | undefined {
  if (!values) return undefined;
  return values.map((v) => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });
}

function pickPrimaryTemp(
  tempsC: (number | null)[] | undefined,
  fromChannels: ReturnType<typeof legacyFieldsFromChannels> | null,
): number | null {
  if (tempsC) {
    for (const t of tempsC) {
      if (t != null) return t;
    }
  }
  return fromChannels?.tempC ?? null;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type ListDbRow = {
  raw_id: number;
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  controller_key: string;
  eqpmn_no: string | null;
  stall_ty_code: string | null;
  stall_no: string | null;
  wire_ver: number;
  packet_mode: string;
  run_mode: number | null;
  temp_c: number | null;
  humidity_pct: number | null;
  fan_supply_pct: number | null;
  fan_exhaust_pct: number | null;
  fan_intake_pct: number | null;
  setpoint_temp: number | null;
  temp_deviation: number | null;
  min_vent_pct: number | null;
  max_vent_pct: number | null;
  mesure_dt: string;
  received_at: string;
};

function thermoFromListRow(row: ListDbRow) {
  const setpointTemp = toNum(row.setpoint_temp);
  const tempDeviation = toNum(row.temp_deviation);
  const minVentPct = toNum(row.min_vent_pct);
  const maxVentPct = toNum(row.max_vent_pct);
  if (
    setpointTemp == null ||
    tempDeviation == null ||
    minVentPct == null ||
    maxVentPct == null
  ) {
    return null;
  }
  return { setpointTemp, tempDeviation, minVentPct, maxVentPct };
}

function listRowToReading(row: ListDbRow): BarnReading | null {
  if (!isLivePacketMode(row.packet_mode)) return null;
  const farmKey: FarmKey = {
    lsindRegistNo: row.lsind_regist_no,
    itemCode: row.item_code,
  };
  const parts = row.controller_key.split(":");
  const controllerKey = resolveControllerKey({
    controllerKey: row.controller_key,
    eqpmnNo: parts[2] ?? "01",
    stallNo: parts[1] ?? null,
    stallTyCode: parts[0] ?? null,
  });
  const eqpmnNo = normalizeEqpmnNo(
    pickStallField(row.eqpmn_no) ?? parts[2] ?? "01"
  );
  const stallNo =
    pickStallField(row.stall_no) ?? pickStallField(parts[1]);
  const stallTyCode =
    pickStallField(row.stall_ty_code) ?? pickStallField(parts[0]);
  const tempC = row.temp_c != null ? Number(row.temp_c) : null;
  const humidityPct =
    row.humidity_pct != null ? Number(row.humidity_pct) : null;

  return {
    key: readingKey(farmKey, row.module_uid, controllerKey),
    farmKey,
    moduleUid: row.module_uid,
    controllerKey,
    eqpmnNo,
    stallNo,
    stallTyCode,
    label: formatControllerSlotLabel({ stallNo, eqpmnNo }),
    tempC: Number.isFinite(tempC!) ? tempC : null,
    humidityPct: Number.isFinite(humidityPct!) ? humidityPct : null,
    fanSupply: toNum(row.fan_supply_pct),
    fanExhaust: toNum(row.fan_exhaust_pct),
    fanIntake: toNum(row.fan_intake_pct),
    fanSupplySeries: [],
    fanExhaustSeries: [],
    fanIntakeSeries: [],
    mesureDt: row.mesure_dt,
    receivedAt: row.received_at,
    status: statusFromAge(row.received_at),
    packetMode: "live",
    wireVer: row.wire_ver,
    decodedId: row.raw_id,
    runMode: row.run_mode,
    thermo: thermoFromListRow(row),
  };
}

function decodedLatestDbRowToLiveRow(row: {
  raw_id: number;
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  controller_key: string;
  wire_ver: number;
  packet_mode: string;
  run_mode: number | null;
  temp_c: number | null;
  humidity_pct: number | null;
  mesure_dt: string;
  decoded_json: {
    tempsC?: (string | null)[];
    humidityPct?: string | null;
    channels?: RawLiveControllerRow["channels"];
    runMode?: number;
  };
  received_at: string;
}): RawLiveControllerRow | null {
  if (!isLivePacketMode(row.packet_mode)) return null;
  const j = row.decoded_json ?? {};
  return {
    rawId: row.raw_id,
    lsind_regist_no: row.lsind_regist_no,
    item_code: row.item_code,
    module_uid: row.module_uid,
    received_at: row.received_at,
    wire_ver: row.wire_ver,
    packet_mode: row.packet_mode,
    controller_key: row.controller_key,
    mesure_dt: row.mesure_dt,
    run_mode: row.run_mode ?? j.runMode ?? undefined,
    temps_c: j.tempsC,
    humidity_pct:
      j.humidityPct ??
      (row.humidity_pct != null ? String(row.humidity_pct) : null),
    channels: j.channels ?? [],
  };
}

function expandRawLiveRowToReading(row: RawLiveControllerRow): BarnReading {
  const farmKey: FarmKey = {
    lsindRegistNo: row.lsind_regist_no,
    itemCode: row.item_code,
  };
  const status = statusFromAge(row.received_at);
  const c = {
    controllerKey: row.controller_key,
    eqpmnNo: row.controller_key.split(":")[2] ?? "01",
    stallNo: row.controller_key.split(":")[1] ?? null,
    stallTyCode: row.controller_key.split(":")[0] ?? null,
    mesureDt: row.mesure_dt,
    channels: row.channels,
  };
  const controllerKey = resolveControllerKey(c);
  const eqpmnNo = normalizeEqpmnNo(c.eqpmnNo);
  const stallNo = pickStallField(c.stallNo);
  const stallTyCode = pickStallField(c.stallTyCode);
  const channels = mapDecodedChannels(c.channels);
  const fromChannels =
    channels.length > 0 ? legacyFieldsFromChannels(channels) : null;
  const tempsC = toNumList(row.temps_c);
  const humidityFromRow =
    row.humidity_pct != null ? Number(row.humidity_pct) : null;
  const humidityPct =
    humidityFromRow != null && Number.isFinite(humidityFromRow)
      ? humidityFromRow
      : fromChannels?.humidityPct ?? null;

  return {
    key: readingKey(farmKey, row.module_uid, controllerKey),
    farmKey,
    moduleUid: row.module_uid,
    controllerKey,
    eqpmnNo,
    stallNo,
    stallTyCode,
    label: formatControllerSlotLabel({ stallNo, eqpmnNo }),
    tempC: pickPrimaryTemp(tempsC, fromChannels),
    humidityPct,
    fanSupply: fromChannels?.fanSupply ?? null,
    fanExhaust: fromChannels?.fanExhaust ?? null,
    fanIntake: fromChannels?.fanIntake ?? null,
    fanSupplySeries: fromChannels?.fanSupplySeries ?? [],
    fanExhaustSeries: fromChannels?.fanExhaustSeries ?? [],
    fanIntakeSeries: fromChannels?.fanIntakeSeries ?? [],
    mesureDt: row.mesure_dt,
    receivedAt: row.received_at,
    status,
    packetMode: "live",
    wireVer: row.wire_ver,
    decodedId: row.rawId,
    thermo: fromChannels?.thermo ?? null,
    channels: channels.length > 0 ? channels : undefined,
    runMode: row.run_mode ?? null,
    tempsC,
  };
}

function applyFarmFilter<
  T extends {
    eq: (col: string, val: string | number) => T;
    or: (clause: string) => T;
  },
>(
  query: T,
  scopedFarms: FarmKey[] | null,
  explicitFarm: FarmKey | null | undefined,
): T {
  if (explicitFarm) {
    return query
      .eq("lsind_regist_no", explicitFarm.lsindRegistNo)
      .eq("item_code", explicitFarm.itemCode);
  }
  if (scopedFarms && scopedFarms.length > 0) {
    if (scopedFarms.length === 1) {
      const fk = scopedFarms[0]!;
      return query
        .eq("lsind_regist_no", fk.lsindRegistNo)
        .eq("item_code", fk.itemCode);
    }
    const orClause = scopedFarms
      .map(
        (fk) =>
          `and(lsind_regist_no.eq.${fk.lsindRegistNo},item_code.eq.${fk.itemCode})`,
      )
      .join(",");
    return query.or(orClause);
  }
  return query;
}

async function fetchLiveRowsWithToken(
  accessToken: string,
  scopedFarms: FarmKey[] | null,
  scope: LiveReadingsScope,
): Promise<BarnReading[]> {
  const supabase = createRlsClient(accessToken);
  const tier = liveReadTier();
  /**
   * list tier (`v_iot_dashboard_list`) omits channels[] for payload size.
   * Farm-scoped panel/bulk need channels for SET_CHANNEL_THERMO — use decoded_latest.
   */
  const farmScoped =
    Boolean(scope.farmKey) ||
    (scopedFarms != null && scopedFarms.length > 0);
  const useListTier = tier === "list" && !farmScoped;
  const source = useListTier ? LIST_SOURCE : LEGACY_SOURCE;

  const runQuery = async (cols: string) => {
    let query = supabase
      .from(source as "v_iot_decoded_latest")
      .select(cols as typeof LEGACY_COLS)
      .order("received_at", { ascending: false });

    query = applyFarmFilter(query, scopedFarms, scope.farmKey);

    const isFarmScoped =
      Boolean(scope.farmKey) ||
      (scopedFarms != null && scopedFarms.length > 0);

    if (isFarmScoped) {
      query = query.limit(LIVE_FARM_ROW_LIMIT);
    } else if (useListTier) {
      query = query.limit(LIVE_FARM_ROW_LIMIT);
    } else {
      query = query.limit(GLOBAL_LIVE_ROW_LIMIT);
    }

    return query;
  };

  let cols = useListTier ? LIST_COLS : LEGACY_COLS;
  let { data, error } = await runQuery(cols);

  if (error && useListTier && isListThermoColumnError(error.message)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[live-readings] thermo columns missing on list view — retry without setpoint fields:",
        error.message,
      );
    }
    cols = LIST_COLS_CORE;
    ({ data, error } = await runQuery(cols));
  }

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[live-readings] query failed:", error.message);
    }
    return [];
  }
  if (!data) return [];

  if (useListTier) {
    return (data as unknown as ListDbRow[])
      .map(listRowToReading)
      .filter((r): r is BarnReading => r != null);
  }

  const liveRows = (data as unknown as Parameters<
    typeof decodedLatestDbRowToLiveRow
  >[0][])
    .map(decodedLatestDbRowToLiveRow)
    .filter((r): r is RawLiveControllerRow => r != null);

  return liveRows.map(expandRawLiveRowToReading);
}

export async function fetchLiveReadings(
  scope: LiveReadingsScope = {},
): Promise<BarnReading[]> {
  const user = await getCurrentUser();
  const accessToken = await getAccessTokenOrNull();
  if (!accessToken) {
    if (user && process.env.NODE_ENV === "development") {
      console.error(
        "[live] authenticated user but no access token — skipping LIVE fetch",
      );
    }
    return [];
  }

  const scopedFarms =
    user && !user.isAdmin ? farmKeysFromAccess(user) : null;

  const scopeKey = scope.farmKey
    ? farmKeyId(scope.farmKey)
    : scopedFarms?.length === 1
      ? farmKeyId(scopedFarms[0]!)
      : scopedFarms && scopedFarms.length > 1
        ? "multi"
        : "global";

  const userId = user?.id ?? "anon";
  // farm-scoped uses decoded_latest (channels); hub list uses flat list view
  const farmScoped =
    Boolean(scope.farmKey) ||
    (scopedFarms != null && scopedFarms.length > 0);
  const sourceTag =
    liveReadTier() === "list" && !farmScoped ? "list" : "decoded";

  const rows = await cachedLiveQuery(
    ["live-readings", sourceTag, userId, scopeKey],
    [scopeKey === "global" ? "live" : `live:${scopeKey}`],
    () => fetchLiveRowsWithToken(accessToken, scopedFarms, scope),
  );

  return sortReadings(rows);
}

export async function fetchLiveReadingDetail(
  farmKey: FarmKey,
  moduleUid: number,
  controllerKey: string,
): Promise<BarnReading | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(LEGACY_SOURCE)
    .select(DETAIL_COLS)
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode)
    .eq("module_uid", moduleUid)
    .eq("controller_key", controllerKey)
    .maybeSingle();

  if (error || !data) return null;
  const liveRow = decodedLatestDbRowToLiveRow(
    data as Parameters<typeof decodedLatestDbRowToLiveRow>[0],
  );
  if (!liveRow) return null;
  return expandRawLiveRowToReading(liveRow);
}

export type FarmOverviewDbRow = {
  lsind_regist_no: string;
  item_code: string;
  controller_count: number;
  offline_count: number;
  avg_temp_c: number | null;
  avg_humidity_pct: number | null;
  latest_received_at: string | null;
};

async function fetchFarmOverviewWithToken(
  accessToken: string,
  scopedFarms: FarmKey[] | null,
): Promise<FarmOverviewDbRow[]> {
  const supabase = createRlsClient(accessToken);

  let query = supabase
    .from("v_iot_farm_overview" as "v_iot_decoded_latest")
    .select(
      "lsind_regist_no, item_code, controller_count, offline_count, avg_temp_c, avg_humidity_pct, latest_received_at" as typeof LEGACY_COLS,
    );

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
            `and(lsind_regist_no.eq.${fk.lsindRegistNo},item_code.eq.${fk.itemCode})`,
        )
        .join(",");
      query = query.or(orClause);
    }
  }

  const { data, error } = await query;
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[farm-overview] query failed:", error.message);
    }
    return [];
  }
  if (!data) return [];
  return data as unknown as FarmOverviewDbRow[];
}

/** Admin hub — farm overview 1회 배치 조회 (N회 per-farm 왕복 제거) */
export async function fetchFarmOverviewForFarmKeys(
  farmKeys: FarmKey[],
): Promise<FarmOverviewDbRow[]> {
  if (farmKeys.length === 0) return [];

  const user = await getCurrentUser();
  const accessToken = await getAccessTokenOrNull();
  if (!accessToken) {
    if (user && process.env.NODE_ENV === "development") {
      console.error(
        "[farm-overview] authenticated user but no access token — skipping scoped overview",
      );
    }
    return [];
  }

  const userId = user?.id ?? "anon";
  const keys = [...farmKeys].sort(compareFarmKey);
  const scopeKey = keys.map((fk) => farmKeyId(fk)).join("|");

  return cachedLiveQuery(
    ["farm-overview-batch", userId, scopeKey],
    ["live", "farm-overview"],
    () => fetchFarmOverviewWithToken(accessToken, keys),
    { revalidate: 60 },
  );
}

export const fetchFarmOverviewRows = cache(
  async (): Promise<FarmOverviewDbRow[]> => {
    const user = await getCurrentUser();
    const accessToken = await getAccessTokenOrNull();
    if (!accessToken) {
      if (user && process.env.NODE_ENV === "development") {
        console.error(
          "[farm-overview] authenticated user but no access token — skipping overview fetch",
        );
      }
      return [];
    }

    const scopedFarms =
      user && !user.isAdmin ? farmKeysFromAccess(user) : null;
    const userId = user?.id ?? "anon";

    return cachedLiveQuery(
      ["farm-overview", userId],
      ["live", "farm-overview"],
      () => fetchFarmOverviewWithToken(accessToken, scopedFarms),
      { revalidate: 60 },
    );
  },
);
