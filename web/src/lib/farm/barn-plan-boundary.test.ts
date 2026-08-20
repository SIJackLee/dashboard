/**
 * 실행: npx tsx src/lib/farm/barn-plan-boundary.test.ts
 */
import assert from "node:assert/strict";
import {
  concaveBarnPlanRing,
  convexBarnPlanRing,
  formatSiteAreaKo,
  parseBarnPlanBoundary,
  parseBarnPlanSitePrefs,
  pointInBarnPlanRing,
  ringAreaM2,
} from "./barn-plan-boundary";

assert.equal(parseBarnPlanBoundary(null), null);
assert.equal(parseBarnPlanBoundary([{ lat: 1, lng: 2 }]), null);

{
  const box = [
    { lat: 36.0, lng: 127.0 },
    { lat: 36.0, lng: 127.01 },
    { lat: 36.01, lng: 127.01 },
    { lat: 36.01, lng: 127.0 },
  ];
  const parsed = parseBarnPlanBoundary(box);
  assert.equal(parsed?.length, 4);
  const area = ringAreaM2(parsed!);
  assert.ok(area > 800_000 && area < 1_400_000);
  assert.match(formatSiteAreaKo(parsed!), /ha|m²/);
}

{
  const site = parseBarnPlanSitePrefs({
    v: 2,
    boundary: [
      { lat: 35.2, lng: 126.8 },
      { lat: 35.2, lng: 126.81 },
      { lat: 35.21, lng: 126.8 },
    ],
  });
  assert.equal(site.v, 2);
  assert.equal(site.boundary?.length, 3);
}

{
  const hull = convexBarnPlanRing([
    { lat: 36.0, lng: 127.0 },
    { lat: 36.0, lng: 127.01 },
    { lat: 36.01, lng: 127.01 },
    { lat: 36.01, lng: 127.0 },
    { lat: 36.005, lng: 127.005 },
  ]);
  assert.equal(hull?.length, 4);
}

{
  const notch = { lat: 36.001, lng: 127.001 };
  const lShape = [
    { lat: 36.0, lng: 127.0 },
    { lat: 36.0, lng: 127.003 },
    { lat: 36.001, lng: 127.003 },
    notch,
    { lat: 36.003, lng: 127.001 },
    { lat: 36.003, lng: 127.0 },
  ];
  const near = (ring: { lat: number; lng: number }[], p: typeof notch) =>
    ring.some(
      (row) =>
        Math.abs(row.lat - p.lat) < 1e-8 && Math.abs(row.lng - p.lng) < 1e-8,
    );
  const convex = convexBarnPlanRing(lShape);
  const concave = concaveBarnPlanRing(lShape);
  assert.ok(convex && convex.length >= 3);
  assert.equal(near(convex, notch), false);
  assert.ok(concave && concave.length >= 4);
  assert.equal(near(concave, notch), true);
}

{
  const box = [
    { lat: 36.0, lng: 127.0 },
    { lat: 36.0, lng: 127.01 },
    { lat: 36.01, lng: 127.01 },
    { lat: 36.01, lng: 127.0 },
  ];
  assert.equal(pointInBarnPlanRing({ lat: 36.005, lng: 127.005 }, box), true);
  assert.equal(pointInBarnPlanRing({ lat: 36.02, lng: 127.005 }, box), false);
}

console.log("barn-plan-boundary.test.ts: ok");
