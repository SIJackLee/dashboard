/**
 * 실행: npx tsx src/lib/farm/farm-chart-scope-url.test.ts
 */
import assert from "node:assert/strict";
import {
  applyFarmChartScopeParams,
  applyFarmChartZoomParams,
  chartScopeEntryToZoomHint,
  clampChartScopeToType,
  clearFarmChartScopeParams,
  clearFarmChartZoomParams,
  filterFarmChartTreeByType,
  resolveFarmChartScope,
  resolveFarmChartZoomHint,
  scopesEqual,
  type FarmChartScope,
} from "./farm-chart-scope";
import {
  applyListViewParams,
  buildFarmMonitoringHomeParams,
  isFarmMonitoringSoftHome,
} from "./farm-view-url";

{
  const params = new URLSearchParams();
  applyFarmChartScopeParams(params, {
    level: "controller",
    stallTyCode: "SP03",
    stallNo: "1",
    controllerKey: "a/b",
  });
  assert.equal(params.get("chartSp"), "SP03");
  assert.equal(params.get("chartStall"), "1");
  assert.equal(params.get("chartCtrl"), encodeURIComponent("a/b"));
  const scope = resolveFarmChartScope(params);
  assert.ok(
    scopesEqual(scope, {
      level: "controller",
      stallTyCode: "SP03",
      stallNo: "1",
      controllerKey: "a/b",
    }),
  );
}

{
  const params = new URLSearchParams("chartSp=SP02");
  assert.ok(
    scopesEqual(resolveFarmChartScope(params), {
      level: "sp",
      stallTyCode: "SP02",
    }),
  );
}

{
  const params = new URLSearchParams("chartSp=SP02&chartStall=3");
  assert.ok(
    scopesEqual(resolveFarmChartScope(params), {
      level: "stall",
      stallTyCode: "SP02",
      stallNo: "3",
    }),
  );
}

{
  const farm: FarmChartScope = { level: "farm" };
  const params = new URLSearchParams("chartSp=SP01&chartStall=1&chartCtrl=x");
  applyFarmChartScopeParams(params, farm);
  assert.equal(params.get("chartSp"), null);
  assert.equal(resolveFarmChartScope(params).level, "farm");
}

{
  const source = new URLSearchParams(
    "lsind=FARM01&item=P00&view=chart&chartSp=SP03&trendPeriod=7d",
  );
  const home = buildFarmMonitoringHomeParams(source);
  assert.equal(home.get("chartSp"), null);
  assert.equal(isFarmMonitoringSoftHome(source), false);
  assert.equal(isFarmMonitoringSoftHome(home), true);
}

{
  const params = new URLSearchParams(
    "view=chart&chartSp=SP03&chartStall=1&listMode=graph",
  );
  applyListViewParams(params);
  assert.equal(params.get("view"), "list");
  assert.equal(params.get("chartSp"), null);
  clearFarmChartScopeParams(params);
}

/** P2 — Y밴드·X구간 줌 */
{
  const params = new URLSearchParams();
  applyFarmChartZoomParams(params, {
    yBands: ["temp"],
    startRatio: 0,
    endRatio: 1,
  });
  assert.equal(params.get("chartYBand"), "temp");
  assert.equal(params.get("chartX0"), null);
  assert.equal(params.get("chartX1"), null);
  const zoom = resolveFarmChartZoomHint(params);
  assert.ok(zoom);
  assert.deepEqual(zoom!.yBands, ["temp"]);
  assert.equal(zoom!.startRatio, 0);
  assert.equal(zoom!.endRatio, 1);
}

{
  const params = new URLSearchParams();
  applyFarmChartZoomParams(params, {
    yBands: ["temp", "hum"],
    startRatio: 0.2,
    endRatio: 0.65,
  });
  assert.equal(params.get("chartYBand"), "temp+hum");
  assert.equal(params.get("chartX0"), "0.200");
  assert.equal(params.get("chartX1"), "0.650");
  const zoom = resolveFarmChartZoomHint(params);
  assert.ok(zoom);
  assert.deepEqual(zoom!.yBands, ["temp", "hum"]);
  assert.ok(Math.abs(zoom!.startRatio - 0.2) < 0.001);
  assert.ok(Math.abs(zoom!.endRatio - 0.65) < 0.001);
}

{
  const params = new URLSearchParams(
    "view=chart&chartYBand=temp&chartX0=0.1&chartX1=0.4",
  );
  assert.equal(isFarmMonitoringSoftHome(params), false);
  applyListViewParams(params);
  assert.equal(params.get("chartYBand"), null);
  clearFarmChartZoomParams(params);
  assert.equal(params.get("chartX0"), null);
}

{
  const hint = chartScopeEntryToZoomHint(
    { start: 0, end: 99, yBands: ["hum"] },
    100,
  );
  assert.ok(hint);
  assert.deepEqual(hint!.yBands, ["hum"]);
  assert.equal(hint!.startRatio, 0);
  assert.equal(hint!.endRatio, 1);
  assert.equal(hint!.startIndex, 0);
  assert.equal(hint!.endIndex, 99);

  const params = new URLSearchParams();
  applyFarmChartZoomParams(params, hint);
  assert.equal(params.get("chartYBand"), "hum");
  assert.equal(params.get("chartX0"), null);

  assert.equal(
    chartScopeEntryToZoomHint({ start: 0, end: 10, yBands: null }, 100),
    null,
  );
}

{
  assert.deepEqual(
    clampChartScopeToType({ level: "farm" }, "SP02"),
    { level: "sp", stallTyCode: "SP02" },
  );
  assert.deepEqual(
    clampChartScopeToType(
      { level: "sp", stallTyCode: "SP03" },
      "SP02",
    ),
    { level: "sp", stallTyCode: "SP02" },
  );
  assert.deepEqual(
    clampChartScopeToType(
      { level: "stall", stallTyCode: "SP02", stallNo: "01" },
      "SP02",
    ),
    { level: "stall", stallTyCode: "SP02", stallNo: "01" },
  );
  const tree = filterFarmChartTreeByType(
    [
      { stallTyCode: "SP02", label: "분만사", stalls: [], controllerCount: 1 },
      { stallTyCode: "SP03", label: "자돈사", stalls: [], controllerCount: 1 },
    ],
    "SP02",
  );
  assert.equal(tree.length, 1);
  assert.equal(tree[0]?.stallTyCode, "SP02");
}

console.log("farm-chart-scope-url.test.ts: ok");
