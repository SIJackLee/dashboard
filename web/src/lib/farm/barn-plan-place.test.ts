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
  barnPlanAbsDegDelta,
  barnPlanFieldAngleDeg,
  barnPlanRotateDeg,
  barnPlanRotateDragPastDeadzone,
  barnPlanRotateGrabOffsetDeg,
  barnPlanRotateWithGrab,
  barnPlanAxisSpan,
  barnPlanFieldToLocal,
  barnPlanLocalToField,
  barnPlanAssignRowLayout,
  barnPlanModelRowLayout,
  barnPlanModelPackedFootprint,
  barnPlanAssignStaggerT,
  barnPlanEmphasisT,
  barnPlanLerp,
  barnPlanLerpAngleDeg,
  barnPlanBanksFromWidth,
  barnPlanRoomCountFromLength,
  barnPlanRoomsInWindow,
  barnPlanRoomBounds,
  barnPlanRoomClusters,
  barnPlanModelLayout,
  barnPlanLerpModelCells,
  barnPlanLocalRectToFieldBox,
  barnPlanSpreadZoneLabels,
  barnPlanModelSections,
  barnPlanWidthForBanks,
  barnPlanPadField,
  barnPlanZoneTagReserveM,
  barnPlanCameraFit,
  barnPlanCameraTagFitK,
  barnPlanCameraViewBox,
  barnPlanCameraZoomAt,
  barnPlanZoneTagNeedPx,
  BARN_PLAN_MODEL_BUILDING_GAP_RATIO,
  BARN_PLAN_MODEL_WELL_PAD_RATIO,
  BARN_PLAN_MODEL_ZOOM_MAX,
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
  assert.equal(barnPlanFieldAngleDeg({ x: 0, z: 0 }, { x: 10, z: 0 }), 0);
  assert.equal(barnPlanAbsDegDelta(358, 2), 4);
  {
    const origin = { x: 0, z: 0 };
    const startRot = 290;
    const finger = barnPlanLocalToField(origin, 293, 20, 0);
    const ang = barnPlanFieldAngleDeg(origin, finger);
    assert.ok(ang != null);
    const grab = barnPlanRotateGrabOffsetDeg(ang, startRot);
    assert.equal(barnPlanRotateWithGrab(ang, grab), startRot);
    const moved = barnPlanLocalToField(origin, 305, 20, 0);
    const movedAng = barnPlanFieldAngleDeg(origin, moved);
    assert.ok(movedAng != null);
    assert.equal(barnPlanRotateWithGrab(movedAng, grab), 300);
  }
  assert.equal(
    barnPlanRotateDragPastDeadzone({
      startX: 0,
      startY: 0,
      x: 4,
      y: 4,
      startAngleDeg: 290,
      angleDeg: 291,
    }),
    false,
  );
  assert.equal(
    barnPlanRotateDragPastDeadzone({
      startX: 0,
      startY: 0,
      x: 8,
      y: 0,
      startAngleDeg: 290,
      angleDeg: 290.5,
    }),
    true,
  );
  assert.equal(
    barnPlanRotateDragPastDeadzone({
      startX: 0,
      startY: 0,
      x: 1,
      y: 0,
      startAngleDeg: 290,
      angleDeg: 292,
    }),
    true,
  );
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
  const fill = defaultBarnPlanShellFill();
  const site = barnSiteFillFromModel(fill);
  const left = Array.from({ length: fill.banks }, (_, bank) =>
    Array.from({ length: 4 }, (_, i) => ({ bank, index: i })),
  ).flat();
  const right = Array.from({ length: fill.banks }, (_, bank) =>
    Array.from({ length: 4 }, (_, i) => ({ bank, index: i + 4 })),
  ).flat();
  const covers = [
    { rooms: left, stallTyCode: "SP05", stallNo: "1", eqpmnNo: "01" },
    { rooms: right, stallTyCode: "SP03", stallNo: "1", eqpmnNo: "01" },
  ];
  const packedFp = barnPlanModelPackedFootprint(fill, covers);
  const shell = barnPlanFootprint("", fill);
  assert.ok(packedFp.widthM > shell.widthM || packedFp.lengthM > shell.lengthM);
  const assign = barnPlanAssignRowLayout([
    { id: "a", fill: site, x: 10 },
    { id: "b", fill: site, x: 40 },
  ]);
  const packed = barnPlanModelRowLayout([
    { id: "a", fill: site, x: 10, covers },
    { id: "b", fill: site, x: 40, covers },
  ]);
  assert.ok(
    packed.widthM > assign.widthM || packed.heightM > assign.heightM,
  );
  const a = packed.items.a;
  const b = packed.items.b;
  assert.ok(a && b);
  const span = barnPlanAxisSpan(packedFp, 90);
  assert.ok(b.x - a.x + 1e-6 >= span.lengthM);
  const shortM = Math.min(
    packedFp.lengthM - barnPlanZoneTagReserveM(),
    packedFp.widthM,
  );
  assert.ok(
    Math.abs(
      b.x -
        a.x -
        (span.lengthM +
          shortM * BARN_PLAN_MODEL_BUILDING_GAP_RATIO),
    ) < 1.01,
  );
  const top = Array.from({ length: fill.roomCount }, (_, index) => ({
    bank: 0,
    index,
  }));
  const bottom = Array.from({ length: fill.roomCount }, (_, index) => ({
    bank: 1,
    index,
  }));
  const bankCovers = [
    { rooms: top, stallTyCode: "SP05", stallNo: "1", eqpmnNo: "01" },
    { rooms: bottom, stallTyCode: "SP05", stallNo: "1", eqpmnNo: "02" },
  ];
  const bankPacked = barnPlanModelRowLayout([
    { id: "a", fill: site, x: 10, covers: bankCovers },
    { id: "b", fill: site, x: 40, covers: bankCovers },
  ]);
  assert.ok(bankPacked.widthM > assign.widthM);
}

{
  const smallFill = defaultBarnPlanShellFill();
  const largeFill = applyBarnPlanFillPatch(smallFill, "", {
    banks: 4,
    roomCount: 8,
  });
  const smallSite = barnSiteFillFromModel(smallFill);
  const largeSite = barnSiteFillFromModel(largeFill);
  const smallFp = barnPlanModelPackedFootprint(smallFill, []);
  const largeFp = barnPlanModelPackedFootprint(largeFill, []);
  const smallShort = Math.min(
    smallFp.lengthM - barnPlanZoneTagReserveM(),
    smallFp.widthM,
  );
  const largeShort = Math.min(
    largeFp.lengthM - barnPlanZoneTagReserveM(),
    largeFp.widthM,
  );
  const row = barnPlanModelRowLayout([
    { id: "s", fill: smallSite, x: 10 },
    { id: "m", fill: largeSite, x: 40 },
    { id: "t", fill: largeSite, x: 80 },
  ]);
  const s = row.items.s;
  const m = row.items.m;
  const t = row.items.t;
  assert.ok(s && m && t);
  const gap = Math.min(smallShort, largeShort) * BARN_PLAN_MODEL_BUILDING_GAP_RATIO;
  const spanS = barnPlanAxisSpan(smallFp, 90).lengthM;
  const spanL = barnPlanAxisSpan(largeFp, 90).lengthM;
  assert.ok(Math.abs(m.x - s.x - (spanS / 2 + spanL / 2 + gap)) < 1.01);
  assert.ok(Math.abs(t.x - m.x - (spanL + gap)) < 1.01);
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

{
  const fill = defaultBarnPlanShellFill();
  const stackRooms = Array.from({ length: fill.roomCount }, (_, index) => ({
    bank: 0,
    index,
  }));
  const one = barnPlanRoomBounds(fill, [{ bank: 0, index: 0 }]);
  const stack = barnPlanRoomBounds(fill, stackRooms);
  assert.ok(one && stack);
  assert.ok(stack.w > one.w * (fill.roomCount - 1));
  assert.equal(Math.round(stack.h * 100), Math.round(one.h * 100));
  const split = barnPlanModelSections(
    fill,
    [
      { rooms: [{ bank: 0, index: 0 }] },
      { rooms: [{ bank: 0, index: fill.roomCount - 1 }] },
    ],
    [],
  );
  assert.equal(split.length, 2);
}

{
  const fill = defaultBarnPlanShellFill();
  const left = Array.from({ length: fill.banks }, (_, bank) =>
    Array.from({ length: 4 }, (_, i) => ({ bank, index: i })),
  ).flat();
  const right = Array.from({ length: fill.banks }, (_, bank) =>
    Array.from({ length: 4 }, (_, i) => ({ bank, index: i + 4 })),
  ).flat();
  const same = barnPlanModelLayout(fill, [{ rooms: [...left, ...right] }]);
  assert.equal(same.extraLengthM, 0);
  assert.equal(same.extraWidthM, 0);
  assert.equal(same.cells.length, fill.banks * fill.roomCount);
  assert.equal(same.cells.filter((c) => c.kind === "aisle").length, 0);
  const glued0 = same.cells.find(
    (c) => c.kind === "room" && c.bank === 0 && c.index === 0,
  );
  const glued1 = same.cells.find(
    (c) => c.kind === "room" && c.bank === 1 && c.index === 0,
  );
  assert.ok(glued0 && glued1);
  assert.equal(Math.round(Math.abs(glued1.y - (glued0.y + glued0.h)) * 1000), 0);
  const gapped = barnPlanModelLayout(fill, [
    { rooms: left },
    { rooms: right },
  ]);
  const alongTall = barnPlanModelLayout(
    fill,
    [{ rooms: left }, { rooms: right }],
    6,
  );
  assert.equal(Math.round(alongTall.extraLengthM * 1000), 6000);
  const coverGap = Math.max(fill.aisleW, barnPlanZoneTagReserveM());
  assert.equal(
    Math.round(gapped.extraLengthM * 1000),
    Math.round(coverGap * 1000),
  );
  assert.equal(gapped.extraWidthM, 0);
  const a = gapped.cells.find(
    (c) => c.kind === "room" && c.bank === 0 && c.index === 3,
  );
  const b = gapped.cells.find(
    (c) => c.kind === "room" && c.bank === 0 && c.index === 4,
  );
  assert.ok(a && b);
  assert.equal(
    Math.round((b.x - (a.x + a.w)) * 1000),
    Math.round(coverGap * 1000),
  );
  const top = Array.from({ length: fill.roomCount }, (_, index) => ({
    bank: 0,
    index,
  }));
  const bottom = Array.from({ length: fill.roomCount }, (_, index) => ({
    bank: 1,
    index,
  }));
  const banks = barnPlanModelLayout(fill, [
    { rooms: top },
    { rooms: bottom },
  ]);
  const bankGap = fill.aisleW;
  assert.equal(banks.extraLengthM, 0);
  assert.equal(
    Math.round(banks.extraWidthM * 1000),
    Math.round(bankGap * 1000),
  );
  const c0 = banks.cells.find(
    (c) => c.kind === "room" && c.bank === 0 && c.index === 0,
  );
  const c1 = banks.cells.find(
    (c) => c.kind === "room" && c.bank === 1 && c.index === 0,
  );
  assert.ok(c0 && c1);
  assert.equal(
    Math.round((c1.y - (c0.y + c0.h)) * 1000),
    Math.round(bankGap * 1000),
  );
}

{
  const fill = applyBarnPlanFillPatch(defaultBarnPlanShellFill(), "", {
    banks: 4,
    roomCount: 4,
  });
  const rooms = (
    bank: number | number[],
    indexFrom: number,
    indexTo: number,
  ) => {
    const banks = Array.isArray(bank) ? bank : [bank];
    const out: { bank: number; index: number }[] = [];
    for (const b of banks) {
      for (let index = indexFrom; index <= indexTo; index++) {
        out.push({ bank: b, index });
      }
    }
    return out;
  };
  const mixed = barnPlanModelLayout(fill, [
    { rooms: rooms(0, 0, 1), stallTyCode: "SP05", stallNo: "1", eqpmnNo: "01" },
    { rooms: rooms(1, 0, 1), stallTyCode: "SP05", stallNo: "1", eqpmnNo: "02" },
    { rooms: rooms(2, 0, 1), stallTyCode: "SP05", stallNo: "1", eqpmnNo: "03" },
    { rooms: rooms(3, 0, 1), stallTyCode: "SP05", stallNo: "1", eqpmnNo: "04" },
    { rooms: rooms([0, 1], 2, 3), stallTyCode: "SP05", stallNo: "1", eqpmnNo: "05" },
    { rooms: rooms([2, 3], 2, 3), stallTyCode: "SP05", stallNo: "1", eqpmnNo: "06" },
  ]);
  const alongGap = Math.max(fill.aisleW, barnPlanZoneTagReserveM());
  const e0 = mixed.cells.find(
    (c) => c.kind === "room" && c.bank === 0 && c.index === 2,
  );
  const e1 = mixed.cells.find(
    (c) => c.kind === "room" && c.bank === 1 && c.index === 2,
  );
  const f2 = mixed.cells.find(
    (c) => c.kind === "room" && c.bank === 2 && c.index === 2,
  );
  const f3 = mixed.cells.find(
    (c) => c.kind === "room" && c.bank === 3 && c.index === 2,
  );
  assert.ok(e0 && e1 && f2 && f3);
  assert.equal(Math.round(Math.abs(e1.y - (e0.y + e0.h)) * 1000), 0);
  assert.equal(Math.round(Math.abs(f3.y - (f2.y + f2.h)) * 1000), 0);
  assert.equal(
    Math.round((f2.y - (e1.y + e1.h)) * 1000),
    Math.round(fill.aisleW * 1000),
  );
  const c01 = mixed.cells.find(
    (c) => c.kind === "room" && c.bank === 0 && c.index === 0,
  );
  const c02 = mixed.cells.find(
    (c) => c.kind === "room" && c.bank === 1 && c.index === 0,
  );
  const c03 = mixed.cells.find(
    (c) => c.kind === "room" && c.bank === 2 && c.index === 0,
  );
  const c04 = mixed.cells.find(
    (c) => c.kind === "room" && c.bank === 3 && c.index === 0,
  );
  assert.ok(c01 && c02 && c03 && c04);
  assert.equal(
    Math.round((c02.y - (c01.y + c01.h)) * 1000),
    Math.round(fill.aisleW * 1000),
  );
  assert.equal(
    Math.round((c03.y - (c02.y + c02.h)) * 1000),
    Math.round(fill.aisleW * 1000),
  );
  assert.equal(
    Math.round((c04.y - (c03.y + c03.h)) * 1000),
    Math.round(fill.aisleW * 1000),
  );
  const along01 = mixed.cells.find(
    (c) => c.kind === "room" && c.bank === 0 && c.index === 1,
  );
  assert.ok(along01);
  assert.equal(
    Math.round((e0.x - (along01.x + along01.w)) * 1000),
    Math.round(alongGap * 1000),
  );
  const stripMidY = (index: number) => {
    const list = mixed.cells.filter(
      (c) => c.kind === "room" && c.index === index,
    );
    const min = Math.min(...list.map((c) => c.y));
    const max = Math.max(...list.map((c) => c.y + c.h));
    return (min + max) / 2;
  };
  assert.ok(Math.abs(stripMidY(0)) < 0.01);
  assert.ok(Math.abs(stripMidY(2)) < 0.01);
}

{
  const fill = applyBarnPlanFillPatch(defaultBarnPlanShellFill(), "", {
    banks: 4,
    roomCount: 4,
  });
  const half = (banks: number[], indexFrom: number, indexTo: number) => {
    const out: { bank: number; index: number }[] = [];
    for (const b of banks) {
      for (let index = indexFrom; index <= indexTo; index++) {
        out.push({ bank: b, index });
      }
    }
    return out;
  };
  const split = barnPlanModelLayout(fill, [
    {
      rooms: half([0, 1], 0, 3),
      stallTyCode: "SP05",
      stallNo: "1",
      eqpmnNo: "01",
    },
    {
      rooms: half([2, 3], 0, 3),
      stallTyCode: "SP03",
      stallNo: "1",
      eqpmnNo: "01",
    },
  ]);
  const a = split.cells.find(
    (c) => c.kind === "room" && c.bank === 1 && c.index === 0,
  );
  const b = split.cells.find(
    (c) => c.kind === "room" && c.bank === 2 && c.index === 0,
  );
  assert.ok(a && b);
  const zoneGap = fill.aisleW;
  assert.equal(Math.round(split.extraWidthM * 1000), Math.round(zoneGap * 1000));
  assert.equal(split.extraLengthM, 0);
  assert.equal(
    Math.round((b.y - (a.y + a.h)) * 1000),
    Math.round(zoneGap * 1000),
  );
}

{
  const fill = defaultBarnPlanShellFill();
  const left = Array.from({ length: fill.banks }, (_, bank) =>
    Array.from({ length: 4 }, (_, i) => ({ bank, index: i })),
  ).flat();
  const right = Array.from({ length: fill.banks }, (_, bank) =>
    Array.from({ length: 4 }, (_, i) => ({ bank, index: i + 4 })),
  ).flat();
  const covers = [{ rooms: left }, { rooms: right }];
  const start = barnPlanLerpModelCells(fill, covers, 0);
  assert.ok(start.some((c) => c.kind === "aisle"));
  const end = barnPlanLerpModelCells(fill, covers, 1);
  assert.equal(end.filter((c) => c.kind === "aisle").length, 0);
  const mid = barnPlanLerpModelCells(fill, covers, 0.5);
  const a0 = start.find((c) => c.kind === "room" && c.bank === 0 && c.index === 4);
  const a1 = end.find((c) => c.kind === "room" && c.bank === 0 && c.index === 4);
  const am = mid.find((c) => c.kind === "room" && c.bank === 0 && c.index === 4);
  assert.ok(a0 && a1 && am);
  const lo = Math.min(a0.y, a1.y);
  const hi = Math.max(a0.y, a1.y);
  assert.ok(am.y >= lo - 1e-9 && am.y <= hi + 1e-9);
}

{
  const upper = {
    id: "a",
    label: "위",
    box: { minX: 10, maxX: 20, minZ: 40, maxZ: 70 },
    outside: true,
  };
  const lower = {
    id: "b",
    label: "아래",
    box: { minX: 10, maxX: 20, minZ: 10, maxZ: 38 },
    outside: true,
  };
  const stacked = barnPlanSpreadZoneLabels([upper, lower], {
    widthM: 80,
    heightM: 80,
  });
  const a = stacked.find((p) => p.id === "a");
  const b = stacked.find((p) => p.id === "b");
  assert.ok(a && b);
  assert.equal(Math.round(a.x), 15);
  assert.equal(Math.round(b.x), 15);
  assert.ok(a.z > 70);
  assert.ok(b.z > 38);
  const roof = barnPlanSpreadZoneLabels(
    [
      { ...upper, group: "dong", order: "01" },
      { ...lower, group: "dong", order: "05" },
    ],
    { widthM: 80, heightM: 80 },
  );
  const roofA = roof.find((p) => p.id === "a");
  const roofB = roof.find((p) => p.id === "b");
  assert.ok(roofA && roofB);
  assert.ok(roofA.z > 70);
  assert.equal(Math.round(roofA.z), Math.round(roofB.z));
  assert.ok(roofA.x < roofB.x);
  const sideL = {
    id: "l",
    label: "왼",
    box: { minX: 8, maxX: 18, minZ: 10, maxZ: 40 },
    outside: true,
  };
  const sideR = {
    id: "r",
    label: "오",
    box: { minX: 20, maxX: 30, minZ: 10, maxZ: 40 },
    outside: true,
  };
  const row = barnPlanSpreadZoneLabels([sideL, sideR], {
    widthM: 80,
    heightM: 80,
  });
  const l = row.find((p) => p.id === "l");
  const r = row.find((p) => p.id === "r");
  assert.ok(l && r);
  assert.ok(l.z > 40);
  assert.ok(r.z > 40);
  assert.equal(l.x, 13);
  assert.equal(r.x, 25);
  const inner = barnPlanSpreadZoneLabels(
    [
      {
        id: "in",
        label: "안",
        box: { minX: 10, maxX: 20, minZ: 10, maxZ: 40 },
        outside: false,
      },
    ],
    { widthM: 80, heightM: 80 },
  );
  assert.equal(inner[0]?.x, 15);
  assert.equal(inner[0]?.z, 25);
  const tall = barnPlanSpreadZoneLabels(
    [
      {
        id: "tall",
        label: "긴",
        box: { minX: 10, maxX: 18, minZ: 10, maxZ: 70 },
        outside: true,
      },
    ],
    { widthM: 80, heightM: 80 },
  );
  assert.equal(tall[0]?.x, 14);
  assert.ok((tall[0]?.z ?? 0) > 70);
  const wide = barnPlanSpreadZoneLabels(
    [
      {
        id: "wide",
        label: "넓",
        box: { minX: 10, maxX: 50, minZ: 20, maxZ: 28 },
        outside: true,
      },
    ],
    { widthM: 80, heightM: 80 },
  );
  assert.equal(Math.round(wide[0]?.x ?? 0), 30);
  assert.ok((wide[0]?.z ?? 0) > 28);
}

{
  const box = barnPlanLocalRectToFieldBox({ x: 40, z: 30 }, 90, {
    x: -4,
    y: -2,
    w: 8,
    h: 4,
  });
  assert.ok(box.maxZ > box.minZ);
  assert.ok(box.maxX > box.minX);
}

{
  const well = barnPlanPadField({ widthM: 100, heightM: 40 });
  assert.equal(well.padX, 100 * BARN_PLAN_MODEL_WELL_PAD_RATIO);
  assert.equal(well.padZ, 40 * BARN_PLAN_MODEL_WELL_PAD_RATIO);
  assert.equal(well.widthM, 100 + 2 * well.padX);
  assert.equal(well.heightM, 40 + 2 * well.padZ);
  const field = { widthM: well.widthM, heightM: well.heightM };
  const fit = barnPlanCameraFit(field);
  const vb0 = barnPlanCameraViewBox(field, fit);
  assert.equal(Math.round(vb0.w), Math.round(field.widthM));
  assert.equal(Math.round(vb0.h), Math.round(field.heightM));
  const zoomed = barnPlanCameraZoomAt(
    field,
    fit,
    { x: field.widthM / 2, z: field.heightM / 2 },
    BARN_PLAN_MODEL_ZOOM_MAX,
  );
  assert.equal(zoomed.k, BARN_PLAN_MODEL_ZOOM_MAX);
  const vb1 = barnPlanCameraViewBox(field, zoomed);
  assert.equal(Math.round(vb1.w * 1000), Math.round((field.widthM / 3) * 1000));
  const past = barnPlanCameraZoomAt(field, zoomed, { x: 0, z: 0 }, 99);
  assert.equal(past.k, BARN_PLAN_MODEL_ZOOM_MAX);
}

{
  const wide = barnPlanCameraTagFitK({ widthM: 100 }, 1000, [
    { widthM: 10, needPx: 50 },
  ]);
  assert.equal(wide, 1);
  const tight = barnPlanCameraTagFitK({ widthM: 100 }, 1000, [
    { widthM: 4, needPx: 60 },
  ]);
  assert.equal(tight, 1.5);
  const clamped = barnPlanCameraTagFitK({ widthM: 100 }, 1000, [
    { widthM: 2, needPx: 80 },
  ]);
  assert.equal(clamped, BARN_PLAN_MODEL_ZOOM_MAX);
  assert.ok(barnPlanZoneTagNeedPx({ label: "자돈사" }) >= 3 * 13);
  assert.ok(
    barnPlanZoneTagNeedPx({
      label: "자돈사",
      stallNo: "1",
      eqpmnNo: "06",
    }) >= barnPlanZoneTagNeedPx({ label: "자돈사" }),
  );
}

console.log("barn-plan-place.test.ts ok");
