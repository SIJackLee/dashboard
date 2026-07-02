#!/usr/bin/env node
/**
 * Admin 농장지도 UI 직접 감사
 * Usage: UI_VERIFY_BASE=http://localhost:3000 node scripts/admin-farm-map-ui-audit.mjs
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { passwordForEmail } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";

async function loginAdmin(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.locator("#email").fill("admin@test.com");
    await page.locator("#password").fill(passwordForEmail("admin@test.com"));
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  }
}

async function waitReady(page) {
  await page.waitForTimeout(3000);
  await page
    .waitForFunction(
      () =>
        document.querySelector('[data-audit-map-ready="true"]') ||
        document.querySelector('[data-audit-region="admin-hub-farm-map"]') ||
        document.body.textContent?.includes("온도 설정"),
      { timeout: 20000 }
    )
    .catch(() => null);
}

function pageAudit() {
  const html = document.documentElement;
  const overflowX = html.scrollWidth - html.clientWidth;
  const grid = document.querySelector('[data-audit-region="ops-hub-desktop-grid"]');
  const hubMap = document.querySelector('[data-audit-region="admin-hub-farm-map"]');
  const hubMapMobile = document.querySelector('[data-audit-region="admin-hub-farm-map-mobile"]');
  const geoMap = document.querySelector('[data-audit-map-ready="true"]');
  const body = document.body.innerText;

  const gridRect = grid?.getBoundingClientRect();
  const hubRect = (hubMap ?? hubMapMobile)?.getBoundingClientRect();
  const geoRect = geoMap?.getBoundingClientRect();

  const emptyCards = hubMap
    ? [...hubMap.querySelectorAll("button")].filter((b) => {
        const t = b.innerText ?? "";
        return t.includes("온도") && !/\d/.test(t);
      }).length
    : 0;

  const clipped = [];
  if (grid && gridRect && gridRect.right > window.innerWidth + 2) {
    clipped.push("desktop-grid-overflow");
  }
  if (hubRect && hubRect.width > 0 && hubRect.right > window.innerWidth + 2) {
    clipped.push("farm-grid-overflow");
  }

  return {
    width: window.innerWidth,
    url: location.href,
    overflowX,
    stack: grid?.getAttribute("data-audit-stack") ?? null,
    gridCols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
    hasGeoMap: !!geoMap,
    geoMapSize: geoRect ? { w: Math.round(geoRect.width), h: Math.round(geoRect.height) } : null,
    hasHubFarmMap: !!(hubMap ?? hubMapMobile),
    hubMapSize: hubRect ? { w: Math.round(hubRect.width), h: Math.round(hubRect.height) } : null,
    hubMapEmptyTempCards: emptyCards,
    hasMinimap: body.includes("미니맵"),
    hasOpsPanel: !!document.querySelector('[data-audit-region="ops-controller-panel"]'),
    hasPlaceholder: body.includes("농장을 선택하세요"),
    hasLoadingMap: body.includes("지도 로딩"),
    hasLoadingFarmMap: body.includes("농장 지도 불러오는 중"),
    barnGridLabel: body.match(/\d+×\d+/)?.[0] ?? null,
    clipped,
    mobileSplitVisible: !!document.querySelector(".lg\\:hidden .flex.min-h-\\[calc\\(100dvh"),
  };
}

async function auditStep(page, label) {
  const data = await page.evaluate(pageAudit);
  return { label, ...data };
}

async function main() {
  const browser = await chromium.launch();
  const findings = [];
  const snapshots = [];

  const addFinding = (severity, step, issue, detail = "") => {
    findings.push({ severity, step, issue, detail });
  };

  // Desktop 1280 — overview
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await loginAdmin(desktop);
  await desktop.goto(`${BASE}/farm?tab=ops`, { waitUntil: "domcontentloaded" });
  await waitReady(desktop);
  let s = await auditStep(desktop, "desktop-overview");
  snapshots.push(s);
  if (s.overflowX > 4) addFinding("medium", s.label, "가로 스크롤 발생", `overflowX=${s.overflowX}px`);
  if (!s.hasGeoMap) addFinding("high", s.label, "전국 지도 미로드", s.hasLoadingMap ? "로딩 placeholder" : "leaflet 없음");
  if (s.hasLoadingFarmMap) addFinding("medium", s.label, "농장 지도 로딩 문구 잔존");

  // Desktop — FARM02 farm grid (stack)
  await desktop.goto(`${BASE}/farm?tab=ops&lsind=FARM02&item=P00`, { waitUntil: "domcontentloaded" });
  await waitReady(desktop);
  s = await auditStep(desktop, "desktop-farm02-grid");
  snapshots.push(s);
  if (s.stack !== "1") addFinding("high", s.label, "2열 스택 미적용", `stack=${s.stack}`);
  if (!s.hasHubFarmMap) addFinding("high", s.label, "우측 농장 지도 없음");
  if (s.hubMapSize && s.hubMapSize.w < 480) {
    addFinding("medium", s.label, "우측 farm grid 너비 부족", `${s.hubMapSize.w}px`);
  }
  if (s.hubMapEmptyTempCards > 0) {
    addFinding("low", s.label, "온도/습도 미표시 카드", `${s.hubMapEmptyTempCards}개`);
  }
  if (!s.hasMinimap) addFinding("medium", s.label, "미니맵 라벨 없음");
  if (s.hasOpsPanel) addFinding("high", s.label, "farm grid 모드에서 ops 패널 노출");
  if (!s.hasGeoMap) addFinding("high", s.label, "미니맵 leaflet 미로드");

  // Desktop — drill ctrl
  await desktop.goto(
    `${BASE}/farm?tab=ops&lsind=FARM02&item=P00&sp=SP01&stall=01&ctrl=${encodeURIComponent("SP01:01:01")}`,
    { waitUntil: "domcontentloaded" }
  );
  await waitReady(desktop);
  s = await auditStep(desktop, "desktop-drill-ctrl");
  snapshots.push(s);
  if (s.hasHubFarmMap) addFinding("high", s.label, "drill URL에서 farm grid 잔존");
  if (!s.hasOpsPanel) addFinding("high", s.label, "drill URL에서 ops 패널 없음");

  // Desktop — minimap expand
  await desktop.goto(`${BASE}/farm?tab=ops&lsind=FARM02&item=P00`, { waitUntil: "domcontentloaded" });
  await waitReady(desktop);
  const expand = desktop.getByRole("button", { name: "지도 전체 화면 복원" });
  if ((await expand.count()) > 0) {
    await expand.click({ force: true });
    await waitReady(desktop);
    s = await auditStep(desktop, "desktop-minimap-expand");
    snapshots.push(s);
    if (s.stack !== "0") addFinding("medium", s.label, "미니맵 확장 후 3열 미복원", `stack=${s.stack}`);
    if (s.url.includes("lsind=FARM02") && !s.hasHubFarmMap && !s.hasOpsPanel) {
      addFinding("medium", s.label, "확장 후 URL에 FARM02 남음·우측 placeholder", "hubFarmId 초기화만, URL 미동기화");
    }
  }

  // Mobile 375
  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await loginAdmin(mobile);
  await mobile.goto(`${BASE}/farm?tab=ops&lsind=FARM02&item=P00`, { waitUntil: "domcontentloaded" });
  await waitReady(mobile);
  s = await auditStep(mobile, "mobile-farm02-grid");
  snapshots.push(s);
  if (!s.hasHubFarmMap || !s.hubMapSize) {
    addFinding("high", s.label, "모바일 top farm grid 없음");
  } else if (s.hubMapSize.h < 120) {
    addFinding("medium", s.label, "모바일 farm grid 높이 부족", `${s.hubMapSize.h}px`);
  }
  if (s.hasPlaceholder) addFinding("high", s.label, "모바일 placeholder 잔존");
  if (s.overflowX > 4) addFinding("medium", s.label, "모바일 가로 스크롤", `overflowX=${s.overflowX}px`);

  // Tablet 768 — desktop grid threshold
  const tablet = await browser.newPage({ viewport: { width: 768, height: 900 } });
  await loginAdmin(tablet);
  await tablet.goto(`${BASE}/farm?tab=ops&lsind=FARM02&item=P00`, { waitUntil: "domcontentloaded" });
  await waitReady(tablet);
  s = await auditStep(tablet, "tablet-768-farm02");
  snapshots.push(s);
  if (s.stack === "1") {
    addFinding("low", s.label, "768px에서 desktop stack 그리드 노출", "lg(1024) 미만인데 max-lg:hidden grid?");
  }

  console.log(
    JSON.stringify(
      {
        findingCount: findings.length,
        findings,
        snapshots,
      },
      null,
      2
    )
  );

  await browser.close();
  process.exit(findings.filter((f) => f.severity === "high").length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
