/**
 * 이상상황 = 모듈 + 통신두절 (온·습 임계 파생 제외)
 * 실행: npx tsx src/lib/data/situation-alarms.test.ts
 */
import assert from "node:assert/strict";
import {
  isModuleAlarmRow,
  mergeSituationAlarms,
  type AlarmRow,
} from "./alarms";
import type { BarnReading } from "./iot";

function reading(
  partial: Pick<BarnReading, "controllerKey" | "status"> &
    Partial<BarnReading>,
): BarnReading {
  return {
    key: partial.key ?? partial.controllerKey,
    farmKey: partial.farmKey ?? { lsindRegistNo: "F1", itemCode: "P00" },
    moduleUid: partial.moduleUid ?? 1,
    controllerKey: partial.controllerKey,
    eqpmnNo: partial.eqpmnNo ?? "01",
    stallNo: partial.stallNo ?? "1",
    stallTyCode: partial.stallTyCode ?? "SP01",
    label: partial.label ?? partial.controllerKey,
    tempC: partial.tempC ?? 25,
    humidityPct: partial.humidityPct ?? 50,
    fanSupply: null,
    fanExhaust: null,
    fanIntake: null,
    fanSupplySeries: [],
    fanExhaustSeries: [],
    fanIntakeSeries: [],
    mesureDt: null,
    receivedAt: partial.receivedAt ?? new Date().toISOString(),
    status: partial.status,
    packetMode: "live",
    wireVer: null,
  };
}

const moduleRow: AlarmRow = {
  id: "m1",
  occurredAt: new Date().toISOString(),
  farmKey: { lsindRegistNo: "F1", itemCode: "P00" },
  moduleUid: 1,
  controllerKey: "c1",
  eqpmnNo: "01",
  stallNo: "1",
  stallTyCode: "SP01",
  alarmType: "E01",
  severity: "critical",
  status: "active",
  detail: "모듈 에러",
  controllerStatus: "normal",
  source: "module",
};

{
  const merged = mergeSituationAlarms(
    [moduleRow],
    [
      reading({ controllerKey: "c1", status: "normal" }),
      reading({ controllerKey: "c2", status: "offline" }),
      reading({
        controllerKey: "c3",
        status: "caution",
        tempC: 99,
      }),
    ],
  );
  assert.equal(merged.length, 2);
  assert.ok(isModuleAlarmRow(merged[0]!));
  assert.equal(merged[1]!.alarmType, "통신 두절");
  assert.equal(isModuleAlarmRow(merged[1]!), false);
  assert.ok(
    !merged.some(
      (a) => a.alarmType.includes("온도") || a.alarmType.includes("습도"),
    ),
  );
  console.log("situation-alarms: merge module+offline, skip threshold — ok");
}

console.log("situation-alarms.test.ts: all ok");
