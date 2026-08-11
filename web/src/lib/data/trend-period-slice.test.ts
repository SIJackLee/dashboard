import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TREND_PERIODS } from "@/lib/data/farm-trend-types";
import {
  sliceControllerTrendFromLonger,
  sliceStallTrendFromLonger,
} from "@/lib/data/trend-period-slice";
import type {
  TrendControllerPeriodData,
  TrendPeriodData,
} from "@/lib/data/farm-trend-types";

function emptyStallSeries(len: number, stallNo: string) {
  const col = () => new Array<number | null>(len).fill(null);
  return {
    stallNo,
    temp: col(),
    humidity: col(),
    fanSupply: col(),
    fanExhaust: col(),
    fanIntake: col(),
    sampleCount: new Array<number>(len).fill(0),
  };
}

function makeStallTrend30d(): TrendPeriodData {
  const n = TREND_PERIODS["30d"].bucketCount;
  const categories = Array.from({ length: n }, (_, i) => `8/${(i % 30) + 1} 12:00`);
  const bucketAts = categories.map((_, i) =>
    new Date(Date.UTC(2026, 7, 1, 0, i * 15, 0)).toISOString(),
  );
  return {
    period: "30d",
    categories,
    bucketAts,
    sp: [
      {
        stallTyCode: "SP01",
        label: "임신",
        stalls: [emptyStallSeries(n, "01")],
      },
    ],
    totalSamples: 0,
  };
}

function makeControllerTrend30d(): TrendControllerPeriodData {
  const n = TREND_PERIODS["30d"].bucketCount;
  const categories = Array.from({ length: n }, (_, i) => `8/${(i % 30) + 1} 12:00`);
  const bucketAts = categories.map((_, i) =>
    new Date(Date.UTC(2026, 7, 1, 0, i * 15, 0)).toISOString(),
  );
  return {
    period: "30d",
    categories,
    bucketAts,
    sp: [
      {
        stallTyCode: "SP01",
        label: "임신",
        stalls: [
          {
            stallNo: "01",
            controllers: [
              {
                ...emptyStallSeries(n, "01"),
                controllerKey: "SP01:01:01",
                eqpmnNo: "01",
              },
            ],
          },
        ],
      },
    ],
    totalSamples: 0,
  };
}

describe("sliceStallTrendFromLonger", () => {
  it("30d → 7d tail slice", () => {
    const src = makeStallTrend30d();
    const out = sliceStallTrendFromLonger(src, "7d");
    assert.ok(out);
    assert.equal(out!.period, "7d");
    assert.equal(out!.categories.length, TREND_PERIODS["7d"].bucketCount);
    assert.equal(out!.bucketAts.length, TREND_PERIODS["7d"].bucketCount);
    assert.equal(
      out!.categories[0],
      src.categories[src.categories.length - TREND_PERIODS["7d"].bucketCount],
    );
  });

  it("30d → 24h tail slice", () => {
    const src = makeStallTrend30d();
    const out = sliceStallTrendFromLonger(src, "24h");
    assert.ok(out);
    assert.equal(out!.period, "24h");
    assert.equal(out!.categories.length, TREND_PERIODS["24h"].bucketCount);
  });

  it("rejects non-30d source", () => {
    const src = makeStallTrend30d();
    src.period = "7d";
    assert.equal(sliceStallTrendFromLonger(src, "24h"), null);
  });
});

describe("sliceControllerTrendFromLonger", () => {
  it("30d → 7d tail slice", () => {
    const src = makeControllerTrend30d();
    const out = sliceControllerTrendFromLonger(src, "7d");
    assert.ok(out);
    assert.equal(out!.sp[0]!.stalls[0]!.controllers[0]!.temp.length, 672);
  });

  it("30d → 24h tail slice", () => {
    const src = makeControllerTrend30d();
    const out = sliceControllerTrendFromLonger(src, "24h");
    assert.ok(out);
    assert.equal(out!.sp[0]!.stalls[0]!.controllers[0]!.temp.length, 96);
  });
});
