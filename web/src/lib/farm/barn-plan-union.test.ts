/**
 * 실행: npx tsx src/lib/farm/barn-plan-union.test.ts
 */
import assert from "node:assert/strict";
import {
  pickCadastralSiteRings,
  sharedUndirectedEdgeCount,
  unionBarnPlanRings,
} from "./barn-plan-union";

const left = [
  { lat: 36.0, lng: 127.0 },
  { lat: 36.0, lng: 127.001 },
  { lat: 36.001, lng: 127.001 },
  { lat: 36.001, lng: 127.0 },
];
const right = [
  { lat: 36.0, lng: 127.001 },
  { lat: 36.0, lng: 127.002 },
  { lat: 36.001, lng: 127.002 },
  { lat: 36.001, lng: 127.001 },
];

assert.equal(sharedUndirectedEdgeCount(left, right), 1);

{
  const united = unionBarnPlanRings([left, right]);
  assert.ok(united && united.length === 4);
  const lngs = new Set(united.map((p) => p.lng.toFixed(3)));
  assert.ok(lngs.has("127.000"));
  assert.ok(lngs.has("127.002"));
  assert.equal(lngs.size, 2);
}

{
  const building = [
    { lat: 36.0002, lng: 127.0002 },
    { lat: 36.0002, lng: 127.0008 },
    { lat: 36.0008, lng: 127.0008 },
    { lat: 36.0008, lng: 127.0002 },
  ];
  const far = [
    { lat: 36.01, lng: 127.01 },
    { lat: 36.01, lng: 127.011 },
    { lat: 36.011, lng: 127.011 },
    { lat: 36.011, lng: 127.01 },
  ];
  const picked = pickCadastralSiteRings([left, far], [building]);
  assert.equal(picked.length, 1);
  assert.equal(picked[0], left);
}

{
  const stem = [
    { lat: 36.001, lng: 127.0 },
    { lat: 36.001, lng: 127.001 },
    { lat: 36.002, lng: 127.001 },
    { lat: 36.002, lng: 127.0 },
  ];
  const notch = [
    { lat: 36.0, lng: 127.001 },
    { lat: 36.0, lng: 127.002 },
    { lat: 36.001, lng: 127.002 },
    { lat: 36.001, lng: 127.001 },
  ];
  const l = unionBarnPlanRings([left, stem, notch]);
  assert.ok(l && l.length === 6);
  const hasInner = l.some(
    (p) =>
      Math.abs(p.lat - 36.001) < 1e-8 && Math.abs(p.lng - 127.001) < 1e-8,
  );
  assert.equal(hasInner, true);
}

{
  const seed = [
    { lat: 36.0, lng: 127.0 },
    { lat: 36.0, lng: 127.0004 },
    { lat: 36.0002, lng: 127.0004 },
    { lat: 36.0002, lng: 127.0002 },
    { lat: 36.0004, lng: 127.0002 },
    { lat: 36.0004, lng: 127.0 },
  ];
  const filler = [
    { lat: 36.0002, lng: 127.0002 },
    { lat: 36.0002, lng: 127.0004 },
    { lat: 36.0004, lng: 127.0004 },
    { lat: 36.0004, lng: 127.0002 },
  ];
  const corner = [
    { lat: 36.0004, lng: 127.0 },
    { lat: 36.0004, lng: 127.0002 },
    { lat: 36.0005, lng: 127.0002 },
    { lat: 36.0005, lng: 127.0 },
  ];
  const inside = [
    { lat: 36.00005, lng: 127.00005 },
    { lat: 36.00005, lng: 127.00015 },
    { lat: 36.00015, lng: 127.00015 },
    { lat: 36.00015, lng: 127.00005 },
  ];
  assert.equal(sharedUndirectedEdgeCount(seed, filler), 2);
  assert.equal(sharedUndirectedEdgeCount(seed, corner), 1);
  const picked = pickCadastralSiteRings([seed, filler, corner], [inside]);
  assert.equal(picked.length, 2);
  assert.ok(picked.includes(seed));
  assert.ok(picked.includes(filler));
  assert.equal(picked.includes(corner), false);
}

console.log("barn-plan-union.test.ts: ok");
