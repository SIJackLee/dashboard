import assert from "node:assert/strict";
import { DEFAULT_ALARM_SETTINGS } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import { assembleFarmFacts } from "@/lib/voice-report/assemble-farm-facts";

const farmKey = { lsindRegistNo: "FARM01", itemCode: "P00" };

const reading: BarnReading = {
  key: "k1",
  farmKey,
  moduleUid: 1,
  controllerKey: "SP01:01:EC01",
  eqpmnNo: "EC01",
  stallNo: "01",
  stallTyCode: "SP01",
  label: "테스트",
  tempC: 25,
  humidityPct: 60,
  fanSupply: null,
  fanExhaust: null,
  fanIntake: null,
  fanSupplySeries: [],
  fanExhaustSeries: [],
  fanIntakeSeries: [],
  mesureDt: null,
  receivedAt: new Date().toISOString(),
  status: "normal",
  packetMode: "live",
  wireVer: 0x0a,
};

const facts = assembleFarmFacts({
  farmKey,
  farmLabel: "테스트농장",
  readings: [reading],
  alarmSettings: DEFAULT_ALARM_SETTINGS,
});

assert.equal(facts.farmLabel, "테스트농장");
assert.equal(facts.totalControllers, 1);
assert.equal(facts.onlineControllers, 1);
assert.equal(facts.stalls.length, 1);
assert.equal(facts.stalls[0]?.tempAvgC, 25);
assert.equal(facts.stalls[0]?.env?.tempFit, "high");
assert.equal(facts.stalls[0]?.env?.recommendTempC, 21);
assert.equal(facts.stalls[0]?.env?.humidityFit, "ok");

console.log("assemble-farm-facts.test.ts: ok");
