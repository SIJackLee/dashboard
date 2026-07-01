#!/usr/bin/env node
/**
 * Farmer /farm — viewport width regression (layout + graph + bulk modal).
 * Usage: node scripts/farm-width-verify.mjs
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ensureTestPasswords, passwordForEmail } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const WIDTHS = [375, 640, 768, 900, 1023, 1024, 1280, 1600];

async function login(page) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  if (!page.url().includes("/login")) return;
  await page.locator("#email").fill("farmer@test.com");
  await page.locator("#password").fill(passwordForEmail("farmer@test.com"));
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}

async function waitMapReady(page) {
  await page.waitForFunction(
    () =>
      document.querySelector('[data-audit-region="farm-map-list"]') ||
      document.querySelector("[data-audit-desktop-only]"),
    { timeout: 30000 }
  );
  await page.waitForTimeout(600);
}

async function auditLayout(page) {
  return page.evaluate(() => {
    const cs = (el) => (el ? getComputedStyle(el).display : null);
    const desktop = document.querySelector("[data-audit-desktop-only]");
    const mobileList = document.querySelector('[data-audit-region="farm-map-mobile-list"]');
    const bottomNav = document.querySelector('nav[aria-label="모바일 앱 메뉴"]');
    const bulkSwitch = document.querySelector('[role="switch"][aria-label*="일괄적용"]');
    const html = document.documentElement;
    return {
      innerWidth: window.innerWidth,
      shellCompact: document.querySelector("[data-dashboard-compact]") != null,
      pageOverflowX: html.scrollWidth - html.clientWidth,
      hasDesktop: !!desktop,
      desktopDisplay: cs(desktop),
      hasMobileList: !!mobileList,
      mobileListDisplay: cs(mobileList),
      bottomNavDisplay: cs(bottomNav),
      bulkVisible: bulkSwitch ? cs(bulkSwitch) !== "none" : false,
      listCards: document.querySelectorAll('[data-audit-region="farm-map-list"] > div').length,
    };
  });
}

async function testMobileGraphFlow(page) {
  return page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const clickBtn = (txt, root = document) => {
      const b = [...root.querySelectorAll("button")].find((x) =>
        x.textContent?.includes(txt)
      );
      if (b) {
        b.click();
        return true;
      }
      return false;
    };
    const list = document.querySelector('[data-audit-region="farm-map-list"]');
    if (!list) return { skipped: true, reason: "no mobile list" };
    if (!clickBtn("임신사", list)) return { graphOpen: false, reason: "card not found" };
    await sleep(500);
    const graph = document.querySelector('[data-audit-region="farm-map-mobile-graph"]');
    if (!graph) return { graphOpen: false };
    clickBtn("축사번호별", graph);
    await sleep(400);
    const ctrl = [...graph.querySelectorAll("button")].find((b) =>
      b.textContent?.trim().startsWith("컨트롤러")
    );
    if (ctrl) {
      ctrl.scrollIntoView({ block: "center" });
      ctrl.click();
    }
    await sleep(900);
    const controllerOpen = document.body.textContent?.includes("그래프");
    if (controllerOpen) clickBtn("그래프");
    await sleep(400);
    clickBtn("지도", graph);
    await sleep(400);
    return {
      graphOpen: true,
      controllerOpen,
      backToList: !!document.querySelector('[data-audit-region="farm-map-mobile-list"]'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function testDesktopGraphFlow(page) {
  return page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const desktop = document.querySelector("[data-audit-desktop-only]");
    if (!desktop) return { skipped: true, reason: "no desktop grid" };
    const card = [...desktop.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("임신사")
    );
    if (!card) return { graphOpen: false, reason: "card not found" };
    card.click();
    await sleep(600);
    const graphOpen = [...desktop.querySelectorAll("button")].some((b) =>
      b.textContent?.includes("지도")
    );
    if (graphOpen) {
      const back = [...desktop.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("지도")
      );
      back?.click();
      await sleep(400);
    }
    return {
      graphOpen,
      backToGrid: [...desktop.querySelectorAll('[role="switch"]')].some((s) =>
        s.getAttribute("aria-label")?.includes("일괄적용")
      ),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function testBulkModal(page) {
  const sw = page.getByRole("switch", { name: /일괄적용/ });
  if (!(await sw.isVisible())) return { skipped: true, reason: "bulk switch hidden" };

  await sw.click();
  await page.waitForTimeout(300);

    const isDesktop = await page.evaluate(
      () => !!document.querySelector("[data-audit-desktop-only]")
    );
    const card = isDesktop
      ? page.locator("[data-audit-desktop-only] button", { hasText: "임신사" }).first()
      : page.locator('[data-audit-region="farm-map-list"] button', { hasText: "임신사" }).first();
  await card.click();
  await page.waitForTimeout(300);

  const setup = page.getByRole("button", { name: "설정 입력" });
  const setupEnabled = await setup.isEnabled();
  if (!setupEnabled) {
    await sw.click();
    return { modalOpen: false, footerOk: false, reason: "setup disabled" };
  }
  await setup.click();
  await page.waitForTimeout(600);

  const dialog = page.getByRole("dialog", { name: "컨트롤러 일괄 설정" });
  const modalOpen = await dialog.isVisible();
  const footerOk = modalOpen
    ? (await dialog.textContent())?.includes("체크한 항목만") ||
      (await dialog.textContent())?.includes("적용할 항목")
    : false;
  const metrics = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const html = document.documentElement;
    return {
      dialogOverflow: d ? d.scrollWidth - d.clientWidth : 0,
      pageOverflow: html.scrollWidth - html.clientWidth,
    };
  });
  if (modalOpen) await page.getByRole("button", { name: "닫기" }).click();
  await page.waitForTimeout(200);
  if ((await sw.getAttribute("aria-checked")) === "true") await sw.click();

  return { modalOpen, footerOk, ...metrics };
}

async function main() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  await ensureTestPasswords(adminClient);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page);

  const report = [];

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/farm`, { waitUntil: "domcontentloaded" });
    await waitMapReady(page);

    const layout = await auditLayout(page);
    const isMobile = width < 1024;
    const flow = isMobile
      ? await testMobileGraphFlow(page)
      : await testDesktopGraphFlow(page);

    await page.goto(`${BASE}/farm`, { waitUntil: "domcontentloaded" });
    await waitMapReady(page);
    const bulk = await testBulkModal(page);

    const issues = [];
    if (layout.pageOverflowX > 0) issues.push(`pageOverflowX=${layout.pageOverflowX}`);
    if (isMobile && !layout.hasMobileList) issues.push("mobile list missing");
    if (isMobile && layout.hasDesktop) issues.push("desktop grid mounted on mobile");
    if (!isMobile && !layout.hasDesktop) issues.push("desktop grid missing");
    if (isMobile && layout.hasMobileList && layout.mobileListDisplay === "none")
      issues.push("mobile list hidden");
    if (isMobile && !layout.shellCompact) issues.push("shell not compact");
    if (!isMobile && layout.shellCompact) issues.push("shell compact on desktop");
    if (isMobile && layout.bottomNavDisplay === "none") issues.push("bottom nav missing");
    if (!isMobile && layout.bottomNavDisplay !== "none" && layout.bottomNavDisplay != null)
      issues.push("bottom nav on desktop");
    if (flow.graphOpen === false && !flow.skipped) issues.push("graph flow failed");
    if (isMobile && flow.graphOpen && flow.controllerOpen === false)
      issues.push("controller flow failed");
    if (bulk.modalOpen === false && !bulk.skipped && !bulk.reason)
      issues.push("bulk modal failed");
    if ((bulk.dialogOverflow ?? 0) > 0) issues.push("dialog overflow");
    if ((bulk.pageOverflow ?? 0) > 0) issues.push("bulk page overflow");

    const row = { width, layout, flow, bulk, issues, pass: issues.length === 0 };
    report.push(row);
    console.log(
      `${row.pass ? "PASS" : "FAIL"} ${width}px — issues: ${issues.length ? issues.join(", ") : "none"}`
    );
  }

  await browser.close();
  console.log("\n" + JSON.stringify(report, null, 2));
  process.exit(report.some((r) => !r.pass) ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
