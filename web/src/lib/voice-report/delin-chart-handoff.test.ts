/**
 * 실행: npx tsx src/lib/voice-report/delin-chart-handoff.test.ts
 */
import assert from "node:assert/strict";
import { buildDelinAnswerExtras } from "./delin-chart-handoff";
import type { VoiceFarmFacts } from "./types";

const facts: VoiceFarmFacts = {
  farmKey: { lsindRegistNo: "FARM01", itemCode: "P00" },
  farmLabel: "FARM01 · 양돈",
  totalControllers: 3,
  onlineControllers: 3,
  offlineControllers: 0,
  alarmTotal: 2,
  alarmCritical: 1,
  alarmWarning: 1,
  stalls: [
    {
      stallTyCode: "SP03",
      stallLabel: "분만사",
      controllers: 2,
      online: 2,
      alarmCount: 2,
      tempAvgC: 28,
      humidityAvgPct: 70,
    },
  ],
  alarmItems: [
    {
      stallLabel: "분만사",
      stallNo: "01",
      controllerLabel: "01",
      controllerKey: "SP03:01:06",
      eqpmnNo: "06",
      alarmType: "온도 상한 초과",
      severity: "critical",
      detail: "26.1",
      maxVentPct: 80,
    },
  ],
  generatedAt: new Date().toISOString(),
};

{
  const ex = buildDelinAnswerExtras({
    route: "CHAT",
    facts,
  });
  assert.equal(ex.chartHandoff, null);
  assert.equal(ex.evidenceChips.length, 0);
}

{
  const ex = buildDelinAnswerExtras({
    route: "FARM",
    facts,
    focusStallType: "분만사",
  });
  assert.ok(ex.chartHandoff);
  assert.equal(ex.chartHandoff!.scope.level, "controller");
  assert.equal(ex.chartHandoff!.focusMetric, "temp");
  if (ex.chartHandoff!.scope.level === "controller") {
    assert.equal(ex.chartHandoff!.scope.stallTyCode, "SP03");
    assert.equal(ex.chartHandoff!.scope.controllerKey, "SP03:01:06");
  }
  assert.ok(ex.evidenceChips.some((c) => c.startsWith("위험")));
}

{
  const ex = buildDelinAnswerExtras({
    route: "FARM",
    facts: { ...facts, alarmItems: [] },
    focusStallType: "분만사",
  });
  assert.equal(ex.chartHandoff?.scope.level, "sp");
}

console.log("delin-chart-handoff: ok");
