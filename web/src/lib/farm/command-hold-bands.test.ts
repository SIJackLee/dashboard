import assert from "node:assert/strict";
import {
  buildCommandHoldSegments,
  commandHoldBandRect,
  commandHoldRowIndex,
  COMMAND_HOLD_FILL_OPACITY,
  COMMAND_HOLD_TEMP_DOMAIN,
} from "./command-hold-bands";

assert.equal(commandHoldRowIndex("A"), 0);
assert.equal(commandHoldRowIndex("C"), 2);
assert.equal(commandHoldRowIndex(null), null);
assert.ok(COMMAND_HOLD_FILL_OPACITY.A > COMMAND_HOLD_FILL_OPACITY.B);
assert.ok(COMMAND_HOLD_FILL_OPACITY.B > COMMAND_HOLD_FILL_OPACITY.C);

{
  const segs = buildCommandHoldSegments(
    [
      {
        id: "a1",
        x: 0.1,
        hold: {
          channel: "A",
          tempLo: 24,
          tempHi: 27,
          ventLo: 20,
          ventHi: 100,
        },
      },
      {
        id: "b1",
        x: 0.4,
        hold: {
          channel: "B",
          tempLo: 27,
          tempHi: 31,
          ventLo: 20,
          ventHi: 80,
        },
      },
      {
        id: "a2",
        x: 0.6,
        hold: {
          channel: "A",
          tempLo: 25,
          tempHi: 30,
          ventLo: 20,
          ventHi: 90,
        },
      },
    ],
    1,
  );
  assert.equal(segs.length, 3);
  const a1 = segs.find((s) => s.markId === "a1");
  const a2 = segs.find((s) => s.markId === "a2");
  const b1 = segs.find((s) => s.markId === "b1");
  assert.equal(a1?.x1, 0.6);
  assert.equal(a2?.x1, 1);
  assert.equal(b1?.x1, 1);
  assert.equal(a1?.tempLo, 24);
}

{
  const r = commandHoldBandRect(24, 27, COMMAND_HOLD_TEMP_DOMAIN, 0, 30);
  assert.ok(r);
  assert.ok(r!.y > 0);
  assert.ok(r!.h > 2);
  assert.equal(commandHoldBandRect(40, 50, COMMAND_HOLD_TEMP_DOMAIN, 0, 30), null);
}

console.log("command-hold-bands.test.ts: ok");
