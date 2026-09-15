import assert from "node:assert/strict";
import {
  COMMAND_RANGE_FILL_OPACITY,
  COMMAND_RANGE_LABEL_ANCHOR,
  COMMAND_RANGE_LABEL_T,
  commandRangeLabelX,
  focusCommandRangeFrame,
  commandBoundInDomain,
  formatCommandRangeBoundText,
  parseChannelSlotLabel,
} from "./command-range-overlay";

assert.ok(COMMAND_RANGE_FILL_OPACITY.A > COMMAND_RANGE_FILL_OPACITY.B);
assert.ok(COMMAND_RANGE_FILL_OPACITY.B > COMMAND_RANGE_FILL_OPACITY.C);

assert.equal(COMMAND_RANGE_LABEL_ANCHOR.A, "end");
assert.equal(COMMAND_RANGE_LABEL_ANCHOR.B, "middle");
assert.equal(COMMAND_RANGE_LABEL_ANCHOR.C, "start");
assert.ok(COMMAND_RANGE_LABEL_T.A < COMMAND_RANGE_LABEL_T.B);
assert.ok(COMMAND_RANGE_LABEL_T.B < COMMAND_RANGE_LABEL_T.C);

{
  const padL = 10;
  const innerW = 80;
  const mid = padL + innerW * 0.5;
  const xA = commandRangeLabelX("A", padL, innerW);
  const xB = commandRangeLabelX("B", padL, innerW);
  const xC = commandRangeLabelX("C", padL, innerW);
  assert.ok(xA < mid);
  assert.equal(xB, mid);
  assert.ok(xC > mid);
}

assert.equal(
  formatCommandRangeBoundText("A", 24, "℃"),
  "A 24.0℃",
);
assert.equal(
  formatCommandRangeBoundText("C", 30.4, "%"),
  "C 30%",
);
assert.equal(formatCommandRangeBoundText("B", null, "℃"), null);
assert.equal(commandBoundInDomain(24, [20, 28]), true);
assert.equal(commandBoundInDomain(85, [20, 28]), false);
assert.equal(commandBoundInDomain(24, null), true);
assert.equal(parseChannelSlotLabel("A"), "A");
assert.equal(parseChannelSlotLabel("채널 C"), "C");
assert.equal(parseChannelSlotLabel("모터"), null);
{
  const focused = focusCommandRangeFrame(
    {
      channels: [
        {
          channel: "A",
          tempLo: 1,
          tempHi: 2,
          motorLo: 3,
          motorHi: 4,
          tempLoText: "A 1.0℃",
          tempHiText: "A 2.0℃",
          motorLoText: "A 3%",
          motorHiText: "A 4%",
        },
        {
          channel: "B",
          tempLo: 5,
          tempHi: 6,
          motorLo: 7,
          motorHi: 8,
          tempLoText: "B 5.0℃",
          tempHiText: "B 6.0℃",
          motorLoText: "B 7%",
          motorHiText: "B 8%",
        },
      ],
    },
    "B",
  );
  assert.equal(focused?.channels.length, 1);
  assert.equal(focused?.channels[0]?.channel, "B");
  assert.equal(focusCommandRangeFrame({ channels: [] }, "A"), null);
}

console.log("command-range-overlay.test.ts: ok");
