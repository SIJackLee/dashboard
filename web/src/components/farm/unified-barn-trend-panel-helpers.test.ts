/**
 * 실행: npx tsx src/components/farm/unified-barn-trend-panel-helpers.test.ts
 */
import assert from "node:assert/strict";
import {
  alignBrushScoreSeries,
  farmAlarmMidValue,
  pickSharedBrushOverviewKind,
  SCALE_EDGE_ALARM_KEY,
} from "./unified-barn-trend-panel-helpers";

{
  assert.equal(pickSharedBrushOverviewKind(true, false), "top");
  assert.equal(pickSharedBrushOverviewKind(false, true), "bottom");
  assert.equal(pickSharedBrushOverviewKind(true, true), "dual");
  assert.equal(pickSharedBrushOverviewKind(false, false), "farm");
}

{
  const aligned = alignBrushScoreSeries([80, 60], [90, 40, 10]);
  assert.equal(aligned.top.length, 3);
  assert.equal(aligned.bottom.length, 3);
  assert.equal(aligned.top[0], 80);
  assert.equal(aligned.top[2], null);
  assert.equal(aligned.bottom[2], 10);
}

{
  assert.equal(SCALE_EDGE_ALARM_KEY["temp-hi"], "tempHigh");
  assert.equal(SCALE_EDGE_ALARM_KEY["temp-farm-hi"], "tempHigh");
  assert.equal(SCALE_EDGE_ALARM_KEY["hum-farm-lo"], "humidityLow");
  assert.equal(SCALE_EDGE_ALARM_KEY["temp-farm-hi"], SCALE_EDGE_ALARM_KEY["temp-hi"]);
}

{
  assert.equal(farmAlarmMidValue(23, 27), 25);
  assert.equal(farmAlarmMidValue(55, 65), 60);
  assert.equal(farmAlarmMidValue(Number.NaN, 27), null);
}

console.log("unified-barn-trend-panel-helpers.test.ts: ok");
