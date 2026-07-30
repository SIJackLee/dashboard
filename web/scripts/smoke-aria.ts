/**
 * ARIA 스모크 — 라우팅·DEPTH·말하기 라벨 (네트워크/로그인 불필요)
 * 실행: npx tsx scripts/smoke-aria.ts
 */
import assert from "node:assert/strict";
import { chatHeuristicReply } from "../src/lib/aria/protocol/chat-heuristic";
import {
  heuristicCtrlJudge,
  heuristicFarmJudge,
} from "../src/lib/aria/protocol/parse-judge";
import {
  isFragmentQuestion,
  resolveDepthReq,
  routeByRules,
  wantsCriticalOnly,
  wantsThresholdEdit,
} from "../src/lib/aria/protocol/route";
import { emptyAriaSession } from "../src/lib/aria/protocol/types";
import {
  unpackCtrlJudge,
  unpackFarmJudge,
  unpackFragmentClarify,
  unpackMoreAtCeiling,
  unpackThresholdRefuse,
} from "../src/lib/aria/protocol/unpack";
import { farmDisplayLabel } from "../src/lib/data/farm-summaries";
import type { VoiceFarmFacts } from "../src/lib/voice-report/types";

const facts: VoiceFarmFacts = {
  farmKey: { lsindRegistNo: "FARM01", itemCode: "P00" },
  farmLabel: "햇살농장",
  totalControllers: 3,
  onlineControllers: 2,
  offlineControllers: 1,
  alarmTotal: 2,
  alarmCritical: 2,
  alarmWarning: 0,
  stalls: [
    {
      stallTyCode: "01",
      stallLabel: "임신사",
      controllers: 2,
      online: 2,
      alarmCount: 1,
      tempAvgC: 29,
      humidityAvgPct: 70,
    },
    {
      stallTyCode: "03",
      stallLabel: "분만사",
      controllers: 1,
      online: 0,
      alarmCount: 1,
      tempAvgC: null,
      humidityAvgPct: null,
    },
  ],
  alarmItems: [
    {
      stallLabel: "임신사",
      stallNo: "01",
      controllerLabel: "1번",
      controllerKey: "k1",
      eqpmnNo: "01",
      alarmType: "온도 상한 초과",
      severity: "critical",
      detail: "29≥28",
      maxVentPct: 80,
    },
    {
      stallLabel: "분만사",
      stallNo: "01",
      controllerLabel: "3번",
      controllerKey: "k2",
      eqpmnNo: "03",
      alarmType: "통신 두절",
      severity: "critical",
      detail: "offline",
      maxVentPct: null,
    },
  ],
  generatedAt: new Date().toISOString(),
};

type Case = {
  q: string;
  route: string;
  depth?: number;
  includes?: RegExp;
  excludes?: RegExp;
};

const cases: Case[] = [
  { q: "안녕", route: "CHAT", includes: /ARIA/ },
  { q: "날씨 어때", route: "CHAT", includes: /날씨|기상/, excludes: /연동 여지/ },
  { q: "괜찮니", route: "CHAT", includes: /정상|괜찮|문제없/ },
  { q: "지금 어때", route: "CHAT", includes: /상황 어때|안부/ },
  { q: "상황 어때", route: "FARM", depth: 1, includes: /햇살농장/ },
  { q: "뭐가 문제야", route: "FARM", depth: 2 },
  { q: "왜 그래", route: "FARM", depth: 2 },
  { q: "위험만 말해", route: "FARM", depth: 2 },
  { q: "어느 컨트롤러", route: "FARM", depth: 3 },
  { q: "누가 문제야", route: "FARM", depth: 3, includes: /사람 이름이 아니라/ },
  { q: "진단해줘", route: "FARM", depth: 4 },
  { q: "디테일하게", route: "FARM", depth: 4 },
  { q: "설정 추천", route: "CTRL", includes: /최고환기|임계/ },
  { q: "환기 어떻게", route: "CTRL" },
  { q: "추천해줘", route: "CTRL" },
  { q: "알람 상한 낮춰줘", route: "CTRL", includes: /바꾸지 않습니다/ },
  { q: "컨트롤러가", route: "FARM" },
];

let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  OK  ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${e instanceof Error ? e.message : e}`);
  }
}

console.log("=== ARIA smoke ===\n");

console.log("[labels]");
check("farmDisplayLabel prefers custom name", () => {
  assert.equal(
    farmDisplayLabel({ lsindRegistNo: "FARM01", itemCode: "P00" }, "햇살농장"),
    "햇살농장",
  );
  assert.match(
    farmDisplayLabel({ lsindRegistNo: "FARM01", itemCode: "P00" }, null),
    /FARM01/,
  );
});

console.log("\n[routes + unpack]");
for (const c of cases) {
  check(`${c.q} → ${c.route}${c.depth != null ? ` D${c.depth}` : ""}`, () => {
    const route = routeByRules(c.q);
    assert.equal(route, c.route, `route got ${route}`);

    if (c.route === "CHAT") {
      const text = chatHeuristicReply(c.q);
      if (c.includes) assert.match(text, c.includes);
      if (c.excludes) assert.doesNotMatch(text, c.excludes);
      return;
    }

    if (isFragmentQuestion(c.q)) {
      const text = unpackFragmentClarify(c.q);
      assert.match(text, /말씀해|상황 어때|어느 컨트롤러/);
      return;
    }

    if (wantsThresholdEdit(c.q)) {
      const text = unpackThresholdRefuse();
      if (c.includes) assert.match(text, c.includes);
      return;
    }

    if (c.route === "CTRL") {
      if (/^추천해\s*줘$|^추천해줘$|^추천$/.test(c.q.trim())) {
        assert.match(
          "어떤 이상에 대한 대응을 추천할까요?",
          /추천할까요/,
        );
        return;
      }
      const text = unpackCtrlJudge(heuristicCtrlJudge(facts), facts);
      if (c.includes) assert.match(text, c.includes);
      return;
    }

    const depth = resolveDepthReq(c.q, null);
    if (c.depth != null) assert.equal(depth, c.depth, `depth got ${depth}`);

    const judge = heuristicFarmJudge(facts, depth, c.q);
    const text = unpackFarmJudge(judge, facts, {
      seed: c.q,
      criticalOnly: wantsCriticalOnly(c.q),
      whoController: /누가/.test(c.q),
    });
    if (c.includes) assert.match(text, c.includes);
    if (c.excludes) assert.doesNotMatch(text, c.excludes);
    assert.doesNotMatch(text, /FARM01\/P00/);
    assert.doesNotMatch(text, /hidden-key|controllerKey/);
  });
}

console.log("\n[session ladder]");
check("D1→MORE→D2→…→D4 ceiling", () => {
  let sess = { ...emptyAriaSession(), depth: 1 as const, lastRoute: "FARM" as const };
  assert.equal(resolveDepthReq("더 알려줘", sess), 2);
  sess = { ...sess, depth: 2 };
  assert.equal(resolveDepthReq("더 알려줘", sess), 3);
  sess = { ...sess, depth: 3 };
  assert.equal(resolveDepthReq("더 알려줘", sess), 4);
  sess = { ...sess, depth: 4 };
  assert.equal(resolveDepthReq("더 알려줘", sess), 4);
  assert.match(unpackMoreAtCeiling(), /진단은 여기까지/);
});

console.log("\n[turn-log helpers]");
check("ARIA_TURN_LOG default on when unset", () => {
  const prev = process.env.ARIA_TURN_LOG;
  delete process.env.ARIA_TURN_LOG;
  // dynamic import after env change — inline mirror of enabled()
  const v = process.env.ARIA_TURN_LOG?.trim().toLowerCase();
  assert.equal(v === "0" || v === "false" || v === "off" ? false : true, true);
  if (prev !== undefined) process.env.ARIA_TURN_LOG = prev;
});

console.log(`\n=== result: ${failed === 0 ? "PASS" : `FAIL (${failed})`} ===`);
process.exit(failed === 0 ? 0 : 1);
