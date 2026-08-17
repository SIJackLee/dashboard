/**
 * 실행: npx tsx src/lib/farm/barn-model-prefs.test.ts
 */
import assert from "node:assert/strict";
import {
  addPlacedBarn,
  defaultPlanFromCount,
  emptyBarnModelPrefs,
  movePlacedBarn,
  parseBarnModelPrefs,
  rotatePlacedBarn,
  renamePlacedBarn,
  setBarnSlot,
  snapBarnFootprint,
  snapBarnRotDeg,
  snapBarnXZ,
  updatePlacedPlan,
} from "./barn-model-prefs";
import { barnModelLength, barnModelWidth } from "./barn-model-dim";

{
  assert.deepEqual(defaultPlanFromCount(1), { left: 1, right: 0 });
  assert.deepEqual(defaultPlanFromCount(6), { left: 3, right: 3 });
}

{
  const empty = emptyBarnModelPrefs();
  assert.equal(empty.placed.length, 0);
  const added = addPlacedBarn(empty, {
    stallTyCode: "SP03",
    plan: { left: 3, right: 3 },
    x: 4,
    z: -8,
  });
  assert.equal(added.placed.length, 1);
  assert.equal(added.placed[0]!.stallTyCode, "SP03");
  assert.deepEqual(snapBarnXZ(4, -8), [5, -10]);
  assert.deepEqual(snapBarnFootprint(4, -8, { left: 3, right: 3 }, "SP03"), [
    3.3,
    -7.1,
  ]);
  assert.equal(snapBarnRotDeg(7), 0);
  assert.equal(snapBarnRotDeg(8), 15);
  assert.equal(snapBarnRotDeg(375), 15);
  assert.equal(added.placed[0]!.x, 3.3);
  assert.equal(added.placed[0]!.z, -7.1);
  const moved = movePlacedBarn(added, added.placed[0]!.id, 10, -4);
  assert.equal(moved.placed[0]!.x, 8.3);
  assert.equal(moved.placed[0]!.z, -2.1);
  const rot = rotatePlacedBarn(moved, moved.placed[0]!.id, 375);
  assert.equal(rot.placed[0]!.rotDeg, 15);
  const named = renamePlacedBarn(rot, rot.placed[0]!.id, "  1동  ");
  assert.equal(named.placed[0]!.name, "1동");
  const cleared = renamePlacedBarn(named, named.placed[0]!.id, "   ");
  assert.equal(cleared.placed[0]!.name, undefined);
}

{
  let prefs = setBarnSlot(emptyBarnModelPrefs(), "b1", "left-0", "A");
  prefs = setBarnSlot(prefs, "b1", "right-0", "A");
  assert.equal(prefs.byBarn.b1?.slots["left-0"], undefined);
  assert.equal(prefs.byBarn.b1?.slots["right-0"], "A");
}

{
  const parsed = parseBarnModelPrefs({
    placed: [
      {
        id: "pb-1",
        stallTyCode: "SP02",
        stallNo: "01",
        name: "A동",
        x: 2,
        z: 3,
        rotDeg: 90,
        plan: { left: 1, right: 0 },
      },
    ],
    byBarn: { "pb-1": { slots: { "left-0": "CK" } } },
  });
  assert.equal(parsed.placed.length, 1);
  assert.equal(parsed.placed[0]!.x, 2);
  assert.equal(parsed.placed[0]!.z, 0.525);
  assert.equal(parsed.placed[0]!.rotDeg, 90);
  assert.equal(parsed.placed[0]!.name, "A동");
  assert.equal(parsed.byBarn["pb-1"]?.slots["left-0"], "CK");
}

{
  const base = addPlacedBarn(emptyBarnModelPrefs(), {
    stallTyCode: "SP03",
    plan: { left: 3, right: 3 },
    x: 10,
    z: 10,
  });
  const barn = base.placed[0]!;
  const grown = updatePlacedPlan(base, barn.id, { left: 4, right: 3 }, {
    pin: "back",
  });
  const next = grown.placed[0]!;
  const dL =
    barnModelLength("SP03", next.plan) - barnModelLength("SP03", barn.plan);
  assert.equal(next.x, barn.x);
  assert.equal(next.z, Math.round((barn.z + dL / 2) * 1000) / 1000);
  const front = updatePlacedPlan(base, barn.id, { left: 4, right: 3 }, {
    pin: "front",
  });
  assert.equal(
    front.placed[0]!.z,
    Math.round((barn.z - dL / 2) * 1000) / 1000,
  );
  const centered = updatePlacedPlan(base, barn.id, { left: 4, right: 3 });
  assert.equal(centered.placed[0]!.z, barn.z);
}

{
  const oneSide = addPlacedBarn(emptyBarnModelPrefs(), {
    stallTyCode: "SP03",
    plan: { left: 3, right: 0 },
    x: 0,
    z: 0,
  });
  const barn = oneSide.placed[0]!;
  const both = updatePlacedPlan(oneSide, barn.id, { left: 3, right: 1 }, {
    pin: "back",
  });
  const next = both.placed[0]!;
  const dW =
    barnModelWidth("SP03", next.plan) - barnModelWidth("SP03", barn.plan);
  assert.equal(next.z, barn.z);
  assert.equal(next.x, Math.round((barn.x + dW / 2) * 1000) / 1000);
}

console.log("barn-model-prefs.test.ts: ok");
