/**
 * 실행: npx tsx src/lib/farm/barn-plan-url.test.ts
 */
import assert from "node:assert/strict";
import {
  applyBarnPlanFocusParams,
  clearBarnPlanParams,
  resolveBarnPlanFocus,
} from "./barn-plan-url";

{
  const params = new URLSearchParams("planBldg=bd-1&planSp=SP02&planStall=1");
  const focus = resolveBarnPlanFocus(params);
  assert.equal(focus.level, "zone");
  if (focus.level !== "zone") throw new Error("zone");
  assert.equal(focus.buildingId, "bd-1");
  assert.equal(focus.stallTyCode, "SP02");
  assert.equal(focus.stallNo, "1");
}

{
  const params = new URLSearchParams();
  applyBarnPlanFocusParams(params, {
    level: "zone",
    buildingId: "bd-9",
    stallTyCode: "sp05",
    stallNo: "2",
  });
  assert.equal(params.get("planBldg"), "bd-9");
  assert.equal(params.get("planSp"), "SP05");
  assert.equal(params.get("planStall"), "2");
  const again = resolveBarnPlanFocus(params);
  assert.equal(again.level, "zone");
}

{
  const params = new URLSearchParams("planBldg=bd-1&planSp=SP02&planStall=1&chartSp=SP03");
  clearBarnPlanParams(params);
  assert.equal(params.get("planBldg"), null);
  assert.equal(params.get("chartSp"), "SP03");
  assert.equal(resolveBarnPlanFocus(params).level, "site");
}

console.log("barn-plan-url.test.ts: ok");
