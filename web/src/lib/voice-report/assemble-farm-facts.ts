import type { AlarmSettings } from "@/lib/data/alarms";
import {
  deriveAlarmsFromReadings,
  summarizeAlarms,
} from "@/lib/data/alarms";
import type { FarmKey } from "@/lib/data/farm-key";
import type { BarnReading } from "@/lib/data/iot";
import { STALL_TYPE_NAMES, normalizeStallTyCode } from "@/lib/data/stall-type";
import type { VoiceFarmFacts } from "@/lib/voice-report/types";

function controllerDisplayLabel(args: {
  label?: string | null;
  eqpmnNo?: string | null;
  stallNo?: string | null;
}): string {
  const label = args.label?.trim();
  if (label) return label;
  const eqpmnNo = args.eqpmnNo?.trim();
  if (eqpmnNo) return `장비 ${eqpmnNo}`;
  const stallNo = args.stallNo?.trim();
  if (stallNo) return `축사 ${stallNo} 컨트롤러`;
  return "컨트롤러";
}

/** 프롬프트 한도 안에서 「어느 컨트롤러?」에 답할 수 있는 상위 건수 */
export const MAX_ALARM_ITEMS = 24;

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

/**
 * LIVE readings + 알람 설정 → VoiceFarmFacts (서버/클라 공용).
 * DB 조회 없음 — soft ARIA metrics가 허브 slice를 재사용할 때 사용.
 */
export function assembleFarmFacts(args: {
  farmKey: FarmKey;
  farmLabel: string;
  readings: BarnReading[];
  alarmSettings: AlarmSettings;
  generatedAt?: string;
}): VoiceFarmFacts {
  const { farmKey, farmLabel, alarmSettings } = args;
  const scoped = args.readings.filter(
    (r) =>
      r.farmKey.lsindRegistNo === farmKey.lsindRegistNo &&
      r.farmKey.itemCode === farmKey.itemCode,
  );
  const alarms = deriveAlarmsFromReadings(scoped, alarmSettings);
  const alarmSum = summarizeAlarms(alarms);

  const byTy = new Map<
    string,
    {
      stallTyCode: string;
      stallLabel: string;
      controllers: number;
      online: number;
      temps: number[];
      hums: number[];
      alarmCount: number;
    }
  >();

  for (const r of scoped) {
    const code = normalizeStallTyCode(r.stallTyCode) || "UNK";
    const label = STALL_TYPE_NAMES[code] ?? (code === "UNK" ? "미분류" : code);
    let g = byTy.get(code);
    if (!g) {
      g = {
        stallTyCode: code,
        stallLabel: label,
        controllers: 0,
        online: 0,
        temps: [],
        hums: [],
        alarmCount: 0,
      };
      byTy.set(code, g);
    }
    g.controllers += 1;
    if (r.status !== "offline") g.online += 1;
    if (r.tempC != null) g.temps.push(r.tempC);
    if (r.humidityPct != null) g.hums.push(r.humidityPct);
  }

  for (const a of alarms) {
    const code = normalizeStallTyCode(a.stallTyCode) || "UNK";
    const g = byTy.get(code);
    if (g) g.alarmCount += 1;
  }

  const stalls = [...byTy.values()]
    .map((g) => ({
      stallTyCode: g.stallTyCode,
      stallLabel: g.stallLabel,
      controllers: g.controllers,
      online: g.online,
      alarmCount: g.alarmCount,
      tempAvgC: avg(g.temps),
      humidityAvgPct: avg(g.hums),
    }))
    .sort((a, b) => a.stallTyCode.localeCompare(b.stallTyCode));

  const online = scoped.filter((r) => r.status !== "offline").length;

  const labelByKey = new Map(
    scoped.map((r) => [
      r.controllerKey,
      controllerDisplayLabel({
        label: r.label,
        eqpmnNo: r.eqpmnNo,
        stallNo: r.stallNo,
      }),
    ]),
  );

  const ventByKey = new Map(
    scoped.map((r) => [
      r.controllerKey,
      r.thermo?.maxVentPct != null && Number.isFinite(r.thermo.maxVentPct)
        ? Number(r.thermo.maxVentPct)
        : null,
    ]),
  );

  const alarmItems = [...alarms]
    .sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === "critical" ? -1 : 1;
      }
      return a.occurredAt < b.occurredAt ? 1 : -1;
    })
    .slice(0, MAX_ALARM_ITEMS)
    .map((a) => {
      const code = normalizeStallTyCode(a.stallTyCode) || "UNK";
      const stallLabel =
        STALL_TYPE_NAMES[code] ?? (code === "UNK" ? "미분류" : code);
      return {
        stallLabel,
        stallNo: a.stallNo,
        controllerLabel:
          labelByKey.get(a.controllerKey) ??
          controllerDisplayLabel({
            eqpmnNo: a.eqpmnNo,
            stallNo: a.stallNo,
          }),
        controllerKey: a.controllerKey,
        eqpmnNo: a.eqpmnNo,
        alarmType: a.alarmType,
        severity: a.severity,
        detail: a.detail,
        maxVentPct: ventByKey.get(a.controllerKey) ?? null,
      };
    });

  return {
    farmKey,
    farmLabel,
    totalControllers: scoped.length,
    onlineControllers: online,
    offlineControllers: scoped.length - online,
    alarmTotal: alarmSum.total,
    alarmCritical: alarmSum.critical,
    alarmWarning: alarmSum.warning,
    stalls,
    alarmItems,
    generatedAt: args.generatedAt ?? new Date().toISOString(),
  };
}
