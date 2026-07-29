import "server-only";

import type { CurrentUser } from "@/lib/auth/get-current-user";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { getAlarmSettings } from "@/lib/data/alarm-settings";
import {
  deriveAlarmsFromReadings,
  summarizeAlarms,
} from "@/lib/data/alarms";
import { getLiveReadings } from "@/lib/data/iot";
import { STALL_TYPE_NAMES, normalizeStallTyCode } from "@/lib/data/stall-type";
import { VOICE_LIMITS } from "@/lib/voice-report/limits";
import type { VoiceFarmFacts } from "@/lib/voice-report/types";

/** 프롬프트 한도 안에서 「어느 컨트롤러?」에 답할 수 있는 상위 건수 */
const MAX_ALARM_ITEMS = 24;

export function canReadFarm(user: CurrentUser, farmKey: FarmKey): boolean {
  if (user.isAdmin) return true;
  return user.accesses.some(
    (a) =>
      a.can_read &&
      a.lsind_regist_no === farmKey.lsindRegistNo &&
      a.item_code === farmKey.itemCode,
  );
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export async function buildFarmFacts(farmKey: FarmKey): Promise<VoiceFarmFacts> {
  const [readings, alarmSettings] = await Promise.all([
    getLiveReadings({ farmKey, slim: true }),
    getAlarmSettings(),
  ]);
  const scoped = readings.filter(
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
    scoped.map((r) => [r.controllerKey, r.label || r.eqpmnNo || r.controllerKey]),
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
          labelByKey.get(a.controllerKey) ?? a.eqpmnNo ?? a.controllerKey,
        controllerKey: a.controllerKey,
        eqpmnNo: a.eqpmnNo,
        alarmType: a.alarmType,
        severity: a.severity,
        detail: a.detail,
      };
    });

  return {
    farmKey,
    farmLabel: farmKeyId(farmKey),
    totalControllers: scoped.length,
    onlineControllers: online,
    offlineControllers: scoped.length - online,
    alarmTotal: alarmSum.total,
    alarmCritical: alarmSum.critical,
    alarmWarning: alarmSum.warning,
    stalls,
    alarmItems,
    generatedAt: new Date().toISOString(),
  };
}

export function factsToPromptJson(facts: VoiceFarmFacts): string {
  const raw = JSON.stringify(facts);
  const max = VOICE_LIMITS.maxFactChars();
  if (raw.length <= max) return raw;
  return raw.slice(0, max);
}

/** OpenAI 없이 UI/권한 검증용 템플릿 요약 */
export function buildTemplateSummary(facts: VoiceFarmFacts, maxChars: number): string {
  const stallBits = facts.stalls
    .map((s) => `${s.stallLabel} 이상상황 ${s.alarmCount}건`)
    .join(", ");
  const tempBits = facts.stalls
    .filter((s) => s.tempAvgC != null)
    .map((s) => `${s.stallLabel} 평균 ${s.tempAvgC}도`)
    .slice(0, 3)
    .join(", ");

  let text =
    `${facts.farmLabel} 기준, 현재 집계 ${facts.totalControllers}대 중 ` +
    `온라인 ${facts.onlineControllers}대입니다. ` +
    `전체 이상상황 ${facts.alarmTotal}건` +
    (facts.alarmCritical > 0 ? `(위험 ${facts.alarmCritical})` : "") +
    `입니다.`;
  if (stallBits) text += ` ${stallBits}.`;
  if (facts.alarmItems.length > 0) {
    const top = facts.alarmItems
      .slice(0, 3)
      .map(
        (a) =>
          `${a.stallLabel}${a.stallNo ? ` ${a.stallNo}번` : ""} ${a.controllerLabel}(${a.alarmType})`,
      )
      .join(", ");
    text += ` 주요 알람: ${top}.`;
  }
  if (tempBits) text += ` 온도는 ${tempBits} 수준입니다.`;

  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1).trimEnd() + "…";
}
