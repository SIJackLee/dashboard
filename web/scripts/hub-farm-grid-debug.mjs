#!/usr/bin/env node
/**
 * Admin geo hub — farm grid P0 regression + legacy path checks.
 * Usage: UI_VERIFY_BASE=http://localhost:3000 node scripts/hub-farm-grid-debug.mjs
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { passwordForEmail } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";

function parseGridSize(text) {
  const m = text.match(/(\d+)×(\d+)/);
  if (!m) return null;
  return { cols: Number(m[1]), rows: Number(m[2]) };
}

async function audit(page) {
  return page.evaluate(() => {
    const grid =
      document.querySelector('[data-audit-region="admin-hub-farm-scoped"]') ??
      document.querySelector('[data-audit-region="admin-hub-farm-scoped-mobile"]');
    const gridText = grid?.innerText ?? "";
    const url = new URL(location.href);
    const viewTabs = [...document.querySelectorAll('[role="tablist"][aria-label="농장 보기"] button')];
    return {
      url: location.href,
      pathname: url.pathname,
      view: url.searchParams.get("view"),
      lsind: url.searchParams.get("lsind"),
      item: url.searchParams.get("item"),
      ctrl: url.searchParams.get("ctrl"),
      sp: url.searchParams.get("sp"),
      stall: url.searchParams.get("stall"),
      opsPanel: !!document.querySelector('[data-audit-region="ops-controller-panel"]'),
      hubMap: !!grid,
      hubMapMobile: !!document.querySelector(
        '[data-audit-region="admin-hub-farm-scoped-mobile"]'
      ),
      hasGridTab: viewTabs.some((b) => b.textContent?.includes("그리드")),
      hasListTab: viewTabs.some((b) => b.textContent?.includes("목록")),
      ctrlText: (document.body.textContent ?? "").includes("온도 설정"),
      envText: (document.body.textContent ?? "").includes("환기량"),
      gridSnippet: gridText.slice(0, 400),
      barnCount: grid
        ? grid.querySelectorAll(
            '[data-audit-desktop-only] button, [data-audit-region="farm-map-list"] button'
          ).length
        : 0,
      farmMentionsInGrid: (gridText.match(/FARM\d+/g) ?? []).length,
      gridSizeMatch: gridText.match(/(\d+)×(\d+)/)?.[0] ?? null,
    };
  });
}

function assertFarmGridMode(snapshot, label, expectedFarmId = "FARM02") {
  const errors = [];
  if (!snapshot.hubMap) errors.push(`${label}: hub farm scoped panel missing`);
  if (!snapshot.hasGridTab) errors.push(`${label}: grid tab missing`);
  if (!snapshot.hasListTab) errors.push(`${label}: list tab missing`);
  if (snapshot.opsPanel) errors.push(`${label}: ops controller panel should be hidden`);
  if (snapshot.ctrlText) errors.push(`${label}: legacy ops "온도 설정" visible`);
  if (snapshot.barnCount > 32) {
    errors.push(`${label}: barnCount too high (${snapshot.barnCount}, was ~391 when contaminated)`);
  }
  const bodyFarmIds = (snapshot.gridSnippet.match(/FARM\d+/g) ?? []).filter(
    (id) => id !== expectedFarmId
  );
  if (bodyFarmIds.length > 0) {
    errors.push(`${label}: other farm ids in grid body (${bodyFarmIds.join(",")})`);
  }
  const grid = parseGridSize(snapshot.gridSnippet + (snapshot.gridSizeMatch ?? ""));
  if (grid && grid.cols * grid.rows > 32) {
    errors.push(`${label}: grid cell count exceeds 32 (${grid.cols}×${grid.rows})`);
  }
  if (snapshot.lsind !== expectedFarmId) {
    errors.push(`${label}: lsind expected ${expectedFarmId}, got ${snapshot.lsind}`);
  }
  if (snapshot.ctrl) errors.push(`${label}: ctrl param should be absent (${snapshot.ctrl})`);
  if (snapshot.sp) errors.push(`${label}: sp param should be absent (${snapshot.sp})`);
  if (snapshot.stall) errors.push(`${label}: stall param should be absent (${snapshot.stall})`);
  return errors;
}

function assertNoHubFarmGrid(snapshot, label) {
  const errors = [];
  if (snapshot.hubMap) errors.push(`${label}: hub farm map should not show`);
  return errors;
}

function assertDrillMode(snapshot, label) {
  const errors = [];
  if (snapshot.hubMap) errors.push(`${label}: farm scoped panel should be hidden in drill mode`);
  if (!snapshot.ctrl) errors.push(`${label}: ctrl param missing in drill URL`);
  return errors;
}

async function auditFarmList(page) {
  return page.evaluate(() => {
    const body = document.body.textContent ?? "";
    return {
      url: location.href,
      hasEmptyFarmList: body.includes("표시할 농장이 없습니다"),
      farmButtonCount: [...document.querySelectorAll("button")].filter((b) =>
        /FARM\d+/i.test(b.textContent ?? "")
      ).length,
    };
  });
}

function assertFarmListNonEmpty(snapshot, label) {
  const errors = [];
  if (snapshot.hasEmptyFarmList) {
    errors.push(`${label}: empty farm list message shown`);
  }
  if (snapshot.farmButtonCount < 1) {
    errors.push(`${label}: no FARM buttons in hierarchy tree (count=${snapshot.farmButtonCount})`);
  }
  return errors;
}

async function auditInGridGraph(page) {
  return page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const grid =
      document.querySelector('[data-audit-region="admin-hub-farm-scoped"]') ??
      document.querySelector('[data-audit-region="admin-hub-farm-scoped-mobile"]');
    if (!grid) return { skipped: true, reason: "no hub grid" };
    const card = [...grid.querySelectorAll("button")].find((b) =>
      /임신사|후보돈사|분만사/i.test(b.textContent ?? "")
    );
    if (!card) return { skipped: true, reason: "no barn card" };
    card.click();
    await sleep(100);
    const sawLoading = !!document.querySelector(
      '[data-audit-region="farm-map-graph-loading"]'
    );
    await sleep(3000);
    const stuckLoading = !!document.querySelector(
      '[data-audit-region="farm-map-graph-loading"]'
    );
    const emptyEl = document.querySelector('[data-audit-region="farm-map-graph-empty"]');
    const emptyText = emptyEl?.textContent?.trim() ?? null;
    const graphOpen = [...document.querySelectorAll("button")].some((b) =>
      b.textContent?.includes("지도")
    );
    return {
      graphOpen,
      sawLoading,
      stuckLoading,
      hasChart: !!document.querySelector('[aria-label="추이 차트"]'),
      emptyText,
      misleadingEmpty:
        sawLoading && (emptyText?.includes("선택한 기간에 수신된") ?? false),
    };
  });
}

async function loginAdmin(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.locator("#email").fill("admin@test.com");
    await page.locator("#password").fill(passwordForEmail("admin@test.com"));
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  }
}

async function waitHubReady(page) {
  await page.waitForTimeout(2500);
}

async function waitMapReady(page, timeout = 25000) {
  await page
    .waitForFunction(
      () => {
        const ready = document.querySelector('[data-audit-map-ready="true"]');
        const leaflet = document.querySelector(".leaflet-container");
        const host = leaflet ?? ready;
        if (!host) return false;
        return host.clientWidth >= 48 && host.clientHeight >= 48;
      },
      { timeout }
    )
    .catch(() => null);
}

async function auditLayout(page) {
  return page.evaluate(() => {
    const grid = document.querySelector('[data-audit-region="ops-hub-desktop-grid"]');
    const mapHost =
      document.querySelector('[data-audit-region="farm-geo-map"]') ??
      document.querySelector('[data-audit-map-ready="true"]');
    const leaflet = document.querySelector(".leaflet-container");
    const mapEl = leaflet ?? mapHost;
    const rightPanel = document.querySelector('[data-audit-region="admin-hub-farm-scoped"]');
    const gridStyle = grid ? getComputedStyle(grid) : null;
    return {
      width: window.innerWidth,
      stack: grid?.getAttribute("data-audit-stack") ?? null,
      gridCols: gridStyle?.gridTemplateColumns ?? null,
      gridChildCount: grid?.children.length ?? 0,
      mapW: mapEl?.clientWidth ?? 0,
      mapH: mapEl?.clientHeight ?? 0,
      leafletW: mapEl?.clientWidth ?? 0,
      leafletH: mapEl?.clientHeight ?? 0,
      mapReady: !!document.querySelector('[data-audit-map-ready="true"]'),
      tileCount: document.querySelectorAll(".leaflet-tile-pane img").length,
      rightPanelW: rightPanel?.clientWidth ?? 0,
      hasMinimapLabel: (document.body.textContent ?? "").includes("미니맵"),
      mapLoadingText: (document.body.textContent ?? "").includes("지도 로딩"),
    };
  });
}

function assertStackLayout(snapshot, label) {
  const errors = [];
  if (snapshot.stack !== "1") errors.push(`${label}: expected stacked layout (data-audit-stack=1)`);
  if (snapshot.gridChildCount !== 2) {
    errors.push(`${label}: expected 2 grid columns, got ${snapshot.gridChildCount}`);
  }
  if (!snapshot.hasMinimapLabel) errors.push(`${label}: minimap label missing`);
  if (snapshot.rightPanelW > 0 && snapshot.rightPanelW < 480) {
    errors.push(`${label}: right farm grid too narrow (${snapshot.rightPanelW}px)`);
  }
  return errors;
}

function assertThreeColLayout(snapshot, label) {
  const errors = [];
  if (snapshot.stack !== "0") errors.push(`${label}: expected 3-col layout (data-audit-stack=0)`);
  if (snapshot.gridChildCount !== 3) {
    errors.push(`${label}: expected 3 grid columns, got ${snapshot.gridChildCount}`);
  }
  return errors;
}

function assertMapLoaded(snapshot, label) {
  const errors = [];
  if (snapshot.mapLoadingText) errors.push(`${label}: map still showing loading placeholder`);
  if (!snapshot.mapReady && snapshot.leafletW < 48) {
    errors.push(`${label}: map not initialized (auditMapReady missing, ${snapshot.leafletW}x${snapshot.leafletH})`);
  }
  if (snapshot.leafletW >= 48 && snapshot.leafletH < 48) {
    errors.push(`${label}: map height too small (${snapshot.leafletW}x${snapshot.leafletH})`);
  }
  return errors;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results = [];
  const failures = [];

  await loginAdmin(page);

  // Path 0 — bare /farm (admin default) + F5 refresh farm list
  await page.goto(`${BASE}/farm`, { waitUntil: "domcontentloaded" });
  await waitHubReady(page);
  const bareFarmList = await auditFarmList(page);
  results.push({ step: "bare-farm-url", farmList: bareFarmList });
  failures.push(...assertFarmListNonEmpty(bareFarmList, "bare-farm-url"));

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitHubReady(page);
  const bareFarmAfterReload = await auditFarmList(page);
  results.push({ step: "bare-farm-after-reload", farmList: bareFarmAfterReload });
  failures.push(...assertFarmListNonEmpty(bareFarmAfterReload, "bare-farm-after-reload"));

  // Path A — overview (no farm in URL)
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/farm?tab=ops`, { waitUntil: "domcontentloaded" });
  await waitHubReady(page);
  await waitMapReady(page);
  const overview = await audit(page);
  const overviewLayout = await auditLayout(page);
  results.push({ step: "overview", snapshot: overview, layout: overviewLayout });
  failures.push(...assertNoHubFarmGrid(overview, "overview"));
  failures.push(...assertThreeColLayout(overviewLayout, "overview-layout"));
  failures.push(...assertMapLoaded(overviewLayout, "overview-map"));

  // Path B — click FARM02 in tree
  const farmBtn = page.locator("button").filter({ hasText: /FARM02/ }).first();
  if ((await farmBtn.count()) === 0) {
    failures.push("FARM02 button not found in hierarchy tree");
  } else {
  await farmBtn.click();
  await page.waitForURL(/lsind=FARM02/, { timeout: 10000 });
  await waitHubReady(page);
  await waitMapReady(page);
    const afterClick = await audit(page);
    const afterClickLayout = await auditLayout(page);
    results.push({ step: "click-FARM02", snapshot: afterClick, layout: afterClickLayout });
    failures.push(...assertFarmGridMode(afterClick, "click-FARM02"));
    failures.push(...assertStackLayout(afterClickLayout, "click-FARM02-layout"));
    failures.push(...assertMapLoaded(afterClickLayout, "click-FARM02-map"));

    const catalogAudit = await page.evaluate(() => {
      const grid =
        document.querySelector('[data-audit-region="admin-hub-farm-scoped"]') ??
        document.querySelector('[data-audit-region="admin-hub-farm-scoped-mobile"]');
      if (!grid) return null;
      const names = [...grid.querySelectorAll("p,span,button")]
        .map((el) => el.textContent?.trim() ?? "")
        .filter((t) => /후보돈사|임신사|FARM\d+/i.test(t));
      const counts = {};
      for (const n of names) counts[n] = (counts[n] ?? 0) + 1;
      return {
        duplicateBarns: Object.fromEntries(
          Object.entries(counts).filter(([, c]) => c > 3)
        ),
      };
    });
    results.push({ step: "click-FARM02-catalog", catalogAudit });
    if (catalogAudit?.duplicateBarns && Object.keys(catalogAudit.duplicateBarns).length > 0) {
      failures.push(
        `click-FARM02: duplicate barn labels ${JSON.stringify(catalogAudit.duplicateBarns)}`
      );
    }

    const graphDrill = await auditInGridGraph(page);
    results.push({ step: "click-FARM02-graph-drill", graphDrill });
    if (graphDrill.skipped) {
      failures.push(`click-FARM02-graph: ${graphDrill.reason}`);
    } else {
      if (!graphDrill.graphOpen) failures.push("click-FARM02-graph: graph did not open");
      if (graphDrill.misleadingEmpty) {
        failures.push("click-FARM02-graph: false empty shown during loading");
      }
      if (graphDrill.stuckLoading) {
        failures.push("click-FARM02-graph: loading stuck after 3s");
      }
    }

    const listTabBtn = page.getByRole("tab", { name: "목록" });
    if ((await listTabBtn.count()) === 0) {
      failures.push("click-FARM02: list tab button missing");
    } else {
      await listTabBtn.click();
      await page.waitForTimeout(800);
      const listAudit = await page.evaluate(() => ({
        view: new URL(location.href).searchParams.get("view"),
        hasTable: !!document.querySelector("table"),
        hasListTabs: (document.body.textContent ?? "").includes("컨트롤러"),
      }));
      results.push({ step: "click-FARM02-list-tab", listAudit });
      if (listAudit.view !== "list") {
        failures.push(`click-FARM02-list: view param expected list, got ${listAudit.view}`);
      }
      if (!listAudit.hasTable) {
        failures.push("click-FARM02-list: BarnTable missing");
      }

      const graphPill = page.getByRole("button", { name: "그래프" }).first();
      if ((await graphPill.count()) === 0) {
        failures.push("click-FARM02-list: graph pill missing");
      } else {
        const requestsBefore = [];
        const onRequest = (req) => {
          if (req.url().includes("/farm") && req.resourceType() === "document") {
            requestsBefore.push(req.url());
          }
        };
        page.on("request", onRequest);
        await graphPill.click();
        await page.waitForTimeout(600);
        page.off("request", onRequest);
        const listPillAudit = await page.evaluate(() => ({
          view: new URL(location.href).searchParams.get("view"),
          listMode: new URL(location.href).searchParams.get("listMode"),
          tab: new URL(location.href).searchParams.get("tab"),
          lsind: new URL(location.href).searchParams.get("lsind"),
          hasSkeleton: !!document.querySelector(
            '[data-audit-region="admin-hub-farm-scoped"] .animate-pulse, [data-audit-region="admin-hub-farm-scoped-mobile"] .animate-pulse',
          ),
        }));
        results.push({ step: "click-FARM02-list-graph-pill", listPillAudit, rscDocuments: requestsBefore.length });
        if (listPillAudit.view !== "list") {
          failures.push(`click-FARM02-list-graph-pill: view expected list, got ${listPillAudit.view}`);
        }
        if (listPillAudit.listMode !== "graph") {
          failures.push(`click-FARM02-list-graph-pill: listMode expected graph, got ${listPillAudit.listMode}`);
        }
        if (listPillAudit.tab !== "ops") {
          failures.push(`click-FARM02-list-graph-pill: tab=ops missing (${listPillAudit.tab})`);
        }
        if (listPillAudit.lsind !== "FARM02") {
          failures.push(`click-FARM02-list-graph-pill: lsind expected FARM02, got ${listPillAudit.lsind}`);
        }
        if (listPillAudit.hasSkeleton) {
          failures.push("click-FARM02-list-graph-pill: pulse skeleton appeared (RSC refetch)");
        }
        if (requestsBefore.length > 0) {
          failures.push(`click-FARM02-list-graph-pill: unexpected RSC document requests (${requestsBefore.length})`);
        }
      }
    }
  }

  // Path C — direct farm-grid URL (remount case)
  await page.goto(`${BASE}/farm?tab=ops&lsind=FARM02&item=P00`, {
    waitUntil: "domcontentloaded",
  });
  await waitHubReady(page);
  const directFarm = await audit(page);
  results.push({ step: "direct-farm-grid-url", snapshot: directFarm });
  failures.push(...assertFarmGridMode(directFarm, "direct-farm-grid-url"));

  // Path D — drill URL with ctrl (grid hidden, ops panel visible)
  await page.goto(
    `${BASE}/farm?tab=ops&lsind=FARM02&item=P00&sp=SP01&stall=01&ctrl=${encodeURIComponent("SP01:01:01")}`,
    { waitUntil: "domcontentloaded" }
  );
  await waitHubReady(page);
  const drill = await audit(page);
  results.push({ step: "direct-drill-ctrl-url", snapshot: drill });
  failures.push(...assertDrillMode(drill, "direct-drill-ctrl-url"));

  // Path E — legacy farmer-style deep link without geo hub grid (admin with ctrl only sanity)
  await page.goto(`${BASE}/farm?tab=ops&lsind=FARM01&item=P00&sp=SP01&stall=ST01`, {
    waitUntil: "domcontentloaded",
  });
  await waitHubReady(page);
  const legacySp = await audit(page);
  results.push({ step: "legacy-sp-stall-url", snapshot: legacySp });
  if (legacySp.hubMap && !legacySp.ctrl) {
    failures.push("legacy-sp-stall-url: farm grid shown despite sp/stall deep link");
  }

  // Path F — mobile farm grid (375px)
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/farm?tab=ops&lsind=FARM02&item=P00`, {
    waitUntil: "domcontentloaded",
  });
  await waitHubReady(page);
  const mobileFarm = await audit(page);
  results.push({ step: "mobile-farm-grid-url", snapshot: mobileFarm });
  failures.push(...assertFarmGridMode(mobileFarm, "mobile-farm-grid-url"));
  if (!mobileFarm.hubMapMobile) {
    failures.push("mobile-farm-grid-url: admin-hub-farm-scoped-mobile missing");
  }

  // Path G — width sweep (1024 / 1440) stack + map
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/farm?tab=ops&lsind=FARM02&item=P00`, {
      waitUntil: "domcontentloaded",
    });
    await waitHubReady(page);
    await waitMapReady(page);
    const layout = await auditLayout(page);
    results.push({ step: `width-${width}-farm-grid`, layout });
    failures.push(...assertStackLayout(layout, `width-${width}-stack`));
    failures.push(...assertMapLoaded(layout, `width-${width}-map`));
  }

  // Path H — minimap expand restores 3-col
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/farm?tab=ops&lsind=FARM02&item=P00`, {
    waitUntil: "domcontentloaded",
  });
  await waitHubReady(page);
  const miniExpandBtn = page.getByRole("button", { name: "지도 전체 화면 복원" });
  if ((await miniExpandBtn.count()) > 0) {
    await miniExpandBtn.click({ force: true });
    await waitHubReady(page);
    await waitMapReady(page);
    const expandedLayout = await auditLayout(page);
    results.push({ step: "minimap-expand", layout: expandedLayout });
    failures.push(...assertThreeColLayout(expandedLayout, "minimap-expand"));
    failures.push(...assertMapLoaded(expandedLayout, "minimap-expand-map"));
  } else {
    failures.push("minimap-expand: expand button not found");
  }

  console.log(JSON.stringify({ pass: failures.length === 0, failures, results }, null, 2));
  await browser.close();
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
