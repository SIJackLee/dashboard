/**
 * 실행: npx tsx src/lib/farm/farm-view-url-pin.test.ts
 */
import assert from "node:assert/strict";
import {
  buildFarmMonitoringHomeParams,
  buildFarmMonitoringHomePath,
  clearHubFarmDrillParams,
  isFarmMonitoringSoftHome,
  normalizeLegacyListModeParam,
  parseListViewMode,
  pinFarmHubViewParam,
  resolveFarmHubView,
  resolveListViewMode,
  resolveTrendPeriodParam,
  setListViewMode,
  setTrendPeriodParam,
} from "./farm-view-url";

{
  const params = new URLSearchParams("lsind=FARM01&item=P00&view=chart");
  setTrendPeriodParam(params, "7d");
  pinFarmHubViewParam(params, "chart");
  assert.equal(params.get("view"), "chart");
  // 기본 7d는 URL에서 생략
  assert.equal(params.get("trendPeriod"), null);
  assert.equal(resolveTrendPeriodParam(params), "7d");
  assert.equal(params.get("lsind"), "FARM01");
}

{
  const params = new URLSearchParams("lsind=FARM01&item=P00&sp=SP02");
  setTrendPeriodParam(params, "30d");
  pinFarmHubViewParam(params, "map");
  assert.equal(params.get("view"), null);
  assert.equal(params.get("sp"), "SP02");
  assert.equal(params.get("trendPeriod"), "30d");
}

{
  const params = new URLSearchParams("lsind=FARM01&item=P00");
  setTrendPeriodParam(params, "7d");
  pinFarmHubViewParam(params, "chart");
  assert.equal(resolveFarmHubView(params.get("view")), "chart");
}

{
  const source = new URLSearchParams(
    "lsind=FARM01&item=P00&view=chart&trendPeriod=7d&sp=SP02&ctrl=x",
  );
  const home = buildFarmMonitoringHomeParams(source);
  assert.equal(home.get("lsind"), "FARM01");
  assert.equal(home.get("item"), "P00");
  // soft home도 기본 7d는 쿼리에서 제거
  assert.equal(home.get("trendPeriod"), null);
  assert.equal(home.get("view"), null);
  assert.equal(home.get("sp"), null);
  assert.equal(home.get("ctrl"), null);
  assert.equal(isFarmMonitoringSoftHome(home), true);
  assert.equal(isFarmMonitoringSoftHome(source), false);
  assert.equal(
    buildFarmMonitoringHomePath(source),
    "/farm?lsind=FARM01&item=P00",
  );
}

{
  const params = new URLSearchParams(
    "lsind=FARM01&item=P00&view=chart&trendPeriod=7d&sp=SP02",
  );
  clearHubFarmDrillParams(params);
  assert.equal(params.get("view"), null);
  assert.equal(params.get("sp"), null);
  // clearHub는 trendPeriod를 건드리지 않음 — 소스에 있던 7d는 잔존 가능
  assert.equal(params.get("trendPeriod"), "7d");
  assert.equal(params.get("lsind"), "FARM01");
}

{
  const params = new URLSearchParams("view=list&listMode=channel");
  assert.equal(parseListViewMode("channel"), "graph");
  assert.equal(resolveListViewMode(params), "graph");
  assert.equal(normalizeLegacyListModeParam(params), true);
  assert.equal(params.get("listMode"), "graph");
  assert.equal(normalizeLegacyListModeParam(params), false);
  setListViewMode(params, "settings");
  assert.equal(params.get("listMode"), "settings");
  setListViewMode(params, "controller");
  assert.equal(params.get("listMode"), null);
}

console.log("farm-view-url-pin.test.ts: ok");
