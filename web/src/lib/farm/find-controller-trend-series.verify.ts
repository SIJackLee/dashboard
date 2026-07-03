/**
 * Logical verification for findControllerTrendSeries (no test runner required).
 * Run: npx tsx src/lib/farm/find-controller-trend-series.verify.ts
 */
import {
  findControllerTrendSeries,
  findStallTrendSeries,
} from "./controller-summary-display";
import type {
  TrendControllerPeriodData,
  TrendPeriodData,
} from "@/lib/data/farm-trend-types";

const periodData: TrendControllerPeriodData = {
  period: "24h",
  categories: ["00시", "01시"],
  bucketAts: ["2026-07-02T00:00:00.000Z", "2026-07-02T01:00:00.000Z"],
  totalSamples: 2,
  sp: [
    {
      stallTyCode: "SP06",
      label: "육성사",
      stalls: [
        {
          stallNo: "01",
          controllers: [
            {
              stallNo: "01",
              controllerKey: "SP06:01:01",
              eqpmnNo: "01",
              temp: [24, 25],
              humidity: [50, 51],
              fanSupply: [60, 61],
              fanExhaust: [40, 41],
              fanIntake: [80, 81],
              sampleCount: [1, 1],
            },
            {
              stallNo: "01",
              controllerKey: "SP06:01:02",
              eqpmnNo: "02",
              temp: [24, 25],
              humidity: [50, 51],
              fanSupply: [70, 71],
              fanExhaust: [42, 43],
              fanIntake: [78, 79],
              sampleCount: [1, 1],
            },
          ],
        },
      ],
    },
  ],
};

const byPeriod = { "24h": periodData, "7d": periodData, "30d": periodData };

const a = findControllerTrendSeries(byPeriod, "24h", "SP06", "01", "SP06:01:01");
const b = findControllerTrendSeries(byPeriod, "24h", "SP06", "01", "SP06:01:02");

if (!a || !b) {
  console.error("FAIL: missing series");
  process.exit(1);
}

if (a.fanSupply[0] === b.fanSupply[0]) {
  console.error("FAIL: controllers should have different fanSupply", a.fanSupply[0], b.fanSupply[0]);
  process.exit(1);
}

const stallTrend: TrendPeriodData = {
  period: "24h",
  categories: periodData.categories,
  bucketAts: periodData.bucketAts,
  totalSamples: 2,
  sp: [
    {
      stallTyCode: "SP06",
      label: "육성사",
      stalls: [
        {
          stallNo: "01",
          temp: [24, 25],
          humidity: [50, 51],
          fanSupply: [65, 66],
          fanExhaust: [41, 42],
          fanIntake: [79, 80],
          sampleCount: [2, 2],
        },
      ],
    },
  ],
};

const stallSeries = findStallTrendSeries(
  { "24h": stallTrend, "7d": stallTrend, "30d": stallTrend },
  "24h",
  "SP06",
  "01"
);

if (stallSeries?.fanSupply[0] === a.fanSupply[0]) {
  console.error("FAIL: stall aggregate must differ from per-controller series");
  process.exit(1);
}

console.log("OK: findControllerTrendSeries returns distinct per-controller data");
console.log("  eq01 supply:", a.fanSupply[0], "eq02 supply:", b.fanSupply[0], "stall avg:", stallSeries?.fanSupply[0]);
