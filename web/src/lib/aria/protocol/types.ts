/** ARIA 판단 프로토콜 — 계약 타입 */

export type AriaRoute = "CHAT" | "FARM" | "CTRL";

/** FARM 드릴다운 깊이 1~4 */
export type AriaDepth = 1 | 2 | 3 | 4;

export type AriaJudgeCode = "OK" | "WARN" | "CRIT" | "RECOMMEND" | "CLARIFY";

export type AriaSayCode =
  | "TYPE_SUMMARY"
  | "ALARM_LIST"
  | "CTRL_LIST"
  | "DIAG"
  | "OK"
  | "NEED_CLARIFY"
  | "REC_TEXT";

/** CTRL — 임계값/알람 설정 변경이 아닌 현장 대응 방안 */
export type AriaRecCode =
  | "RAISE_MAX_VENT"
  | "CHECK_COOLING"
  | "CHECK_HEATING"
  | "CHECK_HUMIDITY"
  | "INSTRUCT_WORKER"
  | "CHECK_OFFLINE"
  | "NONE";

export type AriaNextHint = "ASK_DETAIL" | "ASK_CTRL" | "ASK_DIAG" | "NONE";

export type AriaSession = {
  depth: AriaDepth;
  focusStallType: string | null;
  focusStallNo: string | null;
  lastRoute: AriaRoute | null;
};

export type AriaFarmJudge = {
  route: "FARM";
  depth: AriaDepth;
  judge: AriaJudgeCode;
  focusStallType: string | null;
  focusStallNo: string | null;
  say: AriaSayCode[];
  nextHint: AriaNextHint;
};

export type AriaCtrlJudge = {
  route: "CTRL";
  judge: "RECOMMEND" | "CLARIFY";
  rec: AriaRecCode;
  /** @deprecated 임계 DELTA 미사용 — 대응 코드만 */
  delta: number | null;
  say: AriaSayCode[];
};

export type AriaChatResult = {
  route: "CHAT";
  text: string;
};

export type AriaProtocolResult = {
  text: string;
  route: AriaRoute;
  session: AriaSession;
  /** openai judge/chat | heuristic unpack | legacy template */
  source: "protocol" | "protocol_heuristic" | "chat" | "template" | "openai";
};

/**
 * DEPTH별 **해당 레이어만** UNPACK (이전 DEPTH에서 말한 내용을 반복하지 않음).
 * D4 = 컨트롤러 위치 + 진단 유형만.
 */
export const SAY_FOR_DEPTH: Record<AriaDepth, AriaSayCode[]> = {
  1: ["TYPE_SUMMARY"],
  2: ["ALARM_LIST"],
  3: ["CTRL_LIST"],
  4: ["DIAG"],
};

export function emptyAriaSession(): AriaSession {
  return {
    depth: 1,
    focusStallType: null,
    focusStallNo: null,
    lastRoute: null,
  };
}

export function clampDepth(n: number): AriaDepth {
  if (n <= 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 4;
}
