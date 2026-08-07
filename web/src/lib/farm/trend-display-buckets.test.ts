import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  abbreviateTrendAxisLabel,
  formatTrendScopeRangeLabel,
  parseTrendAxisMdLabel,
} from "./trend-display-buckets";

describe("parseTrendAxisMdLabel", () => {
  it("parses M/D and M/D HH", () => {
    assert.deepEqual(parseTrendAxisMdLabel("7/1"), { month: 7, day: 1 });
    assert.deepEqual(parseTrendAxisMdLabel("12/31 14"), {
      month: 12,
      day: 31,
    });
  });
});

describe("abbreviateTrendAxisLabel", () => {
  it("24h: endpoint full, middle hour", () => {
    assert.equal(
      abbreviateTrendAxisLabel("24h", "09:30", { endpoint: true }),
      "09:30",
    );
    assert.equal(
      abbreviateTrendAxisLabel("24h", "09:30", { endpoint: false }),
      "09",
    );
  });

  it("30d: month boundary → N월, else day", () => {
    assert.equal(
      abbreviateTrendAxisLabel("30d", "7/1", {
        endpoint: false,
        prevLabel: "6/28",
      }),
      "7월",
    );
    assert.equal(
      abbreviateTrendAxisLabel("30d", "7/15", {
        endpoint: false,
        prevLabel: "7/8",
      }),
      "15",
    );
  });

  it("30d: first tick mid-month keeps M/D", () => {
    assert.equal(
      abbreviateTrendAxisLabel("30d", "7/15", {
        endpoint: true,
        prevLabel: null,
      }),
      "7/15",
    );
  });

  it("30d: first tick on day 1 → N월", () => {
    assert.equal(
      abbreviateTrendAxisLabel("30d", "8/1", {
        endpoint: true,
        prevLabel: null,
      }),
      "8월",
    );
  });

  it("7d: same month/day policy (hours dropped on tick)", () => {
    assert.equal(
      abbreviateTrendAxisLabel("7d", "7/1 00", {
        endpoint: false,
        prevLabel: "6/30 18",
      }),
      "7월",
    );
    assert.equal(
      abbreviateTrendAxisLabel("7d", "7/3 12", {
        endpoint: true,
        prevLabel: "7/1 00",
      }),
      "3",
    );
  });
});

describe("formatTrendScopeRangeLabel", () => {
  it("same month omits end month", () => {
    assert.equal(formatTrendScopeRangeLabel("8/3", "8/5"), "8/3 ~ 5");
    assert.equal(formatTrendScopeRangeLabel("8/3 14", "8/5 09"), "8/3 14 ~ 5 09");
  });

  it("different month keeps both", () => {
    assert.equal(formatTrendScopeRangeLabel("7/28", "8/2"), "7/28 ~ 8/2");
  });

  it("24h keeps times", () => {
    assert.equal(formatTrendScopeRangeLabel("09:00", "15:30"), "09:00 ~ 15:30");
  });
});
