/**
 * 실행: npx tsx src/lib/farm/farm-chart-scope-url.test.ts
 */
import assert from "node:assert/strict";
import {
  applyFarmChartScopeParams,
  applyFarmChartZoomParams,
  clearFarmChartScopeParams,
  clearFarmChartZoomParams,
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

console.log("farm-chart-scope-url.test.ts: ok");
