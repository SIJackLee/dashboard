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
  DEFAULT_UNIFIED_LAYERS,
  mapUnifiedBarnTrendRawToSplitY,
  pickUnifiedTrendLayers,
  resolveSplitYLayout,
  SPLIT_Y_BAND_GAP,
  UNIFIED_CHART_LABELS,
  paddedExtentDomain,
  fitTempDisplayDomain,
  mapTempCToSplitY,
  tempDisplayDomainFromRaw,
} from "./unified-barn-trend-series";
import { emptyChannelThermo } from "./channel-thermo";

function sampleCtrl(
  temp: number[],
  hum: number[],
  opts?: { key?: string; zone?: string; equipment?: string; stallNo?: string },
): TrendControllerSeries {
  return {
    stallNo: opts?.stallNo ?? "1",
    controllerKey: opts?.key ?? "c1",
    eqpmnNo: "1",
    // 모터 표시 정본 = 채널 슬롯 A/B/C.
    fanA: temp.map(() => 40),
    fanB: temp.map(() => 30),
    fanC: temp.map(() => 20),
    // role(EC) 컬럼 — 하위호환용(모터 그래프는 슬롯을 쓴다).
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
  showCommand: true,
});
const layoutTempOnly = resolveSplitYLayout({
  showTemp: true,
  showHum: false,
  showMotors: false,
  showCommand: true,
});

{
  /** 밴드 사이 갭 — 상·하한 라벨 분리 */
  assert.ok(
    layoutFull.humLo - layoutFull.motorHi >= SPLIT_Y_BAND_GAP - 1e-6,
    "motor↔hum gap",
  );
  assert.ok(
    layoutFull.tempLo - layoutFull.humHi >= SPLIT_Y_BAND_GAP - 1e-6,
    "hum↔temp gap",
  );
  assert.equal(layoutTempOnly.tempLo, 0);
  assert.equal(layoutTempOnly.tempHi, 100);
}
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
    fill: "var(--channel-temp)",
  });
  assert.ok(env?.polys?.length);
  assert.ok((env!.polys?.length ?? 0) >= 2);
  for (const run of env!.polys ?? []) {
    assert.ok(run.length >= 2);
  }
}

{
  /** 습도·모터 시계열이 없어도 밴드·가이드용 available 은 연다 */
  const emptyEnv = [
    {
      stallNo: "1",
      controllerKey: "c-empty",
      eqpmnNo: "1",
      fanA: [null, null, null, null],
      fanB: [null, null, null, null],
      fanC: [null, null, null, null],
      fanIntake: [null, null, null, null],
      fanExhaust: [null, null, null, null],
      fanSupply: [null, null, null, null],
      temp: [31, 31.2, 31.4, 31.1],
      humidity: [null, null, null, null],
      sampleCount: [1, 1, 1, 1],
    } satisfies TrendControllerSeries,
  ];
  const builtEmpty = buildUnifiedBarnTrendSeries(
    emptyEnv,
    categories,
    thresholds,
    { layout: layoutFull },
  );
  assert.ok(builtEmpty);
  assert.equal(builtEmpty!.available.hum, true);
  assert.equal(builtEmpty!.available.motors, true);
  assert.equal(builtEmpty!.available.temp, true);
  assert.equal(builtEmpty!.histogramMotorsMax.length, 0);
  assert.equal(builtEmpty!.seriesByKey.hum, undefined);
}

{
  const thermo = sampleCtrl([22, 23, 24, 25], [55, 56, 57, 58], { key: "c-th" });
  const a = emptyChannelThermo(4);
  const b = emptyChannelThermo(4);
  const c = emptyChannelThermo(4);
  for (let i = 0; i < 4; i++) {
    a.setpoint[i] = i >= 2 ? 25 : 24;
    a.deviation[i] = 5;
    a.minVent[i] = i >= 2 ? 20 : 10;
    a.maxVent[i] = 90;
    b.setpoint[i] = 2;
    b.deviation[i] = 4;
    b.minVent[i] = 20;
    b.maxVent[i] = 80;
    c.setpoint[i] = 3;
    c.deviation[i] = 3;
    c.minVent[i] = 30;
    c.maxVent[i] = 70;
  }
  thermo.thermoA = a;
  thermo.thermoB = b;
  thermo.thermoC = c;
  const raw = aggregateUnifiedBarnTrendRaw([thermo], categories, thresholds, {
    includeThermo: true,
  });
  assert.ok(raw?.thermoWindows);
  assert.equal(raw!.thermoWindows!.a.loC[0], 24);
  assert.equal(raw!.thermoWindows!.a.hiC[0], 29);
  assert.equal(raw!.thermoWindows!.b.loC[0], 26);
  assert.equal(raw!.thermoWindows!.c.loC[0], 27);
  const mapped = mapUnifiedBarnTrendRawToSplitY(raw!, layoutFull);
  assert.ok(mapped);
  assert.ok(mapped.tempDomain[1] < 29, "설정 구간은 온도 Y 도메인에 넣지 않음");
  assert.equal(mapped!.available.thermo, true);
  assert.equal(mapped!.available.thermoMotor, true);
  assert.ok(mapped!.seriesThermoTempChange);
  assert.ok(mapped!.seriesThermoMotorChange);
  assert.equal(mapped!.seriesThermoTempChange!.name, UNIFIED_CHART_LABELS.thermoTempChange);
  assert.equal(mapped!.seriesThermoTempChange!.data[0], null);
  assert.equal(mapped!.seriesThermoTempChange!.data[1], null);
  assert.ok(mapped!.seriesThermoTempChange!.data[2] != null);
  assert.equal(mapped!.seriesThermoTempChange!.markerLabels?.[2], "A");
  const rangeAt2 = mapped!.seriesThermoTempChange!.commandRangePreview?.[2];
  assert.ok(rangeAt2);
  assert.equal(rangeAt2!.channels.length, 3);
  const [tLo, tHi] = mapped.tempDomain;
  const tempLabel = (ch: "A" | "B" | "C", v: number) =>
    v >= tLo && v <= tHi ? `${ch} ${v.toFixed(1)}℃` : null;
  assert.equal(rangeAt2!.channels[0]?.tempLoText, tempLabel("A", 25));
  assert.equal(rangeAt2!.channels[0]?.tempHiText, tempLabel("A", 30));
  assert.equal(rangeAt2!.channels[1]?.tempLoText, tempLabel("B", 27));
  assert.equal(rangeAt2!.channels[1]?.tempHiText, tempLabel("B", 31));
  assert.equal(rangeAt2!.channels[2]?.tempLoText, tempLabel("C", 28));
  assert.equal(rangeAt2!.channels[2]?.tempHiText, tempLabel("C", 31));
  assert.equal(rangeAt2!.channels[0]?.motorLoText, "A 20%");
  assert.equal(rangeAt2!.channels[0]?.motorHiText, "A 90%");
  assert.equal(rangeAt2!.channels[1]?.motorLoText, "B 20%");
  assert.equal(rangeAt2!.channels[1]?.motorHiText, "B 80%");
  assert.equal(rangeAt2!.channels[2]?.motorLoText, "C 30%");
  assert.equal(rangeAt2!.channels[2]?.motorHiText, "C 70%");
  assert.match(
    mapped!.seriesThermoTempChange!.hoverNote?.[2] ?? "",
    /채널 A .*24\.0℃.*25\.0℃/,
  );
  const picked = pickUnifiedTrendLayers(mapped!, DEFAULT_UNIFIED_LAYERS);
  assert.equal(
    picked.series.filter((s) => s.name === UNIFIED_CHART_LABELS.thermoTempChange)
      .length,
    1,
  );
  assert.equal(
    picked.series.filter((s) => s.name === UNIFIED_CHART_LABELS.thermoMotorChange)
      .length,
    1,
  );
  const tempOff = pickUnifiedTrendLayers(mapped!, {
    ...DEFAULT_UNIFIED_LAYERS,
    temp: false,
    band: false,
    thermo: true,
    thermoMotor: false,
  });
  assert.equal(
    tempOff.series.filter((s) => s.name === UNIFIED_CHART_LABELS.thermoTempChange)
      .length,
    1,
  );
  assert.equal(
    tempOff.series.filter((s) => s.name === UNIFIED_CHART_LABELS.thermoMotorChange)
      .length,
    0,
  );
  const motorSettingOnly = pickUnifiedTrendLayers(mapped!, {
    ...DEFAULT_UNIFIED_LAYERS,
    motors: false,
    thermo: false,
    thermoMotor: true,
  });
  assert.equal(
    motorSettingOnly.series.filter(
      (s) => s.name === UNIFIED_CHART_LABELS.thermoTempChange,
    ).length,
    0,
  );
  assert.equal(
    motorSettingOnly.series.filter(
      (s) => s.name === UNIFIED_CHART_LABELS.thermoMotorChange,
    ).length,
    1,
  );

  const skipped = aggregateUnifiedBarnTrendRaw(list, categories, thresholds, {
    includeThermo: true,
  });
  assert.equal(skipped!.thermoWindows, null);
}

{
  assert.deepEqual(paddedExtentDomain(24, 27), [23.4, 27.6]);
  assert.deepEqual(fitTempDisplayDomain([[24], [27]], [10, 35]), [23.4, 27.6]);
  assert.deepEqual(
    tempDisplayDomainFromRaw({
      tempAvg: [22, 25],
      tempMin: [22, 25],
      tempMax: [22, 25],
      emaShortRaw: [22, 25],
      emaLongRaw: [22, 25],
      tempLow: 24,
      tempHigh: 27,
    }),
    paddedExtentDomain(22, 25),
  );
  const raw = aggregateUnifiedBarnTrendRaw(list, categories, {
    ...thresholds,
    tempLow: 24,
    tempHigh: 27,
  });
  assert.ok(raw);
  const mapped = mapUnifiedBarnTrendRawToSplitY(raw!, layoutFull);
  assert.ok(mapped);
  const temps = mapped.seriesByKey.temp?.data ?? [];
  const finite = temps.filter((v): v is number => v != null && Number.isFinite(v));
  assert.ok(finite.length > 0);
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  assert.ok(lo > layoutFull.tempLo, "표시 최저는 밴드 바닥에 붙지 않음");
  assert.ok(hi < layoutFull.tempHi, "표시 최고는 밴드 천장에 붙지 않음");
  const alarmClamped = mapTempCToSplitY(28, 24, 27, layoutFull);
  assert.equal(alarmClamped, layoutFull.tempHi);
  const fittedPeak = mapTempCToSplitY(
    28,
    24,
    27,
    layoutFull,
    paddedExtentDomain(21, 28),
  );
  assert.ok(
    fittedPeak != null && fittedPeak < layoutFull.tempHi,
    "표시 최댓값+여유면 최고점도 밴드 안에 남음",
  );
}

console.log("unified-barn-trend-series-m1.test.ts: ok");
