#!/usr/bin/env node
/**
 * Account × viewport — controller UI (farm in-grid + admin ops panel).
 * Usage: UI_VERIFY_BASE=http://localhost:3000 node scripts/controller-width-verify.mjs
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ensureTestPasswords, passwordForEmail, TEST_ACCOUNTS } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const WIDTHS = [375, 768, 1024, 1280];

async function login(page, email) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  if (!page.url().includes("/login")) return;
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(passwordForEmail(email));
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}

function pageOverflow() {
  const html = document.documentElement;
  return html.scrollWidth - html.clientWidth;
}

async function waitFarmMapReady(page) {
  await page.waitForFunction(
    () =>
      document.querySelector('[data-audit-region="farm-map-list"]') ||
      document.querySelector("[data-audit-desktop-only]"),
    { timeout: 30000 }
  );
  await page.waitForTimeout(400);
}

async function assertFarmControllerPanel(page) {
  const panel = page.locator('[data-audit-region="farm-map-controller"]');
  await panel.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-audit-region="farm-map-controller"]');
      if (!el) return false;
      const t = el.textContent ?? "";
      if (t.includes("상세 데이터 불러오는 중")) return false;
      return t.includes("설정값") && t.includes("모니터");
    },
    { timeout: 20000 }
  );

  const saveCount = await panel.getByRole("button", { name: "저장" }).count();
  const saveEnabled =
    saveCount > 0 &&
    (await panel.getByRole("button", { name: "저장" }).first().isEnabled());
  const overflow = await page.evaluate(pageOverflow);
  const backGraph = panel.getByRole("button", { name: "그래프" });
  const hasBack = (await backGraph.count()) > 0;

  return { saveEnabled, overflow, hasBack, panelVisible: true };
}

async function openFarmMapController(page) {
  await waitFarmMapReady(page);

  const isDesktop = await page.evaluate(
    () => !!document.querySelector("[data-audit-desktop-only]")
  );
  const cardSelector = isDesktop
    ? "[data-audit-desktop-only] button"
    : '[data-audit-region="farm-map-list"] button';

  const card = page.locator(cardSelector, { hasText: "임신사" }).first();
  if ((await card.count()) === 0) {
    return { ok: false, reason: "임신사 카드 없음" };
  }
  await card.click();
  await page.waitForTimeout(700);

  const drill = page.getByRole("button", { name: "축사번호별" }).first();
  if ((await drill.count()) === 0) {
    return { ok: false, reason: "축사번호별 버튼 없음" };
  }
  await drill.click();
  await page.waitForTimeout(500);

  const ctrlBtn = page
    .locator("button", { hasText: "컨트롤러" })
    .filter({ hasNot: page.locator("[disabled]") })
    .first();

  if ((await ctrlBtn.count()) === 0) {
    return { ok: false, reason: "활성 컨트롤러 버튼 없음" };
  }
  await ctrlBtn.scrollIntoViewIfNeeded();
  await ctrlBtn.click();

  try {
    const panelState = await assertFarmControllerPanel(page);
    if (panelState.hasBack) {
      await page
        .locator('[data-audit-region="farm-map-controller"]')
        .getByRole("button", { name: "그래프" })
        .first()
        .click();
    }
    await page.waitForTimeout(400);

    return {
      ok: true,
      overflow: panelState.overflow,
      saveEnabled: panelState.saveEnabled,
    };
  } catch (e) {
    return { ok: false, reason: e.message?.slice(0, 80) ?? "panel timeout" };
  }
}

function visibleOpsPanel(page) {
  return page
    .locator('[data-audit-region="ops-controller-panel"]')
    .filter({ visible: true })
    .first();
}

async function openAdminOpsController(page, width) {
  await page.goto(`${BASE}/farm?tab=ops`, {
    waitUntil: "domcontentloaded",
  });

  try {
    await page.waitForFunction(
      () => {
        const t = document.body.textContent ?? "";
        return (
          t.includes("온도 설정") ||
          t.includes("환기량") ||
          location.search.includes("ctrl=")
        );
      },
      { timeout: 30000 }
    );
  } catch {
    if (width < 1024) {
      const spBtn = page
        .locator("div.lg\\:hidden .grid button")
        .filter({ hasText: /임신|비육|분만/ })
        .first();
      if ((await spBtn.count()) > 0) {
        await spBtn.click();
        await page.waitForTimeout(800);
      }
    }
    await page.waitForFunction(
      () => {
        const t = document.body.textContent ?? "";
        return t.includes("온도 설정") || t.includes("환기량");
      },
      { timeout: 15000 }
    ).catch(() => null);
  }

  const bodyOk = await page.evaluate(() => {
    const t = document.body.textContent ?? "";
    return t.includes("온도 설정") || t.includes("환기량");
  });
  if (!bodyOk) {
    return { ok: false, reason: "ops 컨트롤러 패널 로드 timeout" };
  }

  const overflow = await page.evaluate(pageOverflow);
  return { ok: true, overflow };
}

async function verifyAccount(page, accountKey, width) {
  const email = TEST_ACCOUNTS[accountKey].email;
  const issues = [];
  const details = {};

  await page.setViewportSize({ width, height: 900 });
  await login(page, email);

  if (accountKey === "admin") {
    const ops = await openAdminOpsController(page, width);
    details.ops = ops;
    if (!ops.ok) issues.push(ops.reason ?? "admin ops controller failed");
    if ((ops.overflow ?? 0) > 0) issues.push(`overflowX=${ops.overflow}`);
    return { accountKey, width, issues, details, pass: issues.length === 0 };
  }

  await page.goto(`${BASE}/farm`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("tab=ops")) {
    issues.push("operator/viewer ops redirect 실패");
  }

  const farm = await openFarmMapController(page);
  details.farm = farm;
  if (!farm.ok) issues.push(farm.reason ?? "farm controller failed");
  if ((farm.overflow ?? 0) > 0) issues.push(`farm overflowX=${farm.overflow}`);

  if (accountKey === "viewer" && farm.saveEnabled) {
    issues.push("viewer 저장 버튼 활성(읽기전용 위반)");
  }

  return { accountKey, width, issues, details, pass: issues.length === 0 };
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

  page.on("pageerror", (e) => {
    const msg = e.message;
    if (msg.includes("Invalid LatLng") || msg.includes("_leaflet_pos")) return;
    if (msg.includes("Hydration failed")) return;
    console.error(`PAGEERROR: ${msg.slice(0, 120)}`);
  });

  const report = [];
  for (const accountKey of ["operator", "admin", "viewer"]) {
    for (const width of WIDTHS) {
      const row = await verifyAccount(page, accountKey, width);
      report.push(row);
      console.log(
        `${row.pass ? "PASS" : "FAIL"} [${accountKey}] ${width}px — ${
          row.issues.length ? row.issues.join("; ") : "ok"
        }`
      );
    }
  }

  await browser.close();
  console.log("\n" + JSON.stringify(report, null, 2));
  process.exit(report.some((r) => !r.pass) ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
