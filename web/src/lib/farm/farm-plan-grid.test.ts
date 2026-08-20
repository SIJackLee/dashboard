/**
 * 실행: npx tsx src/lib/farm/farm-plan-grid.test.ts
 */
import assert from "node:assert/strict";
import {
  assignFarmPlanCells,
  farmPlanGridCols,
  farmPlanGridSize,
  nextEmptyFarmPlanCell,
  parseFarmPlanCell,
} from "./farm-plan-grid";

assert.equal(farmPlanGridCols(true), 2);
assert.equal(farmPlanGridCols(false), 3);

{
  assert.deepEqual(parseFarmPlanCell({ x: 1, z: 2 }, 0, 3), { col: 1, row: 2 });
  assert.deepEqual(parseFarmPlanCell({ x: 0, z: 0 }, 4, 3), { col: 1, row: 1 });
  assert.deepEqual(parseFarmPlanCell({ x: 50, z: 62 }, 0, 3), { col: 1, row: 1 });
}

{
  const next = nextEmptyFarmPlanCell(
    [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ],
    3,
  );
  assert.deepEqual(next, { col: 2, row: 0 });
}

{
  const map = assignFarmPlanCells(
    [
      { id: "a", x: 0, z: 0 },
      { id: "b", x: 0, z: 0 },
      { id: "c", x: 0, z: 1 },
    ],
    3,
  );
  assert.deepEqual(map.get("a"), { col: 0, row: 0 });
  assert.deepEqual(map.get("b"), { col: 1, row: 0 });
  assert.deepEqual(map.get("c"), { col: 0, row: 1 });
}

{
  const size = farmPlanGridSize([{ col: 0, row: 0 }], 3, true);
  assert.equal(size.cols, 3);
  assert.equal(size.rows, 2);
}

console.log("farm-plan-grid.test.ts: ok");
