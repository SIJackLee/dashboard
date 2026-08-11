import assert from "node:assert/strict";
import {
  resolveUltraFcstBase,
  resolveUltraNcstBase,
} from "@/lib/weather/kma-base-time";

function kstDate(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
): Date {
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi));
}

assert.deepEqual(resolveUltraNcstBase(kstDate(2026, 8, 11, 14, 45)), {
  baseDate: "20260811",
  baseTime: "1400",
});

assert.deepEqual(resolveUltraNcstBase(kstDate(2026, 8, 11, 14, 20)), {
  baseDate: "20260811",
  baseTime: "1300",
});

assert.deepEqual(resolveUltraNcstBase(kstDate(2026, 8, 11, 0, 20)), {
  baseDate: "20260810",
  baseTime: "2300",
});

assert.deepEqual(resolveUltraFcstBase(kstDate(2026, 8, 11, 15, 10)), {
  baseDate: "20260811",
  baseTime: "1430",
});

assert.deepEqual(resolveUltraFcstBase(kstDate(2026, 8, 11, 11, 0)), {
  baseDate: "20260811",
  baseTime: "0830",
});

assert.deepEqual(resolveUltraFcstBase(kstDate(2026, 8, 11, 2, 0)), {
  baseDate: "20260810",
  baseTime: "2330",
});

console.log("kma-base-time.test.ts ok");
