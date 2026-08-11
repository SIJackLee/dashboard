import assert from "node:assert/strict";
import { latLngToGrid } from "@/lib/weather/kma-grid";

assert.deepEqual(latLngToGrid(37.5665, 126.978), { nx: 60, ny: 127 });
assert.deepEqual(latLngToGrid(35.1796, 129.0756), { nx: 98, ny: 76 });
assert.deepEqual(latLngToGrid(37.4563, 126.7052), { nx: 55, ny: 124 });

console.log("kma-grid.test.ts ok");
