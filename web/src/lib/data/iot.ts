import "server-only";
import { createClient } from "@/lib/supabase/server";

// ES/EC 배열의 어느 원소를 "현재값"으로 볼지. (가정: 마지막 원소가 최신)
const READING_AT: "last" | "first" = "last";

export type ControllerStatus = "normal" | "caution" | "offline";

export type BarnReading = {
  key: string;
  farmUid: number;
  moduleUid: number;
  idx: number;
  eqpmnNo: string;
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
  idx?: number;
  eqpmnNo?: string;
  ES01?: unknown;
  ES02?: unknown;
  EC01?: unknown;
  EC02?: unknown;
  EC03?: unknown;
  mesureDt?: string;
};

type DecodedJson = {
  controllers?: DecodedController[];
};

type DecodedRow = {
  farm_uid: number;
  module_uid: number;
  mesure_dt: string | null;
  received_at: string;
  decoded_json: DecodedJson | null;
};

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

/**
 * 접근 가능한 농장의 최신 decoded 스냅샷을 컨트롤러(idx) 단위로 반환.
 * RLS(user_can_read_farm)가 농장 단위 읽기를 강제하므로 추가 필터 불필요.
 * 사용자 정의 "축사 지정" 메타데이터 도입 전까지 컨트롤러를 행 단위로 노출.
 */
export async function getBarnReadings(): Promise<BarnReading[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("iot_room_state_decoded")
    .select("farm_uid, module_uid, mesure_dt, received_at, decoded_json")
    .order("received_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  // (farm_uid, module_uid)별 최신 1행만 유지
  const latestByModule = new Map<string, DecodedRow>();
  for (const row of data as DecodedRow[]) {
    const mk = `${row.farm_uid}-${row.module_uid}`;
    if (!latestByModule.has(mk)) latestByModule.set(mk, row);
  }

  const readings: BarnReading[] = [];
  for (const row of latestByModule.values()) {
    const status = statusFromAge(row.received_at);
    const controllers = row.decoded_json?.controllers ?? [];
    for (const c of controllers) {
      const idx = c.idx ?? 0;
      const eqpmnNo = c.eqpmnNo ?? String(idx + 1).padStart(2, "0");
      readings.push({
        key: `${row.farm_uid}-${row.module_uid}-${idx}`,
        farmUid: row.farm_uid,
        moduleUid: row.module_uid,
        idx,
        eqpmnNo,
        label: `컨트롤러 ${eqpmnNo}`,
        tempC: pick(c.ES01),
        humidityPct: pick(c.ES02),
        fanSupply: pick(c.EC01),
        fanExhaust: pick(c.EC02),
        fanIntake: pick(c.EC03),
        fanSupplySeries: pickSeries(c.EC01),
        fanExhaustSeries: pickSeries(c.EC02),
        fanIntakeSeries: pickSeries(c.EC03),
        mesureDt: c.mesureDt ?? row.mesure_dt,
        receivedAt: row.received_at,
        status,
      });
    }
  }

  readings.sort((a, b) =>
    a.farmUid !== b.farmUid
      ? a.farmUid - b.farmUid
      : a.moduleUid !== b.moduleUid
        ? a.moduleUid - b.moduleUid
        : a.idx - b.idx
  );

  return readings;
}

export function summarizeBarns(readings: BarnReading[]): BarnSummary {
  return {
    total: readings.length,
    normal: readings.filter((r) => r.status === "normal").length,
    caution: readings.filter((r) => r.status === "caution").length,
    offline: readings.filter((r) => r.status === "offline").length,
  };
}

export type ModuleReceipt = {
  farmUid: number;
  moduleUid: number;
  receivedAt: string;
  status: ControllerStatus;
};

export type FarmOverview = {
  farmCount: number;
  moduleCount: number;
  controllerCount: number;
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

export function summarizeFarm(readings: BarnReading[]): FarmOverview {
  const moduleMap = new Map<string, ModuleReceipt>();
  for (const r of readings) {
    const mk = `${r.farmUid}-${r.moduleUid}`;
    if (!moduleMap.has(mk)) {
      moduleMap.set(mk, {
        farmUid: r.farmUid,
        moduleUid: r.moduleUid,
        receivedAt: r.receivedAt,
        status: r.status,
      });
    }
  }

  const receipts = [...moduleMap.values()].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );

  return {
    farmCount: new Set(readings.map((r) => r.farmUid)).size,
    moduleCount: moduleMap.size,
    controllerCount: readings.length,
    offlineCount: readings.filter((r) => r.status === "offline").length,
    avgTempC: avg(readings.map((r) => r.tempC)),
    avgHumidityPct: avg(readings.map((r) => r.humidityPct)),
    avgFanSupply: avg(readings.map((r) => r.fanSupply)),
    avgFanExhaust: avg(readings.map((r) => r.fanExhaust)),
    avgFanIntake: avg(readings.map((r) => r.fanIntake)),
    receipts,
  };
}
