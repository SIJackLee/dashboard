/**
 * 실행: npx tsx src/lib/data/module-alarms.test.ts
 */
import assert from "node:assert/strict";
import {
  moduleAlarmToAlarmRow,
  severityForModuleErrCode,
  type ModuleAlarmDbRow,
} from "./module-alarms-map";

function sample(partial: Partial<ModuleAlarmDbRow> = {}): ModuleAlarmDbRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    created_at: "2026-08-03T00:00:00Z",
    raw_id: 1,
    lsind_regist_no: "FARM99",
    item_code: "P00",
    farm_name: "테스트농장",
    module_uid: 1,
    topic: null,
    wire_ver: 12,
    err_code: 0x11,
    err_label: "A 라인 고온 경보",
    status: "active",
    received_at: "2026-08-03T01:00:00Z",
    ...partial,
  };
}

assert.equal(severityForModuleErrCode(0x11), "critical");
assert.equal(severityForModuleErrCode(0x12), "warning");
assert.equal(severityForModuleErrCode(0x41), "critical");

const row = moduleAlarmToAlarmRow(sample());
assert.equal(row.source, "module");
assert.equal(row.alarmType, "A 라인 고온 경보");
assert.equal(row.farmName, "테스트농장");
assert.equal(row.controllerKey, "");
assert.equal(row.stallTyCode, null);
assert.equal(row.status, "active");

console.log("module-alarms.test.ts: ok");
