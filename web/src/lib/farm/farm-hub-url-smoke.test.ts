/**
 * `/farm` 셸 스모크 — 딥링크 · soft home · 기간+탭 유지
 * 실행: npx tsx src/lib/farm/farm-hub-url-smoke.test.ts
 */
import assert from "node:assert/strict";
import {
  applyFarmChartScopeParams,
  resolveFarmChartScope,
  scopesEqual,
} from "./farm-chart-scope";
import {
  applyHubScopedViewParams,
  applyMapGridParams,
  buildFarmMonitoringHomeParams,
  clearHubFarmDrillParams,
  isFarmMonitoringSoftHome,
  pinFarmHubViewParam,
  resolveFarmHubView,
  resolveTrendPeriodParam,
  setTrendPeriodParam,
  type FarmHubView,
} from "./farm-view-url";

function clone(q: string) {
  return new URLSearchParams(q);
}

/** 1) 차트 범위 → URL → “새로고침”(재파싱) 유지 */
{
  const params = clone(
    "lsind=FARM01&item=P00&view=chart&trendPeriod=7d",
  );
  applyFarmChartScopeParams(params, {
    level: "stall",
    stallTyCode: "SP03",
    stallNo: "1",
  });
  pinFarmHubViewParam(params, "chart");

  assert.equal(resolveFarmHubView(params.get("view")), "chart");
  assert.equal(resolveTrendPeriodParam(params), "7d");
  assert.ok(
    scopesEqual(resolveFarmChartScope(params), {
      level: "stall",
      stallTyCode: "SP03",
      stallNo: "1",
    }),
  );

  // remount / 새로고침 시뮬레이션 — query string 재파싱
  const reloaded = new URLSearchParams(params.toString());
  assert.equal(resolveFarmHubView(reloaded.get("view")), "chart");
  assert.ok(
    scopesEqual(resolveFarmChartScope(reloaded), {
      level: "stall",
      stallTyCode: "SP03",
      stallNo: "1",
    }),
  );
  console.log("smoke 1: chart scope deeplink reload — ok");
}

/** 2) soft home(로고·모니터링) — chart* 제거 · 그리드 홈 · 농장·기간 유지 */
{
  const source = clone(
    "lsind=FARM01&item=P00&view=chart&trendPeriod=7d&chartSp=SP03&chartStall=1&chartCtrl=x%2Fy",
  );
  assert.equal(isFarmMonitoringSoftHome(source), false);

  const home = buildFarmMonitoringHomeParams(source);
  assert.equal(home.get("lsind"), "FARM01");
  assert.equal(home.get("item"), "P00");
  /** 7d = 기본 → soft home URL에서 생략 */
  assert.equal(home.get("trendPeriod"), null);
  assert.equal(resolveTrendPeriodParam(home), "7d");
  assert.equal(home.get("view"), null);
  assert.equal(home.get("chartSp"), null);
  assert.equal(home.get("chartStall"), null);
  assert.equal(home.get("chartCtrl"), null);
  assert.equal(resolveFarmHubView(home.get("view")), "map");
  assert.equal(resolveFarmChartScope(home).level, "farm");
  assert.equal(isFarmMonitoringSoftHome(home), true);

  const keep24 = buildFarmMonitoringHomeParams(
    clone(
      "lsind=FARM01&item=P00&view=chart&trendPeriod=24h&chartSp=SP03",
    ),
  );
  assert.equal(keep24.get("trendPeriod"), "24h");

  // 그리드 탭 전환도 chart* 정리
  const leaveChart = clone(source.toString());
  applyMapGridParams(leaveChart);
  assert.equal(leaveChart.get("chartSp"), null);
  assert.equal(resolveFarmHubView(leaveChart.get("view")), "map");
  console.log("smoke 2: soft home clears chart* — ok");
}

/** 3) 기간 변경 — 탭·집계 범위 유지 (그리드로 떨어지지 않음) */
{
  const params = clone(
    "lsind=FARM01&item=P00&view=chart&chartSp=SP02&chartStall=2",
  );
  setTrendPeriodParam(params, "30d");
  pinFarmHubViewParam(params, "chart");

  assert.equal(resolveFarmHubView(params.get("view")), "chart");
  assert.equal(resolveTrendPeriodParam(params), "30d");
  assert.ok(
    scopesEqual(resolveFarmChartScope(params), {
      level: "stall",
      stallTyCode: "SP02",
      stallNo: "2",
    }),
  );

  // 7d = 기본 → URL에서 trendPeriod 생략해도 탭·범위 유지
  setTrendPeriodParam(params, "7d");
  pinFarmHubViewParam(params, "chart");
  assert.equal(params.get("trendPeriod"), null);
  assert.equal(resolveTrendPeriodParam(params), "7d");
  assert.equal(resolveFarmHubView(params.get("view")), "chart");
  assert.equal(params.get("chartSp"), "SP02");
  console.log("smoke 3: period change keeps chart view+scope — ok");
}

/** 4) 탭 왕복 — applyHubScopedViewParams 순서 map→list→chart→aria→map */
{
  const params = clone("lsind=FARM01&item=P00&sp=SP01&stall=3&mapLevel=stalls");
  const order: FarmHubView[] = ["list", "chart", "aria", "map"];
  for (const v of order) {
    applyHubScopedViewParams(params, v);
    assert.equal(resolveFarmHubView(params.get("view")), v);
  }
  // map 홈: view 없음 · 드릴 제거 · 농장 유지
  assert.equal(params.get("view"), null);
  assert.equal(params.get("sp"), null);
  assert.equal(params.get("stall"), null);
  assert.equal(params.get("lsind"), "FARM01");
  assert.equal(params.get("item"), "P00");
  // jarvis → aria
  assert.equal(resolveFarmHubView("jarvis"), "aria");
  console.log("smoke 4: tab roundtrip URL helpers — ok");
}

/** 5) 농장 전환 — drill/탭/chart* 제거 후 새 키 */
{
  const params = clone(
    "lsind=FARM01&item=P00&view=list&listMode=graph&sp=SP02&stall=1&ctrl=a%2Fb&chartSp=SP03&trendPeriod=7d",
  );
  clearHubFarmDrillParams(params);
  params.set("lsind", "FARM02");
  params.set("item", "P00");
  assert.equal(params.get("view"), null);
  assert.equal(params.get("listMode"), null);
  assert.equal(params.get("sp"), null);
  assert.equal(params.get("ctrl"), null);
  assert.equal(params.get("chartSp"), null);
  assert.equal(params.get("lsind"), "FARM02");
  assert.equal(params.get("trendPeriod"), "7d");
  assert.equal(resolveFarmHubView(params.get("view")), "map");
  console.log("smoke 5: farm switch clears hub drill — ok");
}

console.log("farm-hub-url-smoke.test.ts: all ok");
