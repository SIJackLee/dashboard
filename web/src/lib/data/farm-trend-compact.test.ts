import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  expandCompactControllerPeriod,
  synthesizeOverview30dFrom7d,
  type CompactControllerPeriod,
} from "./farm-trend-compact";
import { TREND_PERIODS } from "./farm-trend-types";

describe("expandCompactControllerPeriod", () => {
  it("rebuilds a dense axis and sparse samples", () => {
    const fromMs = Date.UTC(2026, 7, 1, 0, 0, 0);
    const compact: CompactControllerPeriod = {
      v: 1,
      period: "24h",
      fromMs,
      bucketCount: TREND_PERIODS["24h"].bucketCount,
      strideMs: TREND_PERIODS["24h"].strideMs,
      totalSamples: 3,
      series: [
        {
          ty: "SP02",
          lb: "임신사",
          sn: "1",
          k: "SP02:1:01",
          e: "01",
          p: [[0, 20.5, 60, null, 10, null, 2], [2, 21, 61, null, 12, null, 1]],
        },
      ],
    };
    const out = expandCompactControllerPeriod(compact);
    assert.equal(out.period, "24h");
    assert.equal(out.categories.length, 96);
    assert.equal(out.bucketAts.length, 96);
    assert.equal(out.totalSamples, 3);
    const ctrl = out.sp[0]!.stalls[0]!.controllers[0]!;
    assert.equal(ctrl.temp[0], 20.5);
    assert.equal(ctrl.temp[1], null);
    assert.equal(ctrl.temp[2], 21);
    assert.equal(ctrl.sampleCount[0], 2);
    assert.equal(ctrl.humidity[2], 61);
  });

  it("does not allocate sample rows for empty series list", () => {
    const out = expandCompactControllerPeriod({
      v: 1,
      period: "7d",
      fromMs: 0,
      bucketCount: TREND_PERIODS["7d"].bucketCount,
      strideMs: TREND_PERIODS["7d"].strideMs,
      totalSamples: 0,
      series: [],
    });
    assert.equal(out.sp.length, 0);
    assert.equal(out.categories.length, 168);
  });
});

describe("synthesizeOverview30dFrom7d", () => {
  it("puts 7 daily averages into the last 7 of 30 slots", () => {
    const n = TREND_PERIODS["7d"].bucketCount;
    const d7 = expandCompactControllerPeriod({
      v: 1,
      period: "7d",
      fromMs: Date.UTC(2026, 7, 12, 0, 0, 0),
      bucketCount: n,
      strideMs: TREND_PERIODS["7d"].strideMs,
      totalSamples: 2,
      series: [
        {
          ty: "SP02",
          lb: "임신사",
          sn: "1",
          k: "k1",
          e: "01",
          p: [
            [0, 10, null, null, null, null, 1],
            [n - 1, 20, null, null, null, null, 1],
          ],
        },
      ],
    });
    const overview = synthesizeOverview30dFrom7d(d7);
    assert.equal(overview.categories.length, 30);
    const ctrl = overview.sp[0]!.stalls[0]!.controllers[0]!;
    assert.equal(ctrl.temp[0], null);
    assert.equal(ctrl.temp[22], null);
    assert.equal(ctrl.temp[23], 10);
    assert.equal(ctrl.temp[29], 20);
  });
});
