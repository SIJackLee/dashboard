/**
 * 실행: npx tsx src/lib/onboarding/tour-steps.test.ts
 */
import assert from "node:assert/strict";
import { getTourStepsForScope } from "./tour-steps";

{
  const overview = getTourStepsForScope("chart").find((s) => s.id === "c-overview");
  assert.equal(overview?.selector, '[data-tour-id="farm-chart-lab-modes"]');
  assert.match(overview?.title ?? "", /일괄/);
  const graph = getTourStepsForScope("field").find((s) => s.id === "f-graph");
  assert.match(graph?.mobileBody ?? "", /단일/);
  assert.doesNotMatch(graph?.mobileBody ?? "", /비교로 붙/);
  const layers = getTourStepsForScope("chart").find((s) => s.id === "c-layers");
  assert.match(layers?.body ?? "", /알람 아이콘/);
  const control = getTourStepsForScope("chart").find((s) => s.id === "c-control");
  assert.match(control?.body ?? "", /알람 아이콘/);
  const delin = getTourStepsForScope("field").find((s) => s.id === "f-delin");
  assert.match(delin?.body ?? "", /일령별 권장/);
  assert.doesNotMatch(delin?.body ?? "", /물을 수/);
  console.log("tour-steps.test.ts: ok");
}
