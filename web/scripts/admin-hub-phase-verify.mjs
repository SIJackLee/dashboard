#!/usr/bin/env node
/**
 * Admin hub phase verify — widths, overflow, drill, expand URL
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { passwordForEmail } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
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
    const hub = document.querySelector('[data-audit-region="admin-hub-farm-map"]');
    const cards = hub
      ? [...hub.querySelectorAll("button")].filter((b) =>
          (b.innerText || "").includes("온도")
        )
      : [];
    const clippedTitles = hub
      ? [...hub.querySelectorAll("button span.line-clamp-2, button span.truncate")].filter(
          (el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && el.scrollWidth > el.clientWidth + 2;
          }
        ).length
      : 0;
    return {
      label,
      width: innerWidth,
      overflowX,
      url: location.href,
      hasEmptyFarmList: body.includes("표시할 농장이 없습니다"),
      hasEmptyBarn: body.includes("LIVE 데이터에 stallNo"),
      barnCards: cards.length,
      clippedTitles,
      hasOpsPanel: !!document.querySelector('[data-audit-region="ops-controller-panel"]'),
      stack: document.querySelector('[data-audit-region="ops-hub-desktop-grid"]')?.getAttribute(
        "data-audit-stack"
      ),
      desktopGridVisible: (() => {
        const g = document.querySelector('[data-audit-region="ops-hub-desktop-grid"]');
        if (!g) return false;
        return getComputedStyle(g).display !== "none";
      })(),
      mobileHubVisible: (() => {
        const m = document.querySelector(".md\\:hidden");
        if (!m) return false;
        return getComputedStyle(m).display !== "none";
      })(),
    };
  }, { label });
}

const findings = [];

async function main() {
  const browser = await chromium.launch();

  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await login(page);
    await page.goto(`${BASE}/farm?tab=ops&lsind=FARM02&item=P00`, {
      waitUntil: "domcontentloaded",
    });
    const snap = await auditPage(page, `farm02-${w}`);
    if (snap.hasEmptyFarmList) findings.push({ severity: "high", ...snap, issue: "농장목록 empty" });
    if (snap.hasEmptyBarn) findings.push({ severity: "high", ...snap, issue: "축사 그리드 empty" });
    if (snap.overflowX > 4)
      findings.push({ severity: "medium", ...snap, issue: `overflowX=${snap.overflowX}` });
    if (snap.clippedTitles > 2)
      findings.push({ severity: "low", ...snap, issue: `clippedTitles=${snap.clippedTitles}` });
    if (w >= 768 && !snap.desktopGridVisible)
      findings.push({ severity: "high", ...snap, issue: "desktop grid hidden at tablet+" });
    if (w < 768 && !snap.mobileHubVisible)
      findings.push({ severity: "high", ...snap, issue: "mobile hub hidden" });

    if (w >= 768 && snap.barnCards > 0) {
      const spBtn = page.locator('[data-audit-region="admin-hub-farm-map"] button').filter({
        hasText: "후보돈사",
      });
      if ((await spBtn.count()) > 0) {
        await spBtn.first().click({ force: true });
        await page.waitForTimeout(2000);
        const drill = await page.evaluate(() => ({
          url: location.href,
          hasOpsPanel: !!document.querySelector('[data-audit-region="ops-controller-panel"]'),
          hasGraph: document.body.innerText.includes("온도 추이") || document.body.innerText.includes("그래프"),
        }));
        if (!drill.hasOpsPanel && !drill.url.includes("ctrl=") && !drill.url.includes("sp=SP")) {
          findings.push({ severity: "high", width: w, issue: "축사 클릭 drill 실패", ...drill });
        }
      }
    }
    await page.close();
  }

  const expandPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(expandPage);
  await expandPage.goto(`${BASE}/farm?tab=ops&lsind=FARM02&item=P00`, {
    waitUntil: "domcontentloaded",
  });
  await expandPage.waitForTimeout(4000);
  const expandBtn = expandPage.locator('[aria-label="지도 전체 화면 복원"]');
  if ((await expandBtn.count()) > 0) {
    await expandBtn.click({ force: true });
    await expandPage.waitForTimeout(1500);
    const after = await expandPage.evaluate(() => ({
      url: location.href,
      hasLsind: location.href.includes("lsind="),
      stack: document.querySelector('[data-audit-region="ops-hub-desktop-grid"]')?.getAttribute(
        "data-audit-stack"
      ),
    }));
    if (after.hasLsind)
      findings.push({ severity: "high", issue: "expand 후 lsind URL 잔존", ...after });
    if (after.stack === "1")
      findings.push({ severity: "medium", issue: "expand 후 stack=1", ...after });
  }
  await expandPage.close();

  const overviewPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(overviewPage);
  await overviewPage.goto(`${BASE}/farm?tab=ops`, { waitUntil: "domcontentloaded" });
  await overviewPage.waitForTimeout(4000);
  const overview = await overviewPage.evaluate(() => ({
    url: location.href,
    autoDrill: location.href.includes("ctrl="),
  }));
  if (overview.autoDrill)
    findings.push({ severity: "medium", issue: "bare ops URL auto drill", ...overview });
  await overviewPage.close();

  await browser.close();

  console.log(
    JSON.stringify(
      { findingCount: findings.length, findings },
      null,
      2
    )
  );
  process.exit(findings.some((f) => f.severity === "high") ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
