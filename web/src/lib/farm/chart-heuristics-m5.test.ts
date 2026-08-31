/**
 * M5 — 차트 핵심 휴리스틱 단위 테스트
 * 실행: npx tsx src/lib/farm/chart-heuristics-m5.test.ts
 */
import assert from "node:assert/strict";
import { DEFAULT_ALARM_THRESHOLDS } from "@/lib/data/alarms";
import type { TrendEnvelope, TrendHistogram, TrendSeries } from "@/lib/data/trend-chart-types";
import {
  dimensionComfortScore,
  envComfortScore,
} from "./env-comfort-score";
import {
  resolveSplitYLayout,
  resolveYScopeBands,
  sliceUnifiedTrendByIndex,
  visibilityForYBands,
  maskLayersForYBands,
  DEFAULT_UNIFIED_LAYERS,
  ALL_UNIFIED_LAYERS,
  resolveUnifiedPlotLayout,
  mapTempCToSplitY,
  paddedAlarmDomain,
  unifiedYBandFocusLabel,
  isSingleYBandFocus,
} from "./unified-barn-trend-series";

const ALL_VIS = {
  showTemp: true,
  showHum: true,
  showMotors: true,
} as const;
const layoutAll = resolveSplitYLayout(ALL_VIS);

/* —— resolveYScopeBands (C안) —— */
{
  const singleLayout = resolveSplitYLayout({
    showTemp: true,
    showHum: false,
    showMotors: false,
  });
  assert.equal(
    resolveYScopeBands(60, 90, singleLayout, {
      showTemp: true,
      showHum: false,
      showMotors: false,
    }),
    null,
    "밴드 1개 → Y필터 없음(null)",
  );
}

{
  assert.deepEqual(
    resolveYScopeBands(60, 90, layoutAll, ALL_VIS),
    ["temp"],
    "온도 밴드 중앙 드래그 → [temp]",
  );
  assert.deepEqual(
    resolveYScopeBands(25, 45, layoutAll, ALL_VIS),
    ["hum"],
    "습도 밴드 중앙 드래그 → [hum]",
  );
}

{
  assert.deepEqual(
    resolveYScopeBands(30, 80, layoutAll, ALL_VIS),
    ["hum", "temp"],
    "습+온 걸침 → 걸린 밴드만",
  );
  assert.deepEqual(
    resolveYScopeBands(5, 95, layoutAll, ALL_VIS),
    ["motor", "hum", "temp"],
    "세 밴드 걸침 → 전부",
  );
}

{
  assert.equal(
    resolveYScopeBands(50, 55, layoutAll, ALL_VIS),
    null,
    "습·온 사이 갭 → null(레이어 유지)",
  );
  assert.equal(
    resolveYScopeBands(20, 22, layoutAll, ALL_VIS),
    null,
    "모터·습 사이 갭 → null",
  );
}

{
  const vis = visibilityForYBands(["hum", "temp"]);
  assert.deepEqual(vis, {
    showMotors: false,
    showHum: true,
    showTemp: true,
  });
  const masked = maskLayersForYBands(DEFAULT_UNIFIED_LAYERS, ["temp"]);
  assert.equal(masked.temp, true);
  assert.equal(masked.ema, false);
  assert.equal(masked.band, true);
  assert.equal(masked.hum, false);
  assert.equal(masked.motors, false);
  assert.equal(masked.motorCh, false);

  const maskedAll = maskLayersForYBands(ALL_UNIFIED_LAYERS, ["temp"]);
  assert.equal(maskedAll.temp, true);
  assert.equal(maskedAll.ema, true);
  assert.equal(maskedAll.hum, false);
  assert.equal(maskedAll.motors, false);
}

/* —— env comfort (mid / edge / over) —— */
{
  // tempLow=10, tempHigh=35 → mid=22.5, half=12.5
  assert.equal(dimensionComfortScore(22.5, 10, 35), 100, "중심=100");
  assert.equal(dimensionComfortScore(10, 10, 35), 60, "하한 경계≈60");
  assert.equal(dimensionComfortScore(35, 10, 35), 60, "상한 경계≈60");
  assert.equal(
    dimensionComfortScore(22.5 - 2 * 12.5, 10, 35),
    0,
    "half 추가 이탈=0",
  );
  assert.equal(
    dimensionComfortScore(22.5 + 2 * 12.5, 10, 35),
    0,
    "상방 이탈=0",
  );
  const midOver = dimensionComfortScore(22.5 - 12.5 * 1.5, 10, 35);
  assert.ok(midOver != null && midOver > 0 && midOver < 60, "이탈 중간은 0~60");
}

{
  const mid = envComfortScore(22.5, 60, DEFAULT_ALARM_THRESHOLDS);
  assert.equal(mid, 100, "온·습 모두 중심 → 100");

  const edge = envComfortScore(10, 30, DEFAULT_ALARM_THRESHOLDS);
  assert.equal(edge, 60, "온·습 경계 → 60");

  const tempOnly = envComfortScore(22.5, null, DEFAULT_ALARM_THRESHOLDS);
  assert.equal(tempOnly, 100, "온도만 있으면 그 점수");

  assert.equal(
    envComfortScore(null, null, DEFAULT_ALARM_THRESHOLDS),
    null,
    "둘 다 없으면 null",
  );

  assert.equal(dimensionComfortScore(NaN, 10, 35), null);
  assert.equal(dimensionComfortScore(20, 35, 10), null, "high<=low → null");
}

/* —— sliceUnifiedTrendByIndex —— */
{
  const categories = ["t0", "t1", "t2", "t3", "t4"];
  const series: TrendSeries[] = [
    {
      name: "온도",
      data: [10, 20, 30, 40, 50],
      color: "#f00",
      axis: "left",
      hoverSecondary: [1, 2, 3, 4, 5],
    },
  ];
  const envelopes: TrendEnvelope[] = [
    {
      high: [11, 21, 31, 41, 51],
      low: [9, 19, 29, 39, 49],
      axis: "left",
      fill: "#ccc",
    },
  ];
  const histograms: TrendHistogram[] = [
    {
      values: [0, 1, 2, 3, 4],
      baseline: 0,
      colorUp: "#0f0",
      colorDown: "#0a0",
      style: "volume",
      hoverSecondary: [10, 11, 12, 13, 14],
      fillOpacityValues: [0.1, 0.2, 0.3, 0.4, 0.5],
      hoverChannels: [
        { label: "A", color: "#111", values: [100, 101, 102, 103, 104] },
      ],
    },
  ];

  const sliced = sliceUnifiedTrendByIndex(
    categories,
    { series, envelopes, histograms },
    1,
    3,
  );
  assert.deepEqual(sliced.categories, ["t1", "t2", "t3"]);
  assert.deepEqual(sliced.series[0]!.data, [20, 30, 40]);
  assert.deepEqual(sliced.series[0]!.hoverSecondary, [2, 3, 4]);
  assert.deepEqual(sliced.envelopes[0]!.high, [21, 31, 41]);
  assert.deepEqual(sliced.envelopes[0]!.low, [19, 29, 39]);
  assert.deepEqual(sliced.histograms[0]!.values, [1, 2, 3]);
  assert.deepEqual(sliced.histograms[0]!.hoverSecondary, [11, 12, 13]);
  assert.deepEqual(sliced.histograms[0]!.fillOpacityValues, [0.2, 0.3, 0.4]);
  assert.deepEqual(sliced.histograms[0]!.hoverChannels![0]!.values, [
    101, 102, 103,
  ]);
}

{
  const categories = ["a", "b", "c"];
  const picked = {
    series: [
      {
        name: "x",
        data: [1, 2, 3],
        color: "#000",
        axis: "left" as const,
      },
    ],
    envelopes: [] as TrendEnvelope[],
    histograms: [] as TrendHistogram[],
  };
  const full = sliceUnifiedTrendByIndex(categories, picked, 0, 2);
  assert.equal(full.categories, categories, "전체 구간이면 참조 유지");
  assert.equal(full.series, picked.series);

  const swapped = sliceUnifiedTrendByIndex(categories, picked, 2, 0);
  assert.deepEqual(swapped.categories, ["a", "b", "c"]);
  assert.deepEqual(swapped.series[0]!.data, [1, 2, 3]);
}

/* —— C2 native Y layout —— */
{
  const th = DEFAULT_ALARM_THRESHOLDS;
  const tempOnly = resolveUnifiedPlotLayout(
    { showTemp: true, showHum: false, showMotors: false },
    th,
  );
  assert.equal(tempOnly.leftUnit, "℃");
  assert.equal(tempOnly.nativeBand, "temp");
  const [vlo, vhi] = paddedAlarmDomain(th.tempLow, th.tempHigh);
  assert.deepEqual(tempOnly.layout.domain, [vlo, vhi]);
  const mapped = mapTempCToSplitY(24, th.tempLow, th.tempHigh, tempOnly.layout);
  assert.ok(mapped != null && Math.abs(mapped - 24) < 1e-6, "native temp identity");

  const multi = resolveUnifiedPlotLayout(
    { showTemp: true, showHum: true, showMotors: true },
    th,
  );
  assert.equal(multi.leftUnit, "");
  assert.equal(multi.nativeBand, null);
  assert.deepEqual(multi.layout.domain, [0, 100]);
}

/* —— E focus labels —— */
{
  assert.equal(unifiedYBandFocusLabel("temp"), "온도 집중");
  assert.equal(unifiedYBandFocusLabel("hum"), "습도 집중");
  assert.equal(unifiedYBandFocusLabel("motor"), "모터 집중");
  assert.equal(isSingleYBandFocus(["temp"]), true);
  assert.equal(isSingleYBandFocus(["temp", "hum"]), false);
  assert.equal(isSingleYBandFocus(null), false);
}

console.log("chart-heuristics-m5.test.ts: ok");
