#!/usr/bin/env node
/**
 * Admin hub phase verify — widths, overflow, drill, view tabs (FARM01)
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { passwordForEmail } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const FARM_SCOPE = "/farm?lsind=FARM01&item=P00";
const WIDTHS = [375, 768, 1280];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.locator("#email").fill("admin@test.com");
    await page.locator("#password").fill(passwordForEmail("admin@test.com"));
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  }
}

async function auditPage(page, label) {
  await page.waitForTimeout(4000);
  return page.evaluate(({ label }) => {
    const html = document.documentElement;
    const overflowX = html.scrollWidth - html.clientWidth;
    const body = document.body.innerText || "";
    const gridCells = [...document.querySelectorAll("[data-grid-cell]")];
    const mobileList = document.querySelector('[data-audit-region="farm-map-mobile-list"]');
    const stackList = document.querySelector('[data-audit-region="farm-map-list"]');
    const barnCards = gridCells.length + (stackList?.querySelectorAll("button").length ?? 0);
    const clippedTitles = [...document.querySelectorAll("button span.line-clamp-2, button span.truncate")].filter(
      (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && el.scrollWidth > el.clientWidth + 2;
      }
    ).length;
    const isVisible = (el) => {
      if (!el) return false;
      const s = getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden" && el.getBoundingClientRect().width > 0;
    };
    return {
      label,
      width: innerWidth,
      overflowX,
      url: location.href,
      hasEmptyFarmList: body.includes("표시할 농장이 없습니다"),
      hasEmptyBarn:
        body.includes("LIVE 데이터에 stallNo") ||
        (body.includes("LIVE 데이터 수신 대기") && barnCards === 0),
      barnCards,
      clippedTitles,
      hasControllerPanel: !!document.querySelector('[data-audit-region="farm-map-controller"]'),
      hasViewTabs: [...document.querySelectorAll('[role="tab"]')].some(
        (el) => el.textContent?.trim() === "그리드" || el.textContent?.trim() === "목록"
      ),
      desktopGridVisible: gridCells.some((c) => isVisible(c)),
      mobileListVisible: isVisible(mobileList) || (innerWidth < 768 && isVisible(stackList)),
    };
  }, { label });
}

const findings = [];

async function main() {
  const browser = await chromium.launch();

  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await login(page);
    await page.goto(`${BASE}${FARM_SCOPE}`, { waitUntil: "domcontentloaded" });
    const snap = await auditPage(page, `farm01-${w}`);
    if (snap.hasEmptyFarmList) findings.push({ severity: "high", ...snap, issue: "농장목록 empty" });
    if (snap.hasEmptyBarn) findings.push({ severity: "high", ...snap, issue: "축사 그리드 empty" });
    if (snap.overflowX > 4)
      findings.push({ severity: "medium", ...snap, issue: `overflowX=${snap.overflowX}` });
    if (snap.clippedTitles > 2)
      findings.push({ severity: "low", ...snap, issue: `clippedTitles=${snap.clippedTitles}` });
    if (w >= 768 && !snap.desktopGridVisible && snap.barnCards === 0)
      findings.push({ severity: "high", ...snap, issue: "desktop grid empty at tablet+" });
    if (w < 768 && !snap.mobileListVisible && snap.barnCards === 0)
      findings.push({ severity: "high", ...snap, issue: "mobile barn list empty" });
    if (!snap.hasViewTabs)
      findings.push({ severity: "medium", ...snap, issue: "missing 그리드/목록 tabs" });

    if (snap.barnCards > 0) {
      const spBtn = page.locator("[data-grid-cell] button, [data-audit-region='farm-map-list'] button").filter({
        hasText: "후보돈사",
      });
      if ((await spBtn.count()) > 0) {
        await spBtn.first().click({ force: true });
        await page.waitForTimeout(2000);
        const drill = await page.evaluate(() => ({
          url: location.href,
          hasControllerPanel: !!document.querySelector('[data-audit-region="farm-map-controller"]'),
          hasGraph:
            document.body.innerText.includes("온도 추이") ||
            document.body.innerText.includes("그래프") ||
            !!document.querySelector('[data-audit-region="farm-map-graph-loading"]'),
        }));
        if (!drill.hasControllerPanel && !drill.url.includes("sp=") && !drill.hasGraph) {
          findings.push({ severity: "high", width: w, issue: "축사 클릭 drill 실패", ...drill });
        }
      }
    }
    await page.close();
  }

  const tabPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(tabPage);
  await tabPage.goto(`${BASE}${FARM_SCOPE}`, { waitUntil: "domcontentloaded" });
  await tabPage.waitForTimeout(4000);
  const listTab = tabPage.getByRole("tab", { name: "목록" });
  if ((await listTab.count()) > 0) {
    await listTab.click();
    await tabPage.waitForTimeout(1500);
    const afterList = await tabPage.evaluate(() => ({
      url: location.href,
      hasListSummary: !!document.querySelector('[data-audit-region="barn-list-summary"]'),
      viewParam: new URLSearchParams(location.search).get("view"),
    }));
    if (!afterList.hasListSummary && afterList.viewParam !== "list") {
      findings.push({ severity: "high", issue: "목록 탭 전환 실패", ...afterList });
    }
  }
  await tabPage.close();

  const overviewPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(overviewPage);
  await overviewPage.goto(`${BASE}/farm`, { waitUntil: "domcontentloaded" });
  await overviewPage.waitForTimeout(4000);
  const overview = await overviewPage.evaluate(() => ({
    url: location.href,
    autoDrill: location.href.includes("ctrl=") || location.href.includes("sp="),
    hasNationalHub: (() => {
      if (location.search.includes("lsind=")) return false;
      const t = document.body.innerText || "";
      if (t.includes("표시할 농장 그리드")) return true;
      const farmSections = document.querySelectorAll(".space-y-6 > section");
      if (farmSections.length >= 2) return true;
      const farmCodes = t.match(/FARM\d+/g) ?? [];
      return new Set(farmCodes).size >= 2;
    })(),
  }));
  if (overview.autoDrill)
    findings.push({ severity: "medium", issue: "bare /farm URL auto drill", ...overview });
  if (!overview.hasNationalHub)
    findings.push({ severity: "high", issue: "national hub missing on /farm", ...overview });
  await overviewPage.close();

  await browser.close();

  console.log(JSON.stringify({ findingCount: findings.length, findings }, null, 2));
  process.exit(findings.some((f) => f.severity === "high") ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
