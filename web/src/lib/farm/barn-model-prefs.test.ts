/**
 * 실행: npx tsx src/lib/farm/barn-model-prefs.test.ts
 */
import assert from "node:assert/strict";
import {
  addPlacedBarn,
  clonePlacedBarn,
  defaultPlanFromCount,
  emptyBarnModelPrefs,
  movePlacedBarn,
  parseBarnModelPrefs,
  placedFillSessionEqual,
  renamePlacedBarn,
  restorePlacedBarn,
  rotatePlacedBarn,
  snapBarnFootprint,
  snapBarnRotDeg,
  snapBarnXZ,
  updatePlacedFill,
  updatePlacedShell,
} from "./barn-model-prefs";
import { barnModelLength, barnModelShell } from "./barn-model-dim";

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
  assert.deepEqual(
    snapBarnFootprint(4, -8, { left: 3, right: 3 }, "SP03", undefined, 1),
    [4.3, -8.1],
  );
  assert.equal(snapBarnRotDeg(7), 0);
  assert.equal(snapBarnRotDeg(8), 15);
  assert.equal(snapBarnRotDeg(375), 15);
  assert.equal(added.placed[0]!.x, 4.3);
  assert.equal(added.placed[0]!.z, -8.1);
  const moved = movePlacedBarn(added, added.placed[0]!.id, 10, -4);
  assert.equal(moved.placed[0]!.x, 10.3);
  assert.equal(moved.placed[0]!.z, -4.1);
  const rot = rotatePlacedBarn(moved, moved.placed[0]!.id, 375);
  assert.equal(rot.placed[0]!.rotDeg, 15);
  const named = renamePlacedBarn(rot, rot.placed[0]!.id, "  1동  ");
  assert.equal(named.placed[0]!.name, "1동");
  const cleared = renamePlacedBarn(named, named.placed[0]!.id, "   ");
  assert.equal(cleared.placed[0]!.name, undefined);
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
  const parsed = parseBarnModelPrefs({
    placed: [
      {
        id: "pb-shell",
        stallTyCode: "SP03",
        stallNo: "01",
        x: 0,
        z: 0,
        rotDeg: 0,
        plan: { left: 3, right: 3 },
        lengthM: 20,
        widthM: 10,
        wallHM: 4.5,
      },
    ],
  });
  const barn = parsed.placed[0]!;
  assert.equal(barn.lengthM, 20);
  assert.equal(barn.widthM, 10);
  assert.equal(barn.wallHM, 4.5);
}

{
  const base = addPlacedBarn(emptyBarnModelPrefs(), {
    stallTyCode: "SP03",
    plan: { left: 3, right: 3 },
    x: 0,
    z: 0,
  });
  const barn = base.placed[0]!;
  const long = updatePlacedShell(base, barn.id, "length", 20);
  const next = long.placed[0]!;
  assert.equal(next.lengthM, 20);
  const dL = 20 - barnModelLength("SP03", barn.plan);
  assert.equal(next.z, Math.round((barn.z - dL / 2) * 1000) / 1000);
  const wide = updatePlacedShell(base, barn.id, "width", 12);
  assert.equal(wide.placed[0]!.widthM, 12);
  assert.equal(wide.placed[0]!.x, barn.x);
  assert.equal(wide.placed[0]!.z, barn.z);
  const tall = updatePlacedShell(base, barn.id, "height", 5);
  assert.equal(tall.placed[0]!.wallHM, 5);
  const capped = updatePlacedShell(base, barn.id, "length", 200);
  assert.equal(capped.placed[0]!.lengthM, 120);
}

{
  const base = addPlacedBarn(emptyBarnModelPrefs(), {
    stallTyCode: "SP03",
    plan: { left: 3, right: 3 },
    x: 0,
    z: 0,
  });
  const barn = base.placed[0]!;
  const filled = updatePlacedFill(base, barn.id, {
    penAlong: 2,
    penDepth: 3,
    banks: 3,
    roomCount: 4,
  });
  const next = filled.placed[0]!;
  assert.equal(next.penAlongM, 2);
  assert.equal(next.penDepthM, 3);
  assert.equal(next.banks, 3);
  assert.deepEqual(next.plan, { left: 4, mid: 4, right: 4 });
  assert.equal(next.lengthM, undefined);
  assert.equal(barnModelShell(next).length, 8.4);
  assert.equal(barnModelShell(next).width, 12.6);
  const aisle = updatePlacedFill(filled, barn.id, { aisleW: 2.4 });
  assert.equal(aisle.placed[0]!.aisleWM, 2.4);
  assert.equal(barnModelShell(aisle.placed[0]!).width, 13.8);
  const roundTrip = parseBarnModelPrefs({
    v: 2,
    placed: aisle.placed,
  });
  assert.equal(roundTrip.placed[0]!.aisleWM, 2.4);
  const snap = clonePlacedBarn(barn);
  const reverted = restorePlacedBarn(aisle, snap);
  assert.equal(placedFillSessionEqual(reverted.placed[0]!, snap), true);
  assert.equal(placedFillSessionEqual(aisle.placed[0]!, snap), false);
}

console.log("barn-model-prefs.test.ts: ok");
