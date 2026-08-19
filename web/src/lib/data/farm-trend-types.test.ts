import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  controllerTrendPeriodHasSeries,
  emptyTrendControllerPeriodData,
  pickTrendCanvasPeriod,
  type TrendControllerPeriodData,
} from "./farm-trend-types";

function axisOnly(
  period: TrendControllerPeriodData["period"],
  bucketCount: number,
): TrendControllerPeriodData {
  return {
    period,
    categories: Array.from({ length: bucketCount }, (_, i) => String(i)),
    bucketAts: [],
    sp: [],
    totalSamples: 0,
  };
}

function withSamples(
  period: TrendControllerPeriodData["period"],
  bucketCount: number,
): TrendControllerPeriodData {
  return {
    period,
    categories: Array.from({ length: bucketCount }, (_, i) => String(i)),
    bucketAts: [],
    totalSamples: 12,
    sp: [
      {
        stallTyCode: "SP01",
        label: "임신사",
        stalls: [
          {
            stallNo: "1",
            controllers: [
              {
                stallNo: "1",
                controllerKey: "k1",
                eqpmnNo: "01",
                temp: [],
                humidity: [],
                fanSupply: [],
                fanExhaust: [],
                fanIntake: [],
                sampleCount: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("controllerTrendPeriodHasSeries", () => {
  it("treats a full empty axis as having no series", () => {
    assert.equal(controllerTrendPeriodHasSeries(axisOnly("30d", 2880)), false);
    assert.equal(
      controllerTrendPeriodHasSeries(emptyTrendControllerPeriodData("30d")),
      false,
    );
  });

  it("accepts totalSamples even without sp rows", () => {
    assert.equal(
      controllerTrendPeriodHasSeries({
        ...axisOnly("24h", 96),
        totalSamples: 1,
      }),
      true,
    );
  });
});

describe("pickTrendCanvasPeriod", () => {
  it("does not prefer an empty 30d axis over 24h with samples", () => {
    const bundle = {
      "24h": withSamples("24h", 96),
      "7d": emptyTrendControllerPeriodData("7d"),
      "30d": axisOnly("30d", 2880),
    };
    assert.equal(pickTrendCanvasPeriod(bundle, "7d"), "24h");
  });

  it("uses 30d when it has series", () => {
    const bundle = {
      "24h": withSamples("24h", 96),
      "7d": emptyTrendControllerPeriodData("7d"),
      "30d": withSamples("30d", 2880),
    };
    assert.equal(pickTrendCanvasPeriod(bundle, "7d"), "30d");
  });

  it("falls through to the selected period when nothing has series", () => {
    const bundle = {
      "24h": axisOnly("24h", 96),
      "7d": emptyTrendControllerPeriodData("7d"),
      "30d": axisOnly("30d", 2880),
    };
    assert.equal(pickTrendCanvasPeriod(bundle, "7d"), "7d");
  });
});
