import assert from "node:assert/strict";
import {
  hoverPairSlotDx,
  nearestByXView,
} from "./trend-chart-interaction";

{
  assert.equal(hoverPairSlotDx(100, 1), 100);
  assert.equal(hoverPairSlotDx(100, 5), 18.75);
  assert.equal(hoverPairSlotDx(0, 10), 0);
}

{
  const items = [
    { id: "a", xView: 10 },
    { id: "b", xView: 40 },
    { id: "c", xView: 42 },
  ];
  assert.equal(nearestByXView(items, 41, 8)?.id, "c");
  assert.equal(nearestByXView(items, 10, 8)?.id, "a");
  assert.equal(nearestByXView(items, 80, 8), null);
  assert.equal(nearestByXView([], 10, 8), null);
}

console.log("trend-chart-interaction.test.ts ok");
