/**
 * 이상상황 가정 → ARIA 시나리오 예상 답변
 * 실행: npx tsx scripts/predict-aria-scenarios-alarmed.ts
 */
import Module from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const originalLoad = (Module as unknown as { _load: typeof Module._load })._load;
(Module as unknown as { _load: typeof Module._load })._load = function (
  request: string,
  parent: NodeModule,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

async function main() {
  const { heuristicCtrlJudge, heuristicFarmJudge } = await import(
    "../src/lib/aria/protocol/parse-judge"
  );
  const { resolveDepthReq, routeByRules } = await import(
    "../src/lib/aria/protocol/route"
  );
  const { unpackCtrlJudge, unpackFarmJudge } = await import(
    "../src/lib/aria/protocol/unpack"
  );
  const { emptyAriaSession } = await import("../src/lib/aria/protocol/types");
  const { farmShortLabel } = await import("../src/lib/data/farm-summaries");

  const farmKey = { lsindRegistNo: "FARM01", itemCode: "P00" };
  const farmLabel = farmShortLabel(farmKey);

  /** Live 구조(임신1·분만6·자돈6) 유지 + 이상 가정 */
  const facts = {
    farmKey,
    farmLabel,
    totalControllers: 13,
    onlineControllers: 12,
    offlineControllers: 1,
    alarmTotal: 5,
    alarmCritical: 3,
    alarmWarning: 2,
    stalls: [
      {
        stallTyCode: "SP02",
        stallLabel: "임신사",
        controllers: 1,
        online: 1,
        alarmCount: 1,
        tempAvgC: 29.1,
        humidityAvgPct: 59.4,
      },
      {
        stallTyCode: "SP03",
        stallLabel: "분만사",
        controllers: 6,
        online: 5,
        alarmCount: 3,
        tempAvgC: 28.6,
        humidityAvgPct: 72.0,
      },
      {
        stallTyCode: "SP05",
        stallLabel: "자돈사",
        controllers: 6,
        online: 6,
        alarmCount: 1,
        tempAvgC: 25.1,
        humidityAvgPct: 57.3,
      },
    ],
    alarmItems: [
      {
        stallLabel: "임신사",
        stallNo: "01",
        controllerLabel: "축사 01 · 01번",
        controllerKey: "SP02:01:01",
        eqpmnNo: "01",
        alarmType: "온도 상한 초과",
        severity: "critical" as const,
        detail: "29.1℃ ≥ 28℃",
      },
      {
        stallLabel: "분만사",
        stallNo: "01",
        controllerLabel: "축사 01 · 01번",
        controllerKey: "SP03:01:01",
        eqpmnNo: "01",
        alarmType: "온도 상한 초과",
        severity: "critical" as const,
        detail: "28.8℃ ≥ 28℃",
      },
      {
        stallLabel: "분만사",
        stallNo: "01",
        controllerLabel: "축사 01 · 03번",
        controllerKey: "SP03:01:03",
        eqpmnNo: "03",
        alarmType: "통신 두절",
        severity: "critical" as const,
        detail: "15분 이상 미수신",
      },
      {
        stallLabel: "분만사",
        stallNo: "01",
        controllerLabel: "축사 01 · 02번",
        controllerKey: "SP03:01:02",
        eqpmnNo: "02",
        alarmType: "습도 상한 초과",
        severity: "warning" as const,
        detail: "85% ≥ 80%",
      },
      {
        stallLabel: "자돈사",
        stallNo: "01",
        controllerLabel: "축사 01 · 04번",
        controllerKey: "SP05:01:04",
        eqpmnNo: "04",
        alarmType: "습도 하한 미만",
        severity: "warning" as const,
        detail: "28% ≤ 30%",
      },
    ],
    generatedAt: new Date().toISOString(),
  };

  type Pred = {
    n: number;
    utterance: string;
    route: string;
    depth: number | null;
    factsMode: "skip" | "load";
    say: string;
    text: string;
    note: string;
  };

  const rows: Pred[] = [];

  rows.push({
    n: 1,
    utterance: "안녕",
    route: "CHAT",
    depth: null,
    factsMode: "skip",
    say: "자유 응대",
    text: "안녕하세요. 저는 ARIA입니다. 농장 현황은 「상황 어때?」처럼 질문해 주세요.",
    note: "이상 가정과 무관 · facts 미조회",
  });

  rows.push({
    n: 2,
    utterance: "ARIA가 뭐야",
    route: "CHAT",
    depth: null,
    factsMode: "skip",
    say: "자유 응대",
    text: "델린은 축사 환경·가축 현황을 말로 안내하는 AI입니다. 이상상황·온도는 「상황 어때?」로 물어봐 주세요.",
    note: "CHAT · 수치 언급 금지",
  });

  for (const [n, q, note] of [
    [3, "상황 어때", "TYPE_SUMMARY"] as const,
    [4, "뭐가 문제야", "TYPE_SUMMARY+ALARM_LIST"] as const,
    [5, "어느 컨트롤러", "+CTRL_LIST"] as const,
    [6, "자세히 진단까지", "+DIAG 한 턴"] as const,
  ]) {
    const depth = resolveDepthReq(q, null);
    const judge = heuristicFarmJudge(facts, depth, q);
    rows.push({
      n,
      utterance: q,
      route: routeByRules(q),
      depth,
      factsMode: "load",
      say: judge.say.join(", "),
      text: unpackFarmJudge(judge, facts),
      note,
    });
  }

  {
    const q = "더 알려줘";
    const sess = {
      ...emptyAriaSession(),
      depth: 1 as const,
      lastRoute: "FARM" as const,
    };
    const depth = resolveDepthReq(q, sess);
    const judge = heuristicFarmJudge(facts, depth, q);
    rows.push({
      n: 7,
      utterance: "더 알려줘 (세션 D1 후)",
      route: routeByRules(q),
      depth,
      factsMode: "load",
      say: judge.say.join(", "),
      text: unpackFarmJudge(judge, facts),
      note: `session D1→D${depth}`,
    });
  }

  for (const [n, q] of [
    [8, "설정 추천"] as const,
    [9, "온도 상한 추천해줘"] as const,
  ]) {
    const judge = heuristicCtrlJudge(facts);
    rows.push({
      n,
      utterance: q,
      route: routeByRules(q),
      depth: null,
      factsMode: "load",
      say: `REC=${judge.rec}`,
      text: unpackCtrlJudge(judge, facts),
      note: `top alarm 기준 · delta=${judge.delta}`,
    });
  }

  {
    const bits = facts.stalls
      .map((s) => `${s.stallLabel} 이상 ${s.alarmCount}건`)
      .join(", ");
    rows.push({
      n: 10,
      utterance: "상황 어때 (flag off)",
      route: "LEGACY",
      depth: null,
      factsMode: "load",
      say: "자유 요약",
      text: `${facts.farmLabel} 기준 이상상황 ${facts.alarmTotal}건(위험 ${facts.alarmCritical}). ${bits}. (레거시 Chat이 JSON으로 자유 문장 — 문구 가변)`,
      note: "ARIA_PROTOCOL_V1=off",
    });
  }

  const out = {
    assumption: {
      title: "이상상황 가정 facts",
      farmLabel,
      summary:
        "임신사 온도 상한 1 · 분만사 온도상한+통신두절+습도상한 · 자돈사 습도하한 · 오프라인 1대",
      alarmTotal: facts.alarmTotal,
      alarmCritical: facts.alarmCritical,
      alarmWarning: facts.alarmWarning,
      online: `${facts.onlineControllers}/${facts.totalControllers}`,
      stalls: facts.stalls,
      alarmItems: facts.alarmItems.map(
        ({
          stallLabel,
          stallNo,
          controllerLabel,
          alarmType,
          severity,
          detail,
        }) => ({
          stallLabel,
          stallNo,
          controllerLabel,
          alarmType,
          severity,
          detail,
        }),
      ),
    },
    rows,
  };

  const canvasDir = resolve(
    process.env.USERPROFILE ?? "",
    ".cursor/projects/c-Users-jack3-OneDrive-Desktop-SI1/canvases",
  );
  mkdirSync(canvasDir, { recursive: true });
  writeFileSync(
    resolve(canvasDir, "aria-protocol-alarmed-predictions.payload.json"),
    JSON.stringify(out, null, 2),
    "utf8",
  );
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
