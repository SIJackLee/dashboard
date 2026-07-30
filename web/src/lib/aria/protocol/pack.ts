import type { VoiceFarmFacts } from "@/lib/voice-report/types";
import type { AriaDepth, AriaSession } from "@/lib/aria/protocol/types";

/** 서버 → AI/로그용 pack 문자열 */
export function packFarmProtocol(args: {
  question: string;
  depthReq: AriaDepth;
  facts: VoiceFarmFacts;
  session?: AriaSession | null;
}): string {
  const { question, depthReq, facts, session } = args;
  const scopeStall =
    session?.focusStallType?.trim() ||
    detectStallTypeMention(question, facts) ||
    "";

  const lines: string[] = [
    "ROUTE: FARM",
    `Q: ${question.replace(/\n/g, " ").slice(0, 120)}`,
    `DEPTH_REQ: ${depthReq}`,
    `SCOPE: STALL_TYPE=${scopeStall} | STALL_NO=${session?.focusStallNo ?? ""} | CTRL=`,
    `FARM: ${facts.farmLabel}`,
    `TOTAL: ctrl=${facts.totalControllers}; online=${facts.onlineControllers}; alarm=${facts.alarmTotal}; crit=${facts.alarmCritical}; warn=${facts.alarmWarning}`,
    "FACT:",
  ];

  for (const s of facts.stalls) {
    lines.push(
      `  STALL_TYPE=${s.stallLabel}; alarm=${s.alarmCount}; tempAvg=${s.tempAvgC ?? "—"}; humAvg=${s.humidityAvgPct ?? "—"}`,
    );
  }

  const items = filterItems(facts, scopeStall).slice(0, 16);
  for (const a of items) {
    const sev = a.severity === "critical" ? "위험" : "주의";
    lines.push(
      `  ITEM: sev=${sev}; type=${a.alarmType}; stall=${a.stallNo ?? "—"}; ctrl=${a.controllerLabel}; detail=${a.detail}`,
    );
  }

  if (items.length === 0) {
    lines.push("  ITEM: none");
  }

  return lines.join("\n");
}

export function packCtrlProtocol(args: {
  question: string;
  facts: VoiceFarmFacts;
}): string {
  const { question, facts } = args;
  const top = facts.alarmItems[0];
  const stall = facts.stalls.find((s) => s.alarmCount > 0) ?? facts.stalls[0];

  return [
    "ROUTE: CTRL",
    `Q: ${question.replace(/\n/g, " ").slice(0, 120)}`,
    `FARM: ${facts.farmLabel}`,
    top
      ? `FACT: ctrl=${top.controllerLabel}; stall=${top.stallNo ?? "—"}; eq=${top.eqpmnNo}; type=${top.alarmType}; detail=${top.detail}; sev=${top.severity === "critical" ? "위험" : "주의"}; maxVent=${top.maxVentPct ?? "—"}`
      : `FACT: tempAvg=${stall?.tempAvgC ?? "—"}; humAvg=${stall?.humidityAvgPct ?? "—"}; alarms=없음`,
    "NOTE: 현장 대응만. 알람 임계·적용·명령 금지. maxVent이 최대(100)면 현장확인.",
  ].join("\n");
}

function detectStallTypeMention(
  question: string,
  facts: VoiceFarmFacts,
): string | null {
  for (const s of facts.stalls) {
    if (s.stallLabel && question.includes(s.stallLabel)) return s.stallLabel;
  }
  return null;
}

function filterItems(facts: VoiceFarmFacts, stallLabel: string) {
  if (!stallLabel) return facts.alarmItems;
  return facts.alarmItems.filter((a) => a.stallLabel === stallLabel);
}
