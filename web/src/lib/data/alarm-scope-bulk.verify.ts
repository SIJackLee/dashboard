/**
 * applyBulkSpAlarmThresholds cascade verification.
 * Run: npx tsx src/lib/data/alarm-scope-bulk.verify.ts
 */
import type { BarnReading } from "@/lib/data/iot";
import type { AlarmSettings } from "@/lib/data/alarms";
import {
  applyBulkSpAlarmThresholds,
  resolveThresholdsForReading,
} from "@/lib/data/alarm-scope";

const farmKey = { lsindRegistNo: "FARM01", itemCode: "P00" };

function mockReading(partial: Partial<BarnReading> & Pick<BarnReading, "key" | "controllerKey" | "stallNo">): BarnReading {
  return {
    farmKey,
    moduleUid: 1,
    eqpmnNo: "01",
    stallTyCode: "SP01",
    label: partial.key,
    tempC: 23,
    humidityPct: 60,
    status: "normal",
    receivedAt: new Date().toISOString(),
    mesureDt: new Date().toISOString(),
    packetMode: "live",
    wireVer: 12,
    ...partial,
  } as BarnReading;
}

const settings: AlarmSettings = {
  global: { tempLow: 10, tempHigh: 35, humidityLow: 30, humidityHigh: 90 },
  byStallTyCode: {},
  byScope: {
    "farm:FARM01/P00|sp:SP01": {
      tempLow: 15,
      tempHigh: 28,
      humidityLow: 40,
      humidityHigh: 80,
    },
    "farm:FARM01/P00|sp:SP01|stall:01|ctrl:SP01%3A01%3A01": {
      tempLow: 5,
      tempHigh: 30,
      humidityLow: 11,
      humidityHigh: 70,
    },
    "farm:FARM01/P00|sp:SP01|stall:02|ctrl:SP01%3A02%3A01": {
      tempLow: 10,
      tempHigh: 35,
      humidityLow: 13,
      humidityHigh: 90,
    },
  },
};

const targets = [
  mockReading({ key: "a", controllerKey: "SP01:01:01", stallNo: "01", eqpmnNo: "01" }),
  mockReading({ key: "b", controllerKey: "SP01:01:02", stallNo: "01", eqpmnNo: "02" }),
  mockReading({ key: "c", controllerKey: "SP01:02:01", stallNo: "02", eqpmnNo: "01" }),
];

const bulk = { tempLow: 20, tempHigh: 30, humidityLow: 50, humidityHigh: 70 };
const { settings: next, clearedOverrides } = applyBulkSpAlarmThresholds(
  settings,
  targets,
  new Set(["SP01"]),
  bulk
);

const r0 = targets[0]!;
const r2 = targets[2]!;
const t0 = resolveThresholdsForReading(next, r0);
const t2 = resolveThresholdsForReading(next, r2);

const descendantKeys = Object.keys(next.byScope ?? {}).filter((k) =>
  k.includes("|stall:") || k.includes("|ctrl:")
);

let failed = 0;
if (clearedOverrides !== 2) {
  console.error("FAIL clearedOverrides", clearedOverrides, "expected 2");
  failed += 1;
}
if (descendantKeys.length !== 0) {
  console.error("FAIL descendant keys remain", descendantKeys);
  failed += 1;
}
if (t0.tempLow !== 20 || t0.humidityLow !== 50) {
  console.error("FAIL stall:01 ctrl:01 thresholds", t0);
  failed += 1;
}
if (t2.tempLow !== 20 || t2.humidityLow !== 50) {
  console.error("FAIL stall:02 ctrl:01 thresholds", t2);
  failed += 1;
}
if (next.byScope?.["farm:FARM01/P00|sp:SP01"]?.tempLow !== 20) {
  console.error("FAIL SP01 scope not updated");
  failed += 1;
}

if (failed === 0) {
  console.log("OK applyBulkSpAlarmThresholds cascade — cleared", clearedOverrides);
} else {
  process.exitCode = 1;
}
