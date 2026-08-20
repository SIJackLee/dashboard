/**
 * 실행: npx tsx src/lib/farm/barn-plan-field.test.ts
 */
import assert from "node:assert/strict";
import { buildBarnPlanField, metersPerDegree } from "./barn-plan-field";

const m = metersPerDegree(38);
const origin = { lat: 38, lng: 127 };
const east = { lat: 38, lng: 127 + 10 / m.lng };
const north = { lat: 38 + 10 / m.lat, lng: 127 };
const ne = { lat: 38 + 10 / m.lat, lng: 127 + 10 / m.lng };
const square = [origin, east, ne, north];

{
  const field = buildBarnPlanField(
    [{ id: "a", label: "1답", ring: square }],
    square,
  );
  assert.ok(field);
  assert.equal(field.cellM, 1);
  assert.ok(field.widthM >= 12 && field.widthM <= 16);
  assert.ok(field.heightM >= 12 && field.heightM <= 16);
  assert.ok(field.ring.length >= 4);
  assert.ok(field.areaM2 > 80 && field.areaM2 < 130);
}

{
  const left = [origin, east, ne, north];
  const mid = 5 / m.lng;
  const right = [
    { lat: 38, lng: 127 + mid },
    { lat: 38, lng: 127 + 20 / m.lng },
    { lat: 38 + 10 / m.lat, lng: 127 + 20 / m.lng },
    { lat: 38 + 10 / m.lat, lng: 127 + mid },
  ];
  const field = buildBarnPlanField(
    [
      { id: "a", label: "4목", ring: left },
      { id: "b", label: "41답", ring: right },
    ],
    null,
  );
  assert.ok(field);
  assert.ok(field.ring.length >= 3);
  assert.ok(field.widthM >= 12);
}

console.log("barn-plan-field.test.ts: ok");
