import type { VoiceFarmFacts } from "@/lib/voice-report/types";
import {
  pigEnvFitLabel,
  pigEnvFitOffBand,
} from "@/lib/farm/pig-env-recommend";
import { VOICE_LIMITS } from "@/lib/voice-report/limits";
import { truncateChars } from "@/lib/voice-report/parse-farm-from-question";
import {
  SAY_FOR_DEPTH,
  type AriaCtrlJudge,
  type AriaFarmJudge,
  type AriaRecCode,
  type AriaSayCode,
} from "@/lib/aria/protocol/types";
import { phraseIndex, phraseSeed } from "@/lib/aria/protocol/route";

/** 최고환기량 상한(%) — 이 값 이상이면 MAX로 보고 현장 확인 유도 */
export const MAX_VENT_PCT_CEILING = 100;

type AlarmItem = VoiceFarmFacts["alarmItems"][number];

export function unpackFarmJudge(
  judge: AriaFarmJudge,
  facts: VoiceFarmFacts,
  opts?: {
    seed?: string;
    criticalOnly?: boolean;
    moreStep?: boolean;
    whoController?: boolean;
  },
): string {
  const seed = opts?.seed ?? `${facts.farmLabel}:${judge.depth}`;
  const criticalOnly = Boolean(opts?.criticalOnly);
  if (judge.say.includes("OK") && judge.judge === "OK") {
    return truncateChars(blockOk(facts, seed), VOICE_LIMITS.maxAnswerChars());
  }

  const say = normalizeFarmSay(judge);
  const parts: string[] = [];

  if (opts?.moreStep) {
    parts.push(moreLead(judge.depth, seed));
  }

  if (say.includes("TYPE_SUMMARY")) {
    parts.push(blockTypeSummary(facts, seed, criticalOnly));
  }
  if (say.includes("ALARM_LIST")) {
    parts.push(
      blockAlarmList(facts, judge.focusStallType, seed, criticalOnly),
    );
  }
  if (say.includes("CTRL_LIST")) {
    parts.push(
      blockCtrlList(
        facts,
        judge.focusStallType,
        seed,
        criticalOnly,
        Boolean(opts?.whoController),
      ),
    );
  }
  if (say.includes("DIAG")) {
    parts.push(blockDiag(facts, judge.focusStallType, criticalOnly, seed));
  }
  if (say.includes("NEED_CLARIFY")) {
    parts.push("어느 축사유형을 말씀하시는지 알려 주세요.");
  }
  if (parts.length === 0) {
    parts.push(blockTypeSummary(facts, seed, criticalOnly));
  }

  return truncateChars(parts.filter(Boolean).join(" "), VOICE_LIMITS.maxAnswerChars());
}

export function unpackCtrlJudge(
  judge: AriaCtrlJudge,
  facts: VoiceFarmFacts,
): string {
  const top = facts.alarmItems[0];
  if (top?.alarmType.includes("통신")) {
    const loc = spokenLocation(top);
    const text = ctrlActionText(judge.rec, top, loc);
    return truncateChars(text, VOICE_LIMITS.maxAnswerChars());
  }
  const envText = unpackCtrlEnv(judge.rec, facts);
  if (envText) {
    return truncateChars(envText, VOICE_LIMITS.maxAnswerChars());
  }
  if (!top) {
    return truncateChars(
      `${spokenFarm(facts.farmLabel)} 기준 활성 이상상황이 없습니다. 지금은 추가 대응 추천이 없습니다.`,
      VOICE_LIMITS.maxAnswerChars(),
    );
  }

  const loc = spokenLocation(top);
  const text = ctrlActionText(judge.rec, top, loc);
  return truncateChars(text, VOICE_LIMITS.maxAnswerChars());
}

function unpackCtrlEnv(
  rec: AriaRecCode,
  facts: VoiceFarmFacts,
): string | null {
  if (
    rec !== "RAISE_MAX_VENT" &&
    rec !== "CHECK_COOLING" &&
    rec !== "CHECK_HEATING" &&
    rec !== "CHECK_HUMIDITY"
  ) {
    return null;
  }
  const stall = facts.stalls.find(
    (s) =>
      s.env != null &&
      (pigEnvFitOffBand(s.env.tempFit) || pigEnvFitOffBand(s.env.humidityFit)),
  );
  if (!stall?.env) return null;
  const bits = spokenEnvStall(stall);
  if (!bits) return null;
  const farm = spokenFarm(facts.farmLabel);
  const action =
    rec === "RAISE_MAX_VENT"
      ? "최고환기량을 올려 온도를 낮춰 보세요."
      : rec === "CHECK_HEATING"
        ? "난방·보온 상태를 현장에서 확인해 보세요."
        : rec === "CHECK_HUMIDITY"
          ? "가습·제습·환기 균형을 현장에서 맞춰 보세요."
          : "쿨링·입기 상태를 현장에서 확인해 보세요.";
  return `${farm} 기준, ${bits}. ${action} 알람 임계값은 바꾸지 마세요.`;
}

export function unpackMoreAtCeiling(): string {
  return "진단은 여기까지입니다. 대응 방안이 필요하시면 「설정 추천」또는 「어떻게 대응할까」라고 물어봐 주세요.";
}

export function unpackBareRecommendClarify(): string {
  return "어떤 이상에 대한 대응을 추천할까요? 「온도」「통신」「습도」처럼 말씀해 주세요.";
}

export function unpackThresholdRefuse(): string {
  return "알람 임계값은 바꾸지 않습니다. 현장 대응이 필요하시면 「설정 추천」또는 「어떻게 대응할까」라고 물어봐 주세요.";
}

export function unpackFragmentClarify(question: string): string {
  const q = question.trim();
  if (/컨트롤러/.test(q)) {
    return "어느 컨트롤러를 말씀하시는지 알려 주세요. 「어느 컨트롤러」처럼 물어보시면 위치를 말씀드립니다.";
  }
  if (/농장|축사/.test(q)) {
    return "농장 현황이시면 「상황 어때」라고 말씀해 주세요.";
  }
  return "조금 더 구체적으로 말씀해 주세요. 예: 「상황 어때」, 「뭐가 문제야」.";
}

function moreLead(depth: AriaFarmJudge["depth"], seed: string): string {
  if (depth === 2) {
    return pick(seed, [
      "이어서 유형만 말씀드립니다.",
      "다음으로 알람 종류입니다.",
    ], "more2");
  }
  if (depth === 3) {
    return pick(seed, [
      "이어서 대상 위치입니다.",
      "다음으로 컨트롤러 위치입니다.",
    ], "more3");
  }
  if (depth === 4) {
    return pick(seed, [
      "이어서 진단입니다.",
      "다음으로 건별 진단입니다.",
    ], "more4");
  }
  return "이어서 말씀드립니다.";
}

function normalizeFarmSay(judge: AriaFarmJudge): AriaSayCode[] {
  if (judge.say.includes("OK") && judge.judge === "OK") return ["OK"];
  if (judge.say.includes("NEED_CLARIFY")) return ["NEED_CLARIFY"];
  const allowed = new Set(SAY_FOR_DEPTH[judge.depth]);
  const filtered = judge.say.filter(
    (s) => allowed.has(s) || s === "OK" || s === "NEED_CLARIFY",
  );
  if (filtered.length === 0) return [...SAY_FOR_DEPTH[judge.depth]];
  return filtered;
}

/** 커스텀 농장명 그대로, 없으면 `등록번호 · 축종` → `축종 농장` */
function spokenFarm(label: string): string {
  const custom = label.trim();
  if (!custom) return label;
  if (!/^[A-Za-z0-9]+\s*·\s*/.test(custom)) return custom;
  const stripped = custom.replace(/^[A-Za-z0-9]+\s*·\s*/, "").trim();
  if (!stripped || stripped === custom) return custom;
  return `${stripped} 농장`;
}

function filterItems(
  items: AlarmItem[],
  focus: string | null,
  criticalOnly: boolean,
): AlarmItem[] {
  let list = focus ? items.filter((a) => a.stallLabel === focus) : items;
  if (criticalOnly) list = list.filter((a) => a.severity === "critical");
  return list;
}

function blockOk(facts: VoiceFarmFacts, seed: string): string {
  const n = facts.onlineControllers;
  const farm = spokenFarm(facts.farmLabel);
  const mapped = facts.stalls.filter((s) => s.env);
  if (mapped.length > 0) {
    const env = "축사유형별 권장 온·습도 안에 있습니다";
    return pick(seed, [
      `${farm} 기준, ${env}. 컨트롤러 ${n}대가 온라인입니다.`,
      `지금은 ${farm}에서 ${env}. 온라인 ${n}대입니다.`,
      `${farm}은 ${env}. 컨트롤러 ${n}대가 온라인입니다.`,
    ], "ok");
  }
  return pick(seed, [
    `${farm} 기준, 현재 확인된 이상상황이 없습니다. 컨트롤러 ${n}대가 온라인입니다.`,
    `지금은 ${farm}에 활성 이상이 없습니다. 온라인 ${n}대입니다.`,
    `${farm}은 이상 없이 조용합니다. 컨트롤러 ${n}대가 온라인입니다.`,
  ], "ok");
}

function blockTypeSummary(
  facts: VoiceFarmFacts,
  seed: string,
  criticalOnly: boolean,
): string {
  const farm = spokenFarm(facts.farmLabel);
  if (criticalOnly) {
    const n = facts.alarmCritical;
    const bits = facts.stalls
      .map((s) => {
        const c = facts.alarmItems.filter(
          (a) => a.stallLabel === s.stallLabel && a.severity === "critical",
        ).length;
        return c > 0 ? `${s.stallLabel} ${c}건` : null;
      })
      .filter(Boolean)
      .join(", ");
    if (n === 0) return `${farm} 기준, 위험 등급 이상상황은 없습니다.`;
    return pick(seed, [
      `${farm} 기준, 위험 이상상황 ${n}건입니다. ${bits}.`,
      `위험만 보면 ${farm}에 ${n}건입니다. ${bits}.`,
    ], "d1crit");
  }
  const env = blockEnvSummary(facts);
  if (facts.alarmTotal === 0) {
    return `${farm} 기준, ${env}`;
  }
  const bits = facts.stalls
    .filter((s) => s.alarmCount > 0)
    .map((s) => `${s.stallLabel} ${s.alarmCount}건`)
    .join(", ");
  const crit =
    facts.alarmCritical > 0 ? `위험 ${facts.alarmCritical}건 포함` : "위험 없음";
  const n = facts.alarmTotal;
  return pick(seed, [
    `${farm} 기준, ${env} 이상상황 ${n}건입니다(${crit}). ${bits}.`,
    `지금 ${farm}을 보면 ${env} 이상상황이 ${n}건입니다(${crit}). 축사별로 ${bits}.`,
    `${farm} 현황입니다. ${env} 이상 ${n}건(${crit}). ${bits} 쪽을 먼저 보시면 됩니다.`,
    `확인 결과 ${farm}에 ${env} 이상 ${n}건입니다(${crit}). ${bits}.`,
  ], "d1");
}

function blockEnvSummary(facts: VoiceFarmFacts): string {
  const mapped = facts.stalls.filter((s) => s.env);
  if (mapped.length === 0) {
    return "권장 환경으로 볼 축사유형이 없습니다.";
  }
  const off = mapped.filter(
    (s) =>
      s.env != null &&
      (pigEnvFitOffBand(s.env.tempFit) || pigEnvFitOffBand(s.env.humidityFit)),
  );
  if (off.length === 0) {
    return "축사유형별 권장 온·습도 안에 있습니다.";
  }
  const bits = off.map((s) => spokenEnvStall(s)).join(". ");
  return `${bits}.`;
}

function spokenEnvStall(
  s: VoiceFarmFacts["stalls"][number],
): string {
  const env = s.env;
  if (!env) return s.stallLabel;
  const parts: string[] = [];
  if (pigEnvFitOffBand(env.tempFit) && s.tempAvgC != null) {
    const rec =
      env.recommendTempC != null ? ` 목표는 ${fmtTempSpoken(env.recommendTempC)}입니다` : "";
    parts.push(
      `${s.stallLabel} 온도 ${fmtTempSpoken(s.tempAvgC)}로 권장 ${fmtTempSpoken(env.tempMinC)}에서 ${fmtTempSpoken(env.tempMaxC)}보다 ${pigEnvFitLabel(env.tempFit)}입니다${rec}`,
    );
  }
  if (pigEnvFitOffBand(env.humidityFit) && s.humidityAvgPct != null) {
    const rec =
      env.recommendHumidityPct != null
        ? ` 목표는 ${fmtPctSpoken(env.recommendHumidityPct)}입니다`
        : "";
    parts.push(
      `${s.stallLabel} 습도 ${fmtPctSpoken(s.humidityAvgPct)}로 권장 ${fmtPctSpoken(env.humidityMinPct)}에서 ${fmtPctSpoken(env.humidityMaxPct)}보다 ${pigEnvFitLabel(env.humidityFit)}입니다${rec}`,
    );
  }
  return parts.join(". ") || s.stallLabel;
}

function fmtTempSpoken(n: number): string {
  const t = Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  return `${t}도`;
}

function fmtPctSpoken(n: number): string {
  return `${Math.round(n)}%`;
}

function blockAlarmList(
  facts: VoiceFarmFacts,
  focus: string | null,
  seed: string,
  criticalOnly: boolean,
): string {
  const items = filterItems(facts.alarmItems, focus, criticalOnly);
  if (items.length === 0) {
    return criticalOnly
      ? "위험으로 집계된 세부 항목은 없습니다."
      : "경고·위험으로 집계된 세부 항목은 없습니다.";
  }

  const counts = new Map<string, { n: number; sev: string }>();
  for (const a of items) {
    const sev = a.severity === "critical" ? "위험" : "주의";
    const key = `${sev}|${a.alarmType}`;
    const cur = counts.get(key) ?? { n: 0, sev };
    cur.n += 1;
    counts.set(key, cur);
  }
  const list = [...counts.entries()]
    .map(([k, v]) => {
      const type = k.split("|")[1] ?? k;
      return `${v.sev} ${type} ${v.n}건`;
    })
    .slice(0, 6)
    .join(", ");
  const scope = focus ? `${focus}에서는 ` : "";
  const only = criticalOnly ? "위험만 보면 " : "";
  return pick(seed, [
    `${scope}${only}세부 유형은 ${list}입니다.`,
    `${scope}${only}걸린 알람 종류는 ${list}입니다.`,
    `${scope}${only}유형별로 보면 ${list}입니다.`,
  ], "d2");
}

function blockCtrlList(
  facts: VoiceFarmFacts,
  focus: string | null,
  seed: string,
  criticalOnly: boolean,
  whoController: boolean,
): string {
  const items = filterItems(facts.alarmItems, focus, criticalOnly);
  if (items.length === 0) return "해당 컨트롤러 목록이 없습니다.";

  const locs = items.map((a) => spokenLocation(a));
  const unique = [...new Set(locs)];
  const top = unique.slice(0, 3);
  const rest = unique.length - top.length;
  const joined =
    rest > 0 ? `${top.join(", ")} 외 ${rest}곳` : top.join(", ");
  const lead = whoController
    ? "사람 이름이 아니라, 이상이 난 컨트롤러 위치를 말씀드립니다. "
    : "";
  const body = pick(
    seed,
    [
      `대상 컨트롤러는 ${joined}입니다.`,
      `확인해 볼 위치는 ${joined}입니다.`,
      `지금은 ${joined} 쪽을 보시면 됩니다.`,
    ],
    "ctrl_list",
  );
  return `${lead}${body}`;
}

function pick(seed: string, options: string[], intent = "farm"): string {
  return (
    options[phraseIndex(phraseSeed(intent, seed), options.length)] ??
    options[0]!
  );
}

function blockDiag(
  facts: VoiceFarmFacts,
  focus: string | null,
  criticalOnly: boolean,
  seed: string,
): string {
  const items = filterItems(facts.alarmItems, focus, criticalOnly);
  if (items.length === 0) {
    return criticalOnly
      ? "위험으로 진단할 활성 이상이 없습니다."
      : "진단할 활성 이상이 없습니다.";
  }

  type Group = {
    stallLabel: string;
    stallNo: string | null;
    type: string;
    eqs: string[];
  };
  const order: string[] = [];
  const map = new Map<string, Group>();

  for (const a of items.slice(0, 12)) {
    const key = `${a.stallLabel}|${a.stallNo ?? ""}|${a.alarmType}`;
    let g = map.get(key);
    if (!g) {
      g = {
        stallLabel: a.stallLabel,
        stallNo: a.stallNo,
        type: a.alarmType,
        eqs: [],
      };
      map.set(key, g);
      order.push(key);
    }
    const eq = dispUnit(a.eqpmnNo);
    if (eq && !g.eqs.includes(eq)) g.eqs.push(eq);
  }

  const clauses = order.map((k) => {
    const g = map.get(k)!;
    const eqs = joinEqList(g.eqs);
    const stall = g.stallNo
      ? `${g.stallLabel} 축사 ${dispUnit(g.stallNo)}번의 `
      : `${g.stallLabel} `;
    return `${stall}${eqs} 컨트롤러는 ${g.type}`;
  });

  if (clauses.length === 0) return "진단할 활성 이상이 없습니다.";
  const body =
    clauses.length === 1
      ? `${clauses[0]}입니다.`
      : `${clauses.slice(0, -1).join(". ")}. ${clauses[clauses.length - 1]}입니다.`;
  const intro = pick(
    seed,
    ["진단 결과입니다.", "건별로 보면 다음과 같습니다.", ""],
    "diag",
  );
  return intro ? `${intro} ${body}` : body;
}

function joinEqList(eqs: string[]): string {
  if (eqs.length === 0) return "해당";
  if (eqs.length === 1) return `${eqs[0]}번`;
  if (eqs.length === 2) return `${eqs[0]}번과 ${eqs[1]}번`;
  return `${eqs.slice(0, -1).map((e) => `${e}번`).join(", ")}, ${eqs[eqs.length - 1]}번`;
}

function dispUnit(raw: string | null | undefined): string {
  if (raw == null) return "";
  const t = String(raw).trim();
  if (!t) return "";
  const n = Number(t);
  return Number.isFinite(n) ? String(n) : t.replace(/^0+(?=\d)/, "");
}

function spokenLocation(a: AlarmItem): string {
  const stall = a.stallNo
    ? `${a.stallLabel} 축사 ${dispUnit(a.stallNo)}번`
    : a.stallLabel;
  const eq = dispUnit(a.eqpmnNo);
  return eq ? `${stall}의 ${eq}번 컨트롤러` : `${stall} 컨트롤러`;
}

function isMaxVent(pct: number | null | undefined): boolean {
  return pct != null && Number.isFinite(pct) && pct >= MAX_VENT_PCT_CEILING;
}

function ctrlActionText(
  rec: AriaRecCode,
  top: AlarmItem,
  loc: string,
): string {
  const max = top.maxVentPct;
  const head = `${loc} · ${top.alarmType}.`;

  switch (rec) {
    case "RAISE_MAX_VENT": {
      if (isMaxVent(max)) {
        return `${head} 최고환기량은 이미 최대(${MAX_VENT_PCT_CEILING}%)입니다. 현장에서 쿨링·입기·장비 상태를 확인해 보세요.`;
      }
      return max != null && Number.isFinite(max)
        ? `${loc}의 최고환기량을 올려보세요. 현재 최고환기량은 ${formatPct(max)}입니다. 알람 임계값은 바꾸지 마세요.`
        : `${loc}의 최고환기량을 올려보세요. 알람 임계값은 바꾸지 마세요.`;
    }
    case "CHECK_COOLING":
      return `${head} 쿨링·입기 상태를 현장에서 확인해 보세요. 알람 임계값은 바꾸지 마세요.`;
    case "CHECK_HEATING":
      return `${head} 난방·보온 상태를 현장에서 확인해 보세요. 알람 임계값은 바꾸지 마세요.`;
    case "CHECK_HUMIDITY":
      return `${head} 가습·제습·환기 균형을 현장에서 맞춰 보세요. 알람 임계값은 바꾸지 마세요.`;
    case "INSTRUCT_WORKER":
      return `${head} 현장 작업자에게 ${loc} 점검을 지시해 보세요.`;
    case "CHECK_OFFLINE":
      return `${head} 전원·네트워크·장비 상태를 현장에서 먼저 확인해 보세요.`;
    default:
      return `${head} 지금은 추가 대응 추천이 없습니다. 추이를 지켜봐 주세요.`;
  }
}

function formatPct(n: number): string {
  return Number.isInteger(n) ? `${n}%` : `${Math.round(n * 10) / 10}%`;
}
