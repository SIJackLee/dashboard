/**
 * 장비코드(eqpmnCode) — EC/ES 등 UI 표시명
 * MQTT·DB·명령 payload 는 원문 코드 유지.
 */

export const EQPMN_CODE_NAMES: Record<string, string> = {
  EC01: "송풍팬",
  EC02: "배기팬",
  EC03: "입기팬",
  ES01: "온도센서",
  ES02: "습도센서",
};

export function normalizeEqpmnCode(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase();
}

/** UI 표시용 — EC01 → 송풍팬 */
export function formatEqpmnCodeLabel(code: string | null | undefined): string {
  const key = normalizeEqpmnCode(code);
  if (!key) return "—";
  if (EQPMN_CODE_NAMES[key]) return EQPMN_CODE_NAMES[key];
  if (key.startsWith("EC")) return "환기·제어장비";
  if (key.startsWith("ES")) return "환경센서";
  return "장비";
}

const SLOT_DEFAULT_EQPMN = {
  A: "EC03",
  B: "EC02",
  C: "EC01",
} as const;

export function formatChannelEquipmentLabel(
  slot: keyof typeof SLOT_DEFAULT_EQPMN,
  eqpmnCode?: string | null
): string {
  const code = eqpmnCode ?? SLOT_DEFAULT_EQPMN[slot];
  return formatEqpmnCodeLabel(code);
}
