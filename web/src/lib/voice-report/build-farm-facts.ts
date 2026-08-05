import "server-only";

import type { CurrentUser } from "@/lib/auth/get-current-user";
import type { FarmKey } from "@/lib/data/farm-key";
import { getAlarmSettings } from "@/lib/data/alarm-settings";
import { farmDisplayLabel } from "@/lib/data/farm-summaries";
import { getFarmLocation } from "@/lib/data/farm-location";
import { getLiveReadings } from "@/lib/data/iot";
import { VOICE_LIMITS } from "@/lib/voice-report/limits";
import { assembleFarmFacts } from "@/lib/voice-report/assemble-farm-facts";
import type { VoiceFarmFacts } from "@/lib/voice-report/types";

function severityLabel(severity: "warning" | "critical"): "주의" | "위험" {
  return severity === "critical" ? "위험" : "주의";
}

export function canReadFarm(user: CurrentUser, farmKey: FarmKey): boolean {
  if (user.isAdmin) return true;
  return user.accesses.some(
    (a) =>
      a.can_read &&
      a.lsind_regist_no === farmKey.lsindRegistNo &&
      a.item_code === farmKey.itemCode,
  );
}

export async function buildFarmFacts(farmKey: FarmKey): Promise<VoiceFarmFacts> {
  const [readings, alarmSettings, location] = await Promise.all([
    getLiveReadings({ farmKey, slim: true }),
    getAlarmSettings(),
    getFarmLocation(farmKey),
  ]);
  return assembleFarmFacts({
    farmKey,
    farmLabel: farmDisplayLabel(farmKey, location?.farmName),
    readings,
    alarmSettings,
  });
}

/** 모델에 넘기는 표시용 페이로드 — 내부 키·영문 기술 필드 제외 */
export function factsToPromptJson(facts: VoiceFarmFacts): string {
  const forPrompt = {
    농장: facts.farmLabel,
    컨트롤러합계: facts.totalControllers,
    온라인: facts.onlineControllers,
    오프라인: facts.offlineControllers,
    이상상황합계: facts.alarmTotal,
    위험: facts.alarmCritical,
    주의: facts.alarmWarning,
    축사유형별: facts.stalls.map((s) => ({
      축사유형: s.stallLabel,
      컨트롤러수: s.controllers,
      온라인: s.online,
      이상상황: s.alarmCount,
      평균온도C: s.tempAvgC,
      평균습도Pct: s.humidityAvgPct,
    })),
    이상상황목록: facts.alarmItems.map((a) => ({
      축사유형: a.stallLabel,
      축사번호: a.stallNo,
      컨트롤러: a.controllerLabel,
      장비번호: a.eqpmnNo,
      이상유형: a.alarmType,
      심각도: severityLabel(a.severity),
      상세: a.detail,
    })),
  };
  const raw = JSON.stringify(forPrompt);
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
          `${a.stallLabel}${a.stallNo ? ` ${a.stallNo}번` : ""} ${a.controllerLabel}(${a.alarmType}, ${severityLabel(a.severity)})`,
      )
      .join(", ");
    text += ` 주요 이상상황: ${top}.`;
  }
  if (tempBits) text += ` 온도는 ${tempBits} 수준입니다.`;

  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1).trimEnd() + "…";
}
