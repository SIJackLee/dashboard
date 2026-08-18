/**
 * 실행: npx tsx src/lib/farm/barn-model-layout.test.ts
 */
import assert from "node:assert/strict";
import type { BarnReading } from "@/lib/data/iot";
import { DEFAULT_FARM } from "@/lib/data/farm-key";
import {
  assignPensFromReadings,
  barnModelEditCameraPose,
  barnModelFillEditCameraPose,
  barnModelCameraPose,
  barnModelFieldCameraPose,
  barnModelRoofHeight,
  barnModelYardBounds,
  barnModelYardGridSize,
  barnModelEntranceStandOff,
  barnModelFarmSlots,
  barnModelRoofTitle,
  barnModelStallKey,
  barnModelStatusHex,
  defaultBarnModelPlan,
  isBarnSlotPlaced,
  nextCustomStallNo,
  buildBarnModelYard,
  placedBarnLabel,
  primaryReadingForType,
  mountBarnControllers,
  BARN_CTRL_GAP_X,
  BARN_CTRL_GAP_Y,
  BARN_CTRL_H,
  BARN_CTRL_PAD,
  BARN_CTRL_W,
  cyclePlacedBarnId,
  cycleSameTypeBarnId,
  findPlacedBarnId,
  typeControllerCount,
  rotateY,
  worstControllerStatus,
} from "./barn-model-layout";
import {
  barnModelLength,
  barnModelPenDepth,
  barnModelShell,
  barnModelWidth,
  maxRoomCount,
} from "./barn-model-dim";
import { addPlacedBarn, emptyBarnModelPrefs } from "./barn-model-prefs";

function reading(
  partial: Pick<BarnReading, "controllerKey" | "status"> &
    Partial<BarnReading>,
): BarnReading {
  const { controllerKey, status, ...rest } = partial;
  return {
    key: rest.key ?? controllerKey,
    farmKey: DEFAULT_FARM,
    moduleUid: 1,
    controllerKey,
    eqpmnNo: rest.eqpmnNo ?? "01",
    stallNo: rest.stallNo ?? "1",
    stallTyCode: rest.stallTyCode ?? "SP03",
    label: rest.label ?? controllerKey,
    tempC: 24,
    humidityPct: 60,
    fanSupply: null,
    fanExhaust: null,
    fanIntake: null,
    fanSupplySeries: [],
    fanExhaustSeries: [],
    fanIntakeSeries: [],
    mesureDt: null,
    receivedAt: "2026-08-16T00:00:00Z",
    status,
    packetMode: "live",
    wireVer: 12,
    ...rest,
  };
}

{
  const farrow = { left: 3, right: 3 };
  assert.equal(barnModelWidth("SP03", farrow), 6.6);
  assert.equal(barnModelLength("SP03", farrow), 5.8);
  assert.equal(barnModelWidth("SP02", { left: 1, right: 0 }), 4);
  assert.equal(barnModelLength("SP02", { left: 1, right: 0 }), 1.05);
  assert.equal(barnModelWidth("SP07", { left: 4, right: 4 }), 14.8);
  assert.equal(barnModelLength("SP07", { left: 4, right: 4 }), 15.4);
  assert.equal(barnModelRoofTitle("SP03", "01", "normal"), "분만사-01-정상");
  assert.equal(barnModelRoofTitle("SP05", "", "caution"), "자돈사-01-주의");
}

{
  assert.equal(maxRoomCount("SP02"), 184);
  assert.equal(barnModelLength("SP02", { left: 184, right: 184 }), 120);
}

{
  assert.equal(worstControllerStatus([]), "offline");
  assert.equal(barnModelStatusHex("normal"), "#34d399");
  const [x, z] = rotateY(0, 1, 90);
  assert.ok(Math.abs(x - -1) < 1e-6);
  assert.ok(Math.abs(z) < 1e-6);
}

{
  const empty = buildBarnModelYard([], emptyBarnModelPrefs());
  assert.equal(empty.barns.length, 0);
}

{
  const pens = assignPensFromReadings(
    [
      reading({ controllerKey: "SP03:01:01", status: "normal", eqpmnNo: "01" }),
      reading({ controllerKey: "SP03:01:02", status: "caution", eqpmnNo: "02" }),
    ],
    { left: 1, right: 1 },
  );
  assert.equal(pens.length, 2);
  assert.equal(pens[0]!.controllerKey, null);
  assert.equal(pens[0]!.status, "empty");
}

{
  const prefs = addPlacedBarn(emptyBarnModelPrefs(), {
    stallTyCode: "SP03",
    plan: { left: 3, right: 3 },
  });
  const yard = buildBarnModelYard(
    [
      reading({
        controllerKey: "SP03:01:01",
        status: "normal",
        stallTyCode: "SP03",
        stallNo: "01",
      }),
    ],
    prefs,
  );
  assert.equal(yard.barns.length, 1);
  assert.equal(yard.barns[0]!.width, 6.6);
  assert.equal(yard.barns[0]!.length, 5.8);
  assert.equal(yard.barns[0]!.pens.length, 6);
  assert.equal(yard.barns[0]!.controllerKey, "SP03:01:01");
  assert.equal(yard.barns[0]!.status, "normal");
  assert.equal(yard.barns[0]!.tempC, 24);
  assert.equal(yard.barns[0]!.pens.filter((p) => p.controllerKey).length, 0);
  assert.ok(yard.barns[0]!.pens.every((p) => p.status === "normal"));
  const mixed = buildBarnModelYard(
    [
      reading({
        controllerKey: "SP03:01:01",
        status: "normal",
        stallTyCode: "SP03",
        stallNo: "01",
      }),
      reading({
        controllerKey: "SP03:02:01",
        status: "caution",
        stallTyCode: "SP03",
        stallNo: "02",
      }),
      reading({
        controllerKey: "SP02:01:01",
        status: "offline",
        stallTyCode: "SP02",
        stallNo: "01",
      }),
    ],
    prefs,
  );
  assert.equal(mixed.barns[0]!.status, "caution");
  assert.equal(mixed.barns[0]!.controllerKey, "SP03:02:01");
  assert.ok(mixed.barns[0]!.pens.every((p) => p.status === "caution"));
  assert.equal(
    primaryReadingForType([
      reading({
        controllerKey: "a",
        status: "normal",
        stallTyCode: "SP03",
      }),
      reading({
        controllerKey: "b",
        status: "caution",
        stallTyCode: "SP03",
      }),
    ])?.controllerKey,
    "b",
  );
  const roof = barnModelCameraPose("roof", yard, null);
  const roofSpan = barnModelYardBounds(yard).span;
  assert.ok(roof.position[1] < 42);
  assert.ok(roof.position[1] >= 14);
  assert.ok(roof.position[1] < 62);
  assert.equal(roof.position[1], barnModelRoofHeight(roofSpan));
  assert.ok(Math.abs(roof.position[2] - roof.lookAt[2]) < 4);
  assert.ok(barnModelYardGridSize(roofSpan) <= 60);
  assert.ok(barnModelYardGridSize(12) < barnModelYardGridSize(80));
  const field = barnModelFieldCameraPose(yard);
  assert.ok(field.position[1] > roof.position[1]);
  assert.ok(Math.abs(field.lookAt[0]) < 1);
  assert.ok(Math.abs(field.lookAt[2]) < 1);
  const emptyField = barnModelFieldCameraPose({ barns: [] });
  assert.equal(emptyField.position[1], barnModelRoofHeight(100));
  const edit = barnModelEditCameraPose(yard.barns[0]!);
  assert.deepEqual(edit.lookAt, [
    yard.barns[0]!.origin[0],
    0,
    yard.barns[0]!.origin[2],
  ]);
  assert.ok(edit.position[1] >= 14);
  assert.ok(edit.position[1] <= 42);
  const fillCam = barnModelFillEditCameraPose(yard.barns[0]!);
  assert.deepEqual(fillCam.lookAt, edit.lookAt);
  assert.ok(fillCam.position[1] > edit.position[1]);
  assert.ok(fillCam.position[1] < field.position[1]);
  const enter = barnModelCameraPose("entrance", yard, yard.barns[0]!.id);
  assert.ok(enter.position[2] !== enter.lookAt[2] || enter.position[0] !== enter.lookAt[0]);
  assert.ok(barnModelEntranceStandOff(6.2) < barnModelEntranceStandOff(11.8));
  assert.ok(barnModelEntranceStandOff(6.2) >= 6.6);
  assert.ok(barnModelEntranceStandOff(14.8) <= 11.2);
}

{
  assert.equal(
    placedBarnLabel({
      id: "a",
      stallTyCode: "SP03",
      stallNo: "01",
      x: 0,
      z: 0,
      rotDeg: 0,
      plan: { left: 1, right: 0 },
    }),
    "분만사 01",
  );
  assert.equal(
    placedBarnLabel({
      id: "a",
      stallTyCode: "SP03",
      stallNo: "01",
      name: "A동",
      x: 0,
      z: 0,
      rotDeg: 0,
      plan: { left: 1, right: 0 },
    }),
    "A동",
  );
}

{
  assert.deepEqual(defaultBarnModelPlan("SP03"), { left: 3, right: 3 });
  assert.equal(barnModelStallKey("sp03", "01"), barnModelStallKey("SP03", "1"));
  const slots = barnModelFarmSlots(
    [],
    [
      reading({ controllerKey: "a", status: "normal", stallTyCode: "SP03", stallNo: "02" }),
      reading({ controllerKey: "b", status: "normal", stallTyCode: "SP03", stallNo: "01" }),
      reading({ controllerKey: "c", status: "normal", stallTyCode: "SP05", stallNo: "1" }),
      reading({ controllerKey: "d", status: "normal", stallTyCode: "SP03", stallNo: "01" }),
      reading({ controllerKey: "e", status: "normal", stallTyCode: "SP03", stallNo: "__ck_x" }),
    ],
  );
  assert.deepEqual(
    slots.map((s) => `${s.stallTyCode}:${s.stallNo}`),
    ["SP03:01", "SP03:02", "SP05:1"],
  );
  assert.equal(slots[0]!.label, "분만사 01");
  assert.equal(
    isBarnSlotPlaced("SP03", "1", [
      { stallTyCode: "SP03", stallNo: "01" },
    ]),
    true,
  );
  assert.equal(nextCustomStallNo("SP03", slots), "03");
}

{
  const dims = { width: 6.6, length: 5.8, aisleX: 0, aisleW: 1.8 };
  assert.deepEqual(mountBarnControllers([], dims), []);
  const many = Array.from({ length: 6 }, (_, i) => {
    const eq = String(i + 1).padStart(2, "0");
    return reading({
      controllerKey: `SP03:01:${eq}`,
      status: "normal",
      stallTyCode: "SP03",
      stallNo: "01",
      eqpmnNo: eq,
    });
  });
  const mounts = mountBarnControllers(
    [
      ...many,
      reading({
        controllerKey: "SP03:01:01",
        status: "normal",
        stallTyCode: "SP03",
        stallNo: "01",
        eqpmnNo: "01",
      }),
    ],
    dims,
  );
  assert.equal(mounts.length, 6);
  assert.deepEqual(
    mounts.map((m) => m.eqpmnNo),
    ["01", "02", "03", "04", "05", "06"],
  );
  const aisleLeft = dims.aisleX - dims.aisleW / 2;
  const half = BARN_CTRL_W / 2;
  assert.ok(mounts.every((m) => m.position[0] < aisleLeft - half + 0.02));
  const xs = new Set(mounts.map((m) => m.position[0].toFixed(2)));
  assert.ok(xs.size <= 2);
  const topY = Math.max(...mounts.map((m) => m.position[1]));
  const topLeft = mounts
    .filter((m) => Math.abs(m.position[1] - topY) < 0.05)
    .sort((a, b) => a.position[0] - b.position[0])[0];
  assert.equal(topLeft?.eqpmnNo, "01");
  for (const m of mounts) {
    assert.ok(Math.abs(m.rotY) < 0.01);
    assert.ok(Math.abs(m.position[2] - dims.length / 2) < 0.2);
  }
  for (let i = 0; i < mounts.length; i += 1) {
    for (let j = i + 1; j < mounts.length; j += 1) {
      const a = mounts[i]!;
      const b = mounts[j]!;
      const dy = Math.abs(a.position[1] - b.position[1]);
      const xz = Math.hypot(
        a.position[0] - b.position[0],
        a.position[2] - b.position[2],
      );
      if (dy < 0.05) {
        assert.ok(
          xz >= BARN_CTRL_W + BARN_CTRL_GAP_X - 0.02,
          `${a.eqpmnNo} vs ${b.eqpmnNo} overlap xz=${xz}`,
        );
      } else if (xz < 0.05) {
        assert.ok(
          dy >= BARN_CTRL_H + BARN_CTRL_GAP_Y - 0.02,
          `${a.eqpmnNo} vs ${b.eqpmnNo} overlap dy=${dy}`,
        );
      }
    }
  }
  assert.equal(typeControllerCount(many), 6);
}

{
  const dims = { width: 11.8, length: 8.2, aisleX: 0, aisleW: 1.8 };
  const many = Array.from({ length: 6 }, (_, i) => {
    const eq = String(i + 1).padStart(2, "0");
    return reading({
      controllerKey: `SP05:01:${eq}`,
      status: "normal",
      stallTyCode: "SP05",
      stallNo: "01",
      eqpmnNo: eq,
    });
  });
  const mounts = mountBarnControllers(many, dims);
  const aisleLeft = dims.aisleX - dims.aisleW / 2;
  const pad = BARN_CTRL_PAD;
  const half = BARN_CTRL_W / 2;
  const xMin = -dims.width / 2 + pad + half;
  const xMax = aisleLeft - pad - half;
  const midX = (xMin + xMax) / 2;
  const colXs = [...new Set(mounts.map((m) => m.position[0]))].sort(
    (a, b) => a - b,
  );
  assert.equal(colXs.length, 2);
  assert.ok(Math.abs((colXs[0]! + colXs[1]!) / 2 - midX) < 0.05);
  assert.ok(
    Math.abs(colXs[1]! - colXs[0]! - (BARN_CTRL_W + BARN_CTRL_GAP_X)) < 0.05,
  );
  assert.ok(mounts.every((m) => m.position[0] < aisleLeft - half + 0.02));
}

{
  const placed = [
    { id: "a", stallTyCode: "SP03", stallNo: "02" },
    { id: "b", stallTyCode: "SP02", stallNo: "01" },
    { id: "c", stallTyCode: "SP03", stallNo: "01" },
  ];
  assert.equal(cyclePlacedBarnId(placed, "c", 1), "a");
  assert.equal(cyclePlacedBarnId(placed, "a", 1), "b");
  assert.equal(cycleSameTypeBarnId(placed, "c", 1), "a");
  assert.equal(cycleSameTypeBarnId(placed, "a", 1), "c");
  assert.equal(findPlacedBarnId(placed, "SP03", "1"), "c");
}

{
  const farrow = { left: 3, right: 3 };
  assert.equal(barnModelPenDepth(farrow, 6.6), 2.4);
  assert.equal(
    barnModelShell({ stallTyCode: "SP03", plan: farrow }).wallH,
    3.2,
  );
  const custom = barnModelShell({
    stallTyCode: "SP03",
    plan: farrow,
    lengthM: 20,
    widthM: 10,
    wallHM: 4.5,
  });
  assert.equal(custom.length, 20);
  assert.equal(custom.width, 10);
  assert.equal(custom.wallH, 4.5);
  const prefs = addPlacedBarn(emptyBarnModelPrefs(), {
    stallTyCode: "SP03",
    plan: farrow,
  });
  prefs.placed[0]!.lengthM = 20;
  prefs.placed[0]!.widthM = 10;
  prefs.placed[0]!.wallHM = 4.5;
  const yard = buildBarnModelYard([], prefs);
  assert.equal(yard.barns[0]!.length, 20);
  assert.equal(yard.barns[0]!.width, 10);
  assert.equal(yard.barns[0]!.wallH, 4.5);
  assert.ok(
    Math.abs(yard.barns[0]!.pens[0]!.size[0] - (10 - 1.8) / 2 + 0.12) < 1e-6,
  );
}

{
  const three = barnModelShell({
    stallTyCode: "SP03",
    plan: { left: 3, mid: 3, right: 3 },
    banks: 3,
  });
  assert.equal(three.width, 10.8);
  assert.equal(three.length, 5.8);
  const prefs = addPlacedBarn(emptyBarnModelPrefs(), {
    stallTyCode: "SP03",
    plan: { left: 3, mid: 3, right: 3 },
  });
  const yard = buildBarnModelYard([], prefs);
  assert.equal(yard.barns[0]!.fill.banks, 3);
  assert.equal(yard.barns[0]!.width, 10.8);
  assert.equal(yard.barns[0]!.pens.length, 9);
  const wideAisle = barnModelShell({
    stallTyCode: "SP03",
    plan: { left: 3, mid: 3, right: 3 },
    banks: 3,
    aisleWM: 2.4,
  });
  assert.equal(wideAisle.width, 12);
}

console.log("barn-model-layout.test.ts: ok");
