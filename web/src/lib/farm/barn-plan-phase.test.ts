/**
 * 실행: npx tsx src/lib/farm/barn-plan-phase.test.ts
 */
import assert from "node:assert/strict";
import {
  barnPlanPhaseStorageKey,
  barnPlanSatOverlayEnabled,
  parseBarnPlanPhase,
} from "./barn-plan-phase";

assert.equal(parseBarnPlanPhase("assign"), "assign");
assert.equal(parseBarnPlanPhase("place"), "place");
assert.equal(parseBarnPlanPhase(null), "place");
assert.equal(parseBarnPlanPhase("field"), "place");
assert.equal(barnPlanSatOverlayEnabled("place"), true);
assert.equal(barnPlanSatOverlayEnabled("assign"), false);
assert.equal(
  barnPlanPhaseStorageKey("farm-1"),
  "sungil.barn-plan.phase.v1:farm-1",
);

console.log("barn-plan-phase.test.ts: ok");
