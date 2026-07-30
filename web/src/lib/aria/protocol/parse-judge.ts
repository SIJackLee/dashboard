import {
  SAY_FOR_DEPTH,
  clampDepth,
  type AriaCtrlJudge,
  type AriaDepth,
  type AriaFarmJudge,
  type AriaJudgeCode,
  type AriaNextHint,
  type AriaRecCode,
  type AriaSayCode,
} from "@/lib/aria/protocol/types";
import type { VoiceFarmFacts } from "@/lib/voice-report/types";

/** AI judge 텍스트 파싱 — 실패 시 null */
export function parseFarmJudge(raw: string): AriaFarmJudge | null {
  const text = raw.trim();
  if (!text) return null;

  const depth = clampDepth(numField(text, "DEPTH") ?? 1);
  const judge = (field(text, "JUDGE") as AriaJudgeCode | null) ?? "WARN";
  const focusLine = field(text, "FOCUS") ?? "";
  const focusStallType = focusKv(focusLine, "STALL_TYPE");
  const focusStallNo = focusKv(focusLine, "STALL_NO");
  const say = parseSayList(field(text, "SAY"));
  const nextHint = (field(text, "NEXT_HINT") as AriaNextHint | null) ?? "NONE";

  const allowedJudge: AriaJudgeCode[] = [
    "OK",
    "WARN",
    "CRIT",
    "RECOMMEND",
    "CLARIFY",
  ];
  if (!allowedJudge.includes(judge)) return null;

  return {
    route: "FARM",
    depth,
    judge,
    focusStallType,
    focusStallNo,
    say: say.length ? say : [...SAY_FOR_DEPTH[depth]],
    nextHint,
  };
}

export function parseCtrlJudge(raw: string): AriaCtrlJudge | null {
  const text = raw.trim();
  if (!text) return null;
  const judgeRaw = field(text, "JUDGE");
  const judge =
    judgeRaw === "CLARIFY" ? "CLARIFY" : ("RECOMMEND" as const);
  const recLine = field(text, "REC") ?? "NONE";
  const recPart = recLine.split("|")[0]?.trim() ?? "NONE";
  const rec = mapRecCode(recPart);
  return {
    route: "CTRL",
    judge,
    rec,
    delta: null,
    say: ["REC_TEXT"],
  };
}

/** OpenAI 없이 DEPTH·facts로 결정적 judge */
export function heuristicFarmJudge(
  facts: VoiceFarmFacts,
  depthReq: AriaDepth,
  question: string,
): AriaFarmJudge {
  // 질문에 축사유형이 있으면만 focus. 없으면 전체 (최다 건에 묻히지 않음)
  const focus =
    facts.stalls.find((s) => question.includes(s.stallLabel))?.stallLabel ??
    null;

  let judge: AriaJudgeCode = "OK";
  if (facts.alarmCritical > 0) judge = "CRIT";
  else if (facts.alarmTotal > 0) judge = "WARN";

  const say: AriaSayCode[] =
    facts.alarmTotal === 0 ? ["OK"] : [...SAY_FOR_DEPTH[depthReq]];

  let nextHint: AriaNextHint = "NONE";
  if (depthReq < 3 && facts.alarmTotal > 0) nextHint = "ASK_CTRL";
  else if (depthReq < 4 && facts.alarmTotal > 0) nextHint = "ASK_DIAG";

  return {
    route: "FARM",
    depth: depthReq,
    judge,
    focusStallType: focus,
    focusStallNo: null,
    say,
    nextHint,
  };
}

export function heuristicCtrlJudge(facts: VoiceFarmFacts): AriaCtrlJudge {
  const top = facts.alarmItems[0];
  if (!top) {
    return {
      route: "CTRL",
      judge: "RECOMMEND",
      rec: "NONE",
      delta: null,
      say: ["REC_TEXT"],
    };
  }
  if (top.alarmType.includes("통신")) {
    return {
      route: "CTRL",
      judge: "RECOMMEND",
      rec: "CHECK_OFFLINE",
      delta: null,
      say: ["REC_TEXT"],
    };
  }
  if (top.alarmType.includes("온도 상한")) {
    return {
      route: "CTRL",
      judge: "RECOMMEND",
      rec: "RAISE_MAX_VENT",
      delta: null,
      say: ["REC_TEXT"],
    };
  }
  if (top.alarmType.includes("온도 하한")) {
    return {
      route: "CTRL",
      judge: "RECOMMEND",
      rec: "CHECK_HEATING",
      delta: null,
      say: ["REC_TEXT"],
    };
  }
  if (top.alarmType.includes("습도")) {
    return {
      route: "CTRL",
      judge: "RECOMMEND",
      rec: "CHECK_HUMIDITY",
      delta: null,
      say: ["REC_TEXT"],
    };
  }
  return {
    route: "CTRL",
    judge: "RECOMMEND",
    rec: "INSTRUCT_WORKER",
    delta: null,
    say: ["REC_TEXT"],
  };
}

function mapRecCode(raw: string): AriaRecCode {
  const allowed: AriaRecCode[] = [
    "RAISE_MAX_VENT",
    "CHECK_COOLING",
    "CHECK_HEATING",
    "CHECK_HUMIDITY",
    "INSTRUCT_WORKER",
    "CHECK_OFFLINE",
    "NONE",
  ];
  if ((allowed as string[]).includes(raw)) return raw as AriaRecCode;
  // 레거시 임계 변경 코드 → 대응 방안으로 매핑
  if (raw === "LOWER_TEMP_HIGH") return "RAISE_MAX_VENT";
  if (raw === "RAISE_TEMP_LOW") return "CHECK_HEATING";
  if (raw === "LOWER_HUM_HIGH" || raw === "RAISE_HUM_LOW") {
    return "CHECK_HUMIDITY";
  }
  return "NONE";
}

function field(text: string, key: string): string | null {
  const re = new RegExp(`^${key}\\s*:\\s*(.+)$`, "im");
  const m = re.exec(text);
  return m?.[1]?.trim() ?? null;
}

function numField(text: string, key: string): number | null {
  const v = field(text, key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function focusKv(line: string, key: string): string | null {
  const re = new RegExp(`${key}\\s*=\\s*([^|\\s]+)`);
  const m = re.exec(line);
  const v = m?.[1]?.trim();
  return v && v.length > 0 ? v : null;
}

function parseSayList(raw: string | null): AriaSayCode[] {
  if (!raw) return [];
  const allowed: AriaSayCode[] = [
    "TYPE_SUMMARY",
    "ALARM_LIST",
    "CTRL_LIST",
    "DIAG",
    "OK",
    "NEED_CLARIFY",
    "REC_TEXT",
  ];
  return raw
    .split(/[,+\s]+/)
    .map((s) => s.trim())
    .filter((s): s is AriaSayCode =>
      (allowed as string[]).includes(s),
    );
}
