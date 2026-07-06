#!/usr/bin/env node
/**
 * Farm UI comprehensive verify — all accounts, map/list, listMode cycles,
 * dark grid (안 B), overflow, loading, panel expand.
 * Usage: node scripts/farm-comprehensive-ui-verify.mjs
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ensureTestPasswords, passwordForEmail, TEST_ACCOUNTS } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const LIST_MODES = ["controller", "graph", "settings", "channel"];
const MODE_LABELS = { controller: "컨트롤러", graph: "그래프", settings: "설정", channel: "모터그래프" };
const ACCOUNTS = [
  { role: "admin", email: TEST_ACCOUNTS.admin.email, farmPath: "/farm?lsind=FARM01&item=P00" },
  { role: "operator", email: TEST_ACCOUNTS.operator.email, farmPath: "/farm" },
  { role: "viewer", email: TEST_ACCOUNTS.viewer.email, farmPath: "/farm" },
];

const results = [];

function record(suite, name, pass, errors = [], meta = {}) {
  results.push({ suite, name, pass, errors, meta, at: new Date().toISOString() });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`${tag} [${suite}] ${name}`);
  for (const e of errors) console.log(`       ${e}`);
}

async function login(page, email) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(passwordForEmail(email));
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}

async function setDarkMode(page, dark) {
  const btn = page.getByRole("button", {
    name: dark ? "다크 모드로 전환" : "라이트 모드로 전환",
  });
  if ((await btn.count()) === 0) {
    await page.evaluate((isDark) => {
      document.documentElement.classList.toggle("dark", isDark);
      try {
        localStorage.setItem("dashboard-theme", isDark ? "dark" : "light");
      } catch {}
    }, dark);
    return;
  }
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  if (isDark !== dark) await btn.first().click();
  await page.waitForTimeout(300);
}

async function waitFarmReady(page, timeout = 25000) {
  const t0 = Date.now();
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText ?? "";
        if (/404|could not be found/i.test(t)) return false;
        return (
          document.querySelector("[data-grid-cell]") ||
          document.querySelector('[data-audit-region="barn-list-summary"]') ||
          document.querySelector('[aria-label="목록 보기 모드"]') ||
          t.includes("후보돈사") ||
          t.includes("축사")
        );
      },
      { timeout }
    )
    .catch(() => null);
  return Date.now() - t0;
}

function layoutAudit() {
  const html = document.documentElement;
  const overflowX = html.scrollWidth - html.clientWidth;
  const overflowY = html.scrollHeight - html.clientHeight;
  const issues = [];

  for (const el of document.querySelectorAll("h1, h2, h3, button, [role=tab]")) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > window.innerWidth + 4) {
      issues.push(`clip:${el.tagName}:${(el.textContent ?? "").slice(0, 20)}`);
    }
  }

  const broken = [...document.querySelectorAll("*")].filter((el) => {
    const s = getComputedStyle(el);
    return s.overflow === "visible" && el.scrollWidth > el.clientWidth + 8 && el.clientWidth > 40;
  }).length;

  return { overflowX, overflowY, clipCount: issues.length, clipSamples: issues.slice(0, 5), wideInner: broken };
}

function gridAudit() {
  const cell = document.querySelector("[data-grid-cell]");
  const grid = cell?.parentElement;
  if (!grid) return { hasGrid: false };
  const cs = getComputedStyle(grid);
  const isDark = document.documentElement.classList.contains("dark");
  const bgImg = cs.backgroundImage ?? "";
  const usesOldHex = bgImg.includes("e5e7eb") || bgImg.includes("rgb(229, 231, 235)");
  const usesBorderToken = bgImg.includes("hsl") || bgImg.includes("var(--border)");
  return {
    hasGrid: true,
    isDark,
    backgroundImage: bgImg.slice(0, 120),
    backgroundSize: cs.backgroundSize,
    backgroundColor: cs.backgroundColor,
    usesOldHex,
    usesBorderToken,
    gridW: grid.getBoundingClientRect().width,
    gridH: grid.getBoundingClientRect().height,
  };
}

async function clickListMode(page, mode) {
  const label = MODE_LABELS[mode];
  const tab = page.locator('[aria-label="목록 보기 모드"] button', { hasText: label });
  if ((await tab.count()) === 0) {
    const short =
      mode === "controller" ? "Ctrl" : mode === "graph" ? "Graph" : mode === "settings" ? "Set" : "모터";
    await page.locator('[aria-label="목록 보기 모드"] button', { hasText: short }).first().click();
  } else {
    await tab.first().click();
  }
  await page.waitForTimeout(600);
}

async function countMotorPanelsOpen(page) {
  return page.evaluate(() => {
    const shells = [...document.querySelectorAll('[data-barn-list-panel="motor"]')];
    return shells.filter((el) => el.getAttribute("data-open") === "true").length;
  });
}

async function runAccountSuite(page, account) {
  const suite = account.role;
  const pageErrors = [];
  page.removeAllListeners("pageerror");
  page.on("pageerror", (e) => {
    const m = e.message ?? String(e);
    if (m.includes("Invalid LatLng") || m.includes("_leaflet_pos")) return;
    if (m.includes("Hydration failed")) return;
    pageErrors.push(m);
  });

  await login(page, account.email);
  await setDarkMode(page, false);

  // --- Map view + grid B (dark) ---
  await page.goto(`${BASE}${account.farmPath}`, { waitUntil: "domcontentloaded" });
  const loadMs = await waitFarmReady(page);
  record(suite, "farm hub load", loadMs < 20000, loadMs >= 20000 ? [`slow load ${loadMs}ms`] : [], {
    loadMs,
  });

  const gridTab = page.getByRole("tab", { name: "그리드" });
  if ((await gridTab.count()) > 0) {
    await gridTab.click();
    await page.waitForTimeout(800);
  }

  await setDarkMode(page, true);
  await page.waitForTimeout(400);
  const darkGrid = await page.evaluate(gridAudit);
  record(
    suite,
    "map grid dark — 안 B (no #e5e7eb)",
    darkGrid.hasGrid && !darkGrid.usesOldHex,
    [
      !darkGrid.hasGrid ? "grid container missing" : null,
      darkGrid.usesOldHex ? "still uses #e5e7eb gradient" : null,
    ].filter(Boolean),
    darkGrid
  );

  const darkLayout = await page.evaluate(layoutAudit);
  record(
    suite,
    "map dark layout overflow",
    darkLayout.overflowX <= 2 && darkLayout.clipCount === 0,
    [
      darkLayout.overflowX > 2 ? `horizontal overflow ${darkLayout.overflowX}px` : null,
      darkLayout.clipCount > 0 ? `clipped elements: ${darkLayout.clipSamples.join("; ")}` : null,
    ].filter(Boolean),
    darkLayout
  );

  await setDarkMode(page, false);
  const lightGrid = await page.evaluate(gridAudit);
  record(suite, "map grid light renders", lightGrid.hasGrid, lightGrid.hasGrid ? [] : ["no grid"], lightGrid);

  // --- List view + 4 mode full cycle × 2 rounds ---
  const listTab = page.getByRole("tab", { name: "목록" });
  if ((await listTab.count()) === 0) {
    record(suite, "list view skip", true, [], { reason: "no list tab" });
    return;
  }

  await listTab.click();
  await page.waitForTimeout(1000);

  for (let round = 1; round <= 2; round++) {
    for (const mode of LIST_MODES) {
      const t0 = Date.now();
      await clickListMode(page, mode);
      const switchMs = Date.now() - t0;

      const urlMode = await page.evaluate(() => new URLSearchParams(location.search).get("listMode"));
      const isHub = await page.evaluate(() => {
        const p = new URLSearchParams(location.search);
        return p.has("lsind") && p.has("item");
      });

      const listModeAttr = await page
        .locator('[data-audit-region="barn-list-summary"]')
        .first()
        .getAttribute("data-list-mode")
        .catch(() => null);

      const layout = await page.evaluate(layoutAudit);
      const motorOpen = mode === "channel" ? await countMotorPanelsOpen(page) : null;

      const errors = [];
      if (listModeAttr !== mode) errors.push(`DOM data-list-mode ${listModeAttr} !== ${mode}`);
      if (switchMs > 8000) errors.push(`slow mode switch ${switchMs}ms`);
      if (layout.overflowX > 4) errors.push(`overflowX ${layout.overflowX}px in ${mode}`);
      if (layout.clipCount > 3) errors.push(`clip ${layout.clipCount} in ${mode}`);

      if (mode === "channel" && account.role !== "viewer") {
        const cards = await page.locator('[data-controller-summary-row]').count();
        if (cards > 0 && motorOpen === 0) {
          errors.push(`motor panels 0/${cards} after channel mode`);
        }
      }

      record(
        suite,
        `listMode ${mode} round${round}`,
        errors.length === 0,
        errors,
        { switchMs, motorOpen, listModeAttr, urlMode }
      );
    }
  }

  // settings → motor stress (5×)
  if (account.role !== "viewer") {
    await clickListMode(page, "settings");
    await page.waitForTimeout(400);
    for (let i = 0; i < 5; i++) {
      await clickListMode(page, "channel");
      await page.waitForTimeout(350);
      await clickListMode(page, "settings");
      await page.waitForTimeout(350);
    }
    await clickListMode(page, "channel");
    await page.waitForTimeout(500);
    const cards = await page.locator('[data-controller-summary-row]').count();
    const motorOpen = await countMotorPanelsOpen(page);
    record(
      suite,
      "settings→motor×5 stress",
      cards === 0 || motorOpen >= Math.min(cards, 1),
      cards > 0 && motorOpen < Math.min(cards, 1)
        ? [`motor open ${motorOpen}/${cards}`]
        : [],
      { cards, motorOpen }
    );
  }

  // map ↔ list toggle
  for (const v of ["map", "list"]) {
    const tab = page.getByRole("tab", { name: v === "map" ? "그리드" : "목록" });
    if ((await tab.count()) === 0) continue;
    const t0 = Date.now();
    await tab.click();
    await waitFarmReady(page, 15000);
    const ms = Date.now() - t0;
    const layout = await page.evaluate(layoutAudit);
    record(
      suite,
      `view toggle → ${v}`,
      ms < 12000 && layout.overflowX <= 4,
      [ms >= 12000 ? `slow ${ms}ms` : null, layout.overflowX > 4 ? `overflow ${layout.overflowX}px` : null].filter(
        Boolean
      ),
      { ms }
    );
  }

  // settings page
  const settingsLink = page.getByRole("link", { name: "설정" });
  if ((await settingsLink.count()) > 0) {
    await settingsLink.click();
    await page.waitForURL(/\/settings/, { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(600);
    const layout = await page.evaluate(layoutAudit);
    record(
      suite,
      "settings page layout",
      !page.url().includes("/login") && layout.overflowX <= 4,
      layout.overflowX > 4 ? [`overflow ${layout.overflowX}px`] : [],
      { url: page.url() }
    );
  }

  // admin ops (header nav — farm 페이지에서)
  if (account.role === "admin") {
    await page.goto(`${BASE}/farm`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const ops = page.getByRole("link", { name: "운영" });
    if ((await ops.count()) > 0) {
      await ops.first().click();
      await page.waitForURL(/\/admin\/ops/, { timeout: 15000 });
      record(suite, "admin ops nav", page.url().includes("/admin/ops"), [], {
        url: page.url(),
      });
    } else {
      record(suite, "admin ops nav skip", true, [], { reason: "no header nav" });
    }
  }

  if (account.role === "viewer") {
    await page.goto(`${BASE}/admin/ops`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const onAdmin = page.url().includes("/admin/ops");
    const body = await page.locator("body").innerText();
    const blocked =
      !onAdmin || body.includes("권한") || body.includes("접근") || page.url().includes("/farm");
    record(
      suite,
      "viewer admin access policy",
      blocked || !onAdmin,
      onAdmin && !blocked ? ["viewer can load /admin/ops — RBAC 미적용 (middleware)"] : [],
      { url: page.url(), note: onAdmin ? "known: middleware has no role gate" : "redirected" }
    );
  }

  record(
    suite,
    "no runtime pageerror",
    pageErrors.length === 0,
    pageErrors.slice(0, 5),
    { count: pageErrors.length }
  );

  page.removeAllListeners("pageerror");
}

async function main() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  await ensureTestPasswords(adminClient);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  for (const account of ACCOUNTS) {
    try {
      await runAccountSuite(page, account);
    } catch (e) {
      record(account.role, "suite uncaught", false, [String(e)]);
    }
  }

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  const out = join(dirname(fileURLToPath(import.meta.url)), "farm-comprehensive-ui-verify-results.json");
  writeFileSync(
    out,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        total: results.length,
        passed: results.length - failed.length,
        failed: failed.length,
        results,
      },
      null,
      2
    )
  );

  console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===`);
  console.log(`Results: ${out}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
