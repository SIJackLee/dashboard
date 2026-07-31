/**
 * 실행: npx tsx src/lib/farm/unified-barn-trend-series-m1.test.ts
 *
 * M1 — 집계는 layout 무관 1회, 매핑만 layout에 의존.
 */
import assert from "node:assert/strict";
import type { TrendControllerSeries } from "@/lib/data/farm-trend-types";
import { DEFAULT_ALARM_THRESHOLDS } from "@/lib/data/alarms";
import {
  aggregateUnifiedBarnTrendRaw,
  buildThresholdBreachCorridor,
  buildUnifiedBarnTrendSeries,
  mapUnifiedBarnTrendRawToSplitY,
  resolveSplitYLayout,
} from "./unified-barn-trend-series";

function sampleCtrl(
  temp: number[],
  hum: number[],
  opts?: { key?: string; zone?: string; equipment?: string; stallNo?: string },
): TrendControllerSeries {
  return {
    stallNo: opts?.stallNo ?? "1",
    controllerKey: opts?.key ?? "c1",
    eqpmnNo: "1",
    fanIntake: temp.map(() => 40),
    fanExhaust: temp.map(() => 30),
    fanSupply: temp.map(() => 20),
    temp,
    humidity: hum,
    sampleCount: temp.map(() => 1),
    zoneLabel: opts?.zone,
    equipmentLabel: opts?.equipment,
  };
}

const categories = ["a", "b", "c", "d"];
const list = [
  sampleCtrl([22, 23, 24, 25], [55, 56, 57, 58], {
    key: "c1",
    zone: "임신사",
    equipment: "01번 축사 01",
    stallNo: "1",
  }),
  sampleCtrl([21, 22, 23, 24], [50, 51, 52, 53], {
    key: "c2",
    zone: "자돈사",
    equipment: "01번 축사 02",
    stallNo: "2",
  }),
];
const thresholds = DEFAULT_ALARM_THRESHOLDS;
const layoutFull = resolveSplitYLayout({
  showTemp: true,
  showHum: true,
  showMotors: true,
});
const layoutTempOnly = resolveSplitYLayout({
  showTemp: true,
  showHum: false,
  showMotors: false,
});

{
  const raw = aggregateUnifiedBarnTrendRaw(list, categories, thresholds);
  assert.ok(raw, "raw aggregate");
  assert.equal(raw!.tempAvg.length, 4);
  assert.ok(raw!.tempAvg.every((v) => v != null));
  assert.equal(raw!.tempSpreadExtremes.high[0]?.zoneLabel, "임신사");
  assert.equal(raw!.tempSpreadExtremes.low[0]?.zoneLabel, "자돈사");
  assert.equal(raw!.tempSpreadExtremes.high[0]?.equipmentLabel, "01번 축사 01");

  const mapped = mapUnifiedBarnTrendRawToSplitY(raw!, layoutFull);
  const built = buildUnifiedBarnTrendSeries(list, categories, thresholds, {
    layout: layoutFull,
  });
  assert.ok(mapped && built);
  assert.deepEqual(mapped!.seriesByKey.temp?.data, built!.seriesByKey.temp?.data);
  assert.deepEqual(
    mapped!.histogramMotorsMax[0]?.values,
    built!.histogramMotorsMax[0]?.values,
  );
  assert.equal(
    mapped!.seriesByKey.temp?.hoverSpreadExtremes?.high[0]?.zoneLabel,
    "임신사",
  );
}

{
  const raw = aggregateUnifiedBarnTrendRaw(list, categories, thresholds);
  assert.ok(raw);
  const a = mapUnifiedBarnTrendRawToSplitY(raw!, layoutFull);
  const b = mapUnifiedBarnTrendRawToSplitY(raw!, layoutTempOnly);
  assert.ok(a && b);
  /** 동일 raw, layout만 바뀌면 temp Y 좌표가 달라짐 */
  assert.notDeepEqual(
    a!.seriesByKey.temp?.data,
    b!.seriesByKey.temp?.data,
  );
  /** 원단위 hover는 layout 무관 */
  assert.deepEqual(
    a!.seriesByKey.temp?.hoverSecondary,
    b!.seriesByKey.temp?.hoverSecondary,
  );
}

{
  /** 상한 초과 시 breached */
  const hot = [
    sampleCtrl([40, 40, 40, 40], [60, 60, 60, 60], {
      key: "hot",
      zone: "분민사",
      equipment: "02번 축사 01",
    }),
    sampleCtrl([22, 22, 22, 22], [55, 55, 55, 55], {
      key: "ok",
      zone: "임신사",
      equipment: "01번 축사 01",
    }),
  ];
  const raw = aggregateUnifiedBarnTrendRaw(hot, categories, thresholds);
  assert.ok(raw);
  assert.equal(raw!.tempSpreadExtremes.high[0]?.breached, true);
  assert.equal(raw!.tempSpreadExtremes.high[0]?.zoneLabel, "분민사");
  assert.equal(raw!.tempSpreadExtremes.low[0]?.breached, false);
}

{
  /** 샘플 사이 교차 + 단일 피크도 코리도 면 생성 */
  const env = buildThresholdBreachCorridor({
    seriesPlot: [10, 40, 10, 50, 10],
    seriesRaw: [20, 40, 20, 36, 20],
    thresholdRaw: 35,
    thresholdPlot: 35,
    side: "high",
    fill: "#ef4444",
  });
  assert.ok(env?.polys?.length);
  assert.ok((env!.polys?.length ?? 0) >= 2);
  for (const run of env!.polys ?? []) {
    assert.ok(run.length >= 2);
  }
}

console.log("unified-barn-trend-series-m1.test.ts: ok");
