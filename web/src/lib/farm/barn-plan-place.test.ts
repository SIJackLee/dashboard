/**
 * 실행: npx tsx src/lib/farm/barn-plan-place.test.ts
 */
import assert from "node:assert/strict";
import {
  applyBarnPlanFillPatch,
  barnPlanDragPos,
  barnPlanFillCells,
  barnPlanFillEqual,
  barnPlanFootprint,
  barnPlanPlaceOrigin,
  barnSiteFillFromModel,
  defaultBarnPlanFill,
  defaultBarnPlanShellFill,
  pointInMetricRing,
  barnPlanSnapRotDeg,
  barnPlanRotateDeg,
  barnPlanAxisSpan,
  barnPlanFieldToLocal,
  barnPlanLocalToField,
  barnPlanAssignRowLayout,
  barnPlanAssignStaggerT,
  barnPlanEmphasisT,
  barnPlanLerp,
  barnPlanLerpAngleDeg,
  barnPlanBanksFromWidth,
  barnPlanRoomCountFromLength,
  barnPlanRoomsInWindow,
  barnPlanRoomClusters,
  barnPlanWidthForBanks,
} from "./barn-plan-place";
import type { BarnModelBanks } from "./barn-model-dim";

{
  const fill = defaultBarnPlanFill("SP02");
  assert.equal(fill.banks, 2);
  assert.equal(fill.roomCount, 8);
  assert.ok(fill.penAlong > 0.5 && fill.penAlong < 0.8);
  const next = applyBarnPlanFillPatch(fill, "SP02", { roomCount: 10, banks: 3 });
  assert.equal(next.roomCount, 10);
  assert.equal(next.banks, 3);
  assert.equal(barnPlanFillEqual(fill, next), false);
  const site = barnSiteFillFromModel(next);
  assert.equal(site.roomCount, 10);
  assert.equal(site.banks, 3);
  const five = applyBarnPlanFillPatch(fill, "SP02", { banks: 5 });
  assert.equal(five.banks, 5);
  assert.equal(
    applyBarnPlanFillPatch(fill, "SP02", {
      banks: 9 as unknown as BarnModelBanks,
    }).banks,
    5,
  );
  assert.equal(barnPlanBanksFromWidth(five, barnPlanWidthForBanks(five, 5)), 5);
  const fiveCells = barnPlanFillCells(five);
  assert.equal(
    fiveCells.filter((c) => c.kind === "room").length,
    5 * five.roomCount,
  );
  assert.equal(fiveCells.filter((c) => c.kind === "aisle").length, 4);
}

{
  const fill = defaultBarnPlanFill("SP02");
  const fp = barnPlanFootprint("SP02", fill);
  assert.ok(fp.lengthM > 4);
  assert.ok(fp.widthM > 4);
  const pos = barnPlanPlaceOrigin(
    {
      widthM: 80,
      heightM: 60,
      ring: [
        { x: 10, y: 10 },
        { x: 70, y: 10 },
        { x: 70, y: 50 },
        { x: 10, y: 50 },
      ],
    },
    fp,
  );
  assert.equal(pos.x, Math.round(pos.x));
  assert.equal(pos.z, Math.round(pos.z));
  assert.ok(pos.x > 10 && pos.x < 70);
  assert.ok(pos.z > 10 && pos.z < 50);
}

{
  const fill = defaultBarnPlanFill("SP03");
  const fp = barnPlanFootprint("SP03", fill);
  const field = {
    widthM: 80,
    heightM: 60,
    ring: [
      { x: 40, y: 30 },
      { x: 50, y: 30 },
      { x: 50, y: 40 },
      { x: 40, y: 40 },
    ],
  };
  const first = barnPlanPlaceOrigin(field, fp);
  const second = barnPlanPlaceOrigin(field, fp, [{ ...first, ...fp }]);
  assert.ok(
    Math.abs(second.x - first.x) > 1 || Math.abs(second.z - first.z) > 1,
  );
}

{
  const fill = defaultBarnPlanFill("SP02");
  const cells = barnPlanFillCells(fill);
  const rooms = cells.filter((c) => c.kind === "room");
  const aisles = cells.filter((c) => c.kind === "aisle");
  assert.equal(rooms.length, fill.banks * fill.roomCount);
  assert.equal(aisles.length, 1);
  assert.equal(rooms[0]?.bank, 0);
  assert.equal(rooms[0]?.index, 0);
  assert.equal(rooms[fill.roomCount]?.bank, 1);
  const box = {
    widthM: 80,
    heightM: 60,
    ring: [
      { x: 10, y: 10 },
      { x: 70, y: 10 },
      { x: 70, y: 50 },
      { x: 10, y: 50 },
    ],
  };
  assert.equal(pointInMetricRing({ x: 40, y: 30 }, box.ring), true);
  assert.equal(pointInMetricRing({ x: 1, y: 1 }, box.ring), false);
  const inside = barnPlanDragPos(box, { x: 40.4, z: 30.4 }, { lengthM: 8, widthM: 6 });
  assert.ok(inside);
  assert.equal(inside.x, 40);
  assert.equal(inside.z, 30);
  assert.equal(
    barnPlanDragPos(box, { x: 2, z: 2 }, { lengthM: 8, widthM: 6 }),
    null,
  );
}

{
  const fill = defaultBarnPlanShellFill();
  assert.equal(fill.banks, 2);
  assert.equal(fill.roomCount, 8);
  const fp = barnPlanFootprint("", fill);
  assert.ok(fp.lengthM > 4);
  assert.ok(fp.widthM > 4);
}

{
  assert.equal(barnPlanSnapRotDeg(12), 10);
  assert.equal(barnPlanSnapRotDeg(13), 15);
  assert.equal(barnPlanSnapRotDeg(-5), 355);
  assert.equal(barnPlanSnapRotDeg(355), 355);
  assert.equal(barnPlanSnapRotDeg(358), 0);
  assert.equal(barnPlanRotateDeg({ x: 0, z: 0 }, { x: 10, z: 0 }), 0);
  assert.equal(barnPlanRotateDeg({ x: 0, z: 0 }, { x: 0, z: 10 }), 90);
  const fp = { lengthM: 20, widthM: 10 };
  const turned = barnPlanAxisSpan(fp, 90);
  assert.equal(Math.round(turned.lengthM), 10);
  assert.equal(Math.round(turned.widthM), 20);
}

{
  const fill = defaultBarnPlanShellFill();
  assert.equal(
    barnPlanBanksFromWidth(fill, barnPlanWidthForBanks(fill, 1)),
    1,
  );
  assert.equal(
    barnPlanBanksFromWidth(fill, barnPlanWidthForBanks(fill, 3)),
    3,
  );
  const mid =
    (barnPlanWidthForBanks(fill, 1) + barnPlanWidthForBanks(fill, 2)) / 2;
  assert.ok(
    barnPlanBanksFromWidth(fill, mid) === 1 ||
      barnPlanBanksFromWidth(fill, mid) === 2,
  );
  const len = fill.roomCount * fill.penAlong + fill.endPad;
  assert.equal(barnPlanRoomCountFromLength(fill, len), fill.roomCount);
  assert.equal(
    barnPlanRoomCountFromLength(fill, len + fill.penAlong),
    fill.roomCount + 1,
  );
  const origin = { x: 10, z: 20 };
  const at = barnPlanLocalToField(origin, 90, 4, 0);
  const back = barnPlanFieldToLocal(origin, 90, at);
  assert.ok(Math.abs(back.x - 4) < 1e-9);
  assert.ok(Math.abs(back.y) < 1e-9);
}

{
  const fill = defaultBarnPlanShellFill();
  const a = barnSiteFillFromModel(fill);
  const layout = barnPlanAssignRowLayout([
    { id: "a", fill: a, x: 40 },
    { id: "b", fill: a, x: 10 },
  ]);
  const left = layout.items.b;
  const right = layout.items.a;
  assert.ok(left && right);
  assert.equal(left.rotDeg, 90);
  assert.equal(right.rotDeg, 90);
  assert.equal(left.z, right.z);
  assert.ok(right.x > left.x);
  const fp = barnPlanFootprint("", fill);
  const span = barnPlanAxisSpan(fp, 90);
  assert.ok(right.x - left.x >= span.lengthM);
  assert.ok(layout.widthM > span.lengthM * 2);
  assert.ok(layout.heightM > fp.lengthM);
}

{
  assert.equal(barnPlanLerp(0, 10, 0.5), 5);
  assert.equal(Math.round(barnPlanLerpAngleDeg(350, 10, 0.5)), 0);
  assert.equal(barnPlanEmphasisT(0), 0);
  assert.equal(barnPlanEmphasisT(1), 1);
  assert.ok(barnPlanEmphasisT(0.5) > 0.5);
  assert.equal(barnPlanAssignStaggerT(0, 0, 3), 0);
  assert.equal(barnPlanAssignStaggerT(1, 2, 3), 1);
  assert.equal(barnPlanAssignStaggerT(0.1, 2, 3), 0);
  assert.ok(
    barnPlanAssignStaggerT(0.5, 0, 3) > barnPlanAssignStaggerT(0.5, 2, 3),
  );
}

{
  const fill = defaultBarnPlanShellFill();
  const a = { id: "a", x: 40, z: 30, rotDeg: 0, fill };
  const rooms = barnPlanFillCells(fill).filter((c) => c.kind === "room");
  const first = rooms[0]!;
  const at = barnPlanLocalToField(
    a,
    0,
    first.x + first.w / 2,
    first.y + first.h / 2,
  );
  const hit = barnPlanRoomsInWindow([a], {
    x0: at.x - 0.1,
    z0: at.z - 0.1,
    x1: at.x + 0.1,
    z1: at.z + 0.1,
  });
  assert.equal(hit.length, 1);
  assert.equal(hit[0]?.id, "a");
  assert.equal(hit[0]?.bank, 0);
  assert.equal(hit[0]?.index, 0);
  assert.equal(
    barnPlanRoomsInWindow([a], { x0: 0, z0: 0, x1: 0.2, z1: 0.2 }).length,
    0,
  );
  const b = { id: "b", x: 40, z: 30, rotDeg: 0, fill };
  const both = barnPlanRoomsInWindow(
    [a, { ...b, x: at.x + 80 }],
    {
      x0: at.x - 0.1,
      z0: at.z - 0.1,
      x1: at.x + 0.1,
      z1: at.z + 0.1,
    },
  );
  assert.equal(both.length, 1);
  assert.equal(both[0]?.id, "a");
}

{
  const fill = defaultBarnPlanShellFill();
  const along = barnPlanRoomClusters(fill, [
    { bank: 0, index: 0 },
    { bank: 0, index: 1 },
  ]);
  assert.equal(along.length, 1);
  assert.equal(along[0]?.rooms.length, 2);
  const split = barnPlanRoomClusters(fill, [
    { bank: 0, index: 0 },
    { bank: 1, index: 0 },
  ]);
  assert.equal(split.length, 2);
}

console.log("barn-plan-place.test.ts ok");
