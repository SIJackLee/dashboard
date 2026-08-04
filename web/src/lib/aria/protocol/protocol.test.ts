/**
 * 실행: npx tsx src/lib/aria/protocol/protocol.test.ts
 */
import assert from "node:assert/strict";
import { chatHeuristicReply } from "./chat-heuristic";
import { packFarmProtocol } from "./pack";
import {
  heuristicCtrlJudge,
  heuristicFarmJudge,
  parseCtrlJudge,
  parseFarmJudge,
} from "./parse-judge";
import {
  resolveDepthReq,
  routeByRules,
  wantsCriticalOnly,
  isFragmentQuestion,
  phraseIndex,
  phraseSeed,
} from "./route";
import { emptyAriaSession } from "./types";
import {
  unpackCtrlJudge,
  unpackFarmJudge,
  unpackFragmentClarify,
  unpackMoreAtCeiling,
  unpackThresholdRefuse,
} from "./unpack";
import type { VoiceFarmFacts } from "@/lib/voice-report/types";

const sampleFacts: VoiceFarmFacts = {
  farmKey: { lsindRegistNo: "FARM01", itemCode: "P00" },
  farmLabel: "FARM01 · 양돈",
  totalControllers: 10,
  onlineControllers: 9,
  offlineControllers: 1,
  alarmTotal: 3,
  alarmCritical: 2,
  alarmWarning: 1,
  stalls: [
    {
      stallTyCode: "01",
      stallLabel: "임신사",
      controllers: 5,
      online: 5,
      alarmCount: 1,
      tempAvgC: 28.4,
      humidityAvgPct: 70,
    },
    {
      stallTyCode: "03",
      stallLabel: "분만사",
      controllers: 5,
      online: 4,
      alarmCount: 2,
      tempAvgC: 28.0,
      humidityAvgPct: 75,
    },
  ],
  alarmItems: [
    {
      stallLabel: "임신사",
      stallNo: "01",
      controllerLabel: "축사 01 · 01번",
      controllerKey: "hidden-key",
      eqpmnNo: "01",
      alarmType: "온도 상한 초과",
      severity: "critical",
      detail: "29.1℃ ≥ 28℃",
      maxVentPct: 80,
    },
    {
      stallLabel: "분만사",
      stallNo: "01",
      controllerLabel: "축사 01 · 01번",
      controllerKey: "hidden-key-2",
      eqpmnNo: "01",
      alarmType: "통신 두절",
      severity: "critical",
      detail: "15분 이상 미수신",
      maxVentPct: null,
    },
    {
      stallLabel: "분만사",
      stallNo: "01",
      controllerLabel: "축사 01 · 03번",
      controllerKey: "hidden-key-3",
      eqpmnNo: "03",
      alarmType: "통신 두절",
      severity: "critical",
      detail: "15분 이상 미수신",
      maxVentPct: null,
    },
    {
      stallLabel: "분만사",
      stallNo: "01",
      controllerLabel: "축사 01 · 02번",
      controllerKey: "hidden-key-4",
      eqpmnNo: "02",
      alarmType: "습도 상한 초과",
      severity: "warning",
      detail: "85% ≥ 80%",
      maxVentPct: null,
    },
  ],
  generatedAt: new Date().toISOString(),
};

{
  assert.equal(routeByRules("안녕하세요"), "CHAT");
  assert.equal(routeByRules("날씨 어때"), "CHAT");
  assert.equal(routeByRules("괜찮니"), "CHAT");
  assert.equal(routeByRules("지금 어때"), "CHAT");
  assert.equal(routeByRules("오늘 농장 상황 어때?"), "FARM");
  assert.equal(routeByRules("설정 추천해줘"), "CTRL");
  assert.equal(routeByRules("환기 어떻게"), "CTRL");
  assert.equal(routeByRules("추천해줘"), "CTRL");
  assert.equal(routeByRules("알람 상한 낮춰줘"), "CTRL");
}

{
  assert.match(chatHeuristicReply("안녕"), /델린/);
  assert.match(chatHeuristicReply("도움"), /상황 어때/);
  assert.match(chatHeuristicReply("hi"), /델린/);
  assert.doesNotMatch(
    chatHeuristicReply("델린 뭐야"),
    /Agricultural Reporting/,
  );
}

{
  assert.equal(resolveDepthReq("상황 어때", null), 1);
  assert.equal(resolveDepthReq("왜 그래", null), 2);
  assert.equal(resolveDepthReq("자세히 진단까지", null), 4);
  assert.equal(resolveDepthReq("진단해줘", null), 4);
  assert.equal(resolveDepthReq("디테일하게", null), 4);
  assert.equal(resolveDepthReq("건별로", null), 4);
  assert.equal(resolveDepthReq("하나씩 진단", null), 4);
  const sess1 = {
    ...emptyAriaSession(),
    depth: 1 as const,
    lastRoute: "FARM" as const,
  };
  assert.equal(resolveDepthReq("더 알려줘", sess1), 2);
  const sess4 = { ...sess1, depth: 4 as const };
  assert.equal(resolveDepthReq("더 알려줘", sess4), 4);
  assert.ok(wantsCriticalOnly("위험만 말해"));
}

{
  const pack = packFarmProtocol({
    question: "상황 어때",
    depthReq: 2,
    facts: sampleFacts,
  });
  assert.match(pack, /ROUTE: FARM/);
  assert.doesNotMatch(pack, /hidden-key/);
}

{
  const judge = heuristicFarmJudge(sampleFacts, 4, "자세히");
  const text = unpackFarmJudge(judge, sampleFacts, { seed: "자세히" });
  assert.match(text, /임신사 축사 1번의 1번 컨트롤러는 온도 상한 초과/);
  assert.match(text, /1번과 3번 컨트롤러는 통신 두절/);
  assert.doesNotMatch(text, /FARM01\/P00/);
  assert.doesNotMatch(text, /hidden-key/);
}

{
  const judge = heuristicFarmJudge(sampleFacts, 3, "누가");
  const text = unpackFarmJudge(judge, sampleFacts, {
    seed: "누가",
    whoController: true,
  });
  assert.match(text, /사람 이름이 아니라/);
  assert.match(text, /컨트롤러/);
}

{
  assert.ok(isFragmentQuestion("컨트롤러가"));
  assert.match(unpackFragmentClarify("컨트롤러가"), /어느 컨트롤러/);
}

{
  const a = phraseIndex(phraseSeed("d1", "상황 어때"), 4);
  const b = phraseIndex(phraseSeed("d1", "오늘 상황 어때"), 4);
  assert.equal(typeof a, "number");
  assert.equal(typeof b, "number");
}

{
  const judge = heuristicFarmJudge(sampleFacts, 2, "더 알려줘");
  const text = unpackFarmJudge(judge, sampleFacts, {
    seed: "더 알려줘",
    moreStep: true,
  });
  assert.match(text, /이어서|다음으로/);
}

{
  const judge = heuristicFarmJudge(sampleFacts, 2, "위험만 말해");
  const text = unpackFarmJudge(judge, sampleFacts, {
    seed: "위험만 말해",
    criticalOnly: true,
  });
  assert.match(text, /위험/);
  assert.doesNotMatch(text, /주의/);
  assert.doesNotMatch(text, /습도 상한/);
}

{
  const cj = heuristicCtrlJudge(sampleFacts);
  assert.equal(cj.rec, "RAISE_MAX_VENT");
  const text = unpackCtrlJudge(cj, sampleFacts);
  assert.match(text, /최고환기량을 올려보세요/);
  assert.match(text, /현재 최고환기량은 80%/);
}

{
  const named = { ...sampleFacts, farmLabel: "햇살농장", alarmTotal: 0 };
  const judge = heuristicFarmJudge(named, 1, "상황 어때");
  const text = unpackFarmJudge(
    { ...judge, judge: "OK", say: ["OK"] },
    named,
    { seed: "상황 어때" },
  );
  assert.match(text, /햇살농장/);
  assert.doesNotMatch(text, /양돈 농장/);
}

{
  const parsed = parseCtrlJudge(
    "ROUTE: CTRL\nJUDGE: RECOMMEND\nREC: CHECK_OFFLINE\nSAY: REC_TEXT",
  );
  assert.equal(parsed!.rec, "CHECK_OFFLINE");
  assert.equal(
    parseCtrlJudge(
      "ROUTE: CTRL\nJUDGE: RECOMMEND\nREC: LOWER_TEMP_HIGH\nSAY: REC_TEXT",
    )!.rec,
    "RAISE_MAX_VENT",
  );
}

{
  const parsed = parseFarmJudge(`ROUTE: FARM
DEPTH: 4
JUDGE: CRIT
FOCUS: STALL_TYPE=분만사
SAY: DIAG
NEXT_HINT: NONE`);
  assert.ok(parsed);
  assert.deepEqual(parsed!.say, ["DIAG"]);
}

console.log("aria protocol tests: ok");
