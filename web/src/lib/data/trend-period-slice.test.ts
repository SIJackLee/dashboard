import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TREND_PERIODS } from "@/lib/data/farm-trend-types";
import {
  sliceControllerTrendFromLonger,
  sliceStallTrendFromLonger,
  stallTrendFromControllerPeriod,
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

describe("stallTrendFromControllerPeriod", () => {
  it("weights stall avg by sampleCount", () => {
    const src: TrendControllerPeriodData = {
      period: "24h",
      categories: ["a", "b"],
      bucketAts: ["t0", "t1"],
      totalSamples: 3,
      sp: [
        {
          stallTyCode: "SP03",
          label: "분만사",
          stalls: [
            {
              stallNo: "01",
              controllers: [
                {
                  stallNo: "01",
                  controllerKey: "k1",
                  eqpmnNo: "01",
                  temp: [20, 22],
                  humidity: [50, null],
                  fanSupply: [null, null],
                  fanExhaust: [10, 10],
                  fanIntake: [null, null],
                  sampleCount: [2, 1],
                },
                {
                  stallNo: "01",
                  controllerKey: "k2",
                  eqpmnNo: "02",
                  temp: [10, null],
                  humidity: [70, 60],
                  fanSupply: [null, null],
                  fanExhaust: [30, 20],
                  fanIntake: [null, null],
                  sampleCount: [2, 0],
                },
              ],
            },
          ],
        },
      ],
    };
    const out = stallTrendFromControllerPeriod(src);
    assert.equal(out.period, "24h");
    const stall = out.sp[0]!.stalls[0]!;
    assert.equal(stall.temp[0], 15);
    assert.equal(stall.temp[1], 22);
    assert.equal(stall.humidity[0], 60);
    assert.equal(stall.sampleCount[0], 4);
    assert.equal(stall.sampleCount[1], 1);
  });
});
