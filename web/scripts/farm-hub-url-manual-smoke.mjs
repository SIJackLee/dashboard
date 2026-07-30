#!/usr/bin/env node
/**
 * `/farm` 허브 URL 수동 스모크 (로그인 후 Playwright)
 * 1) 차트 딥링크 · 새로고침 유지
 * 2) 로고 soft home — chart* 제거 · 기간 유지
 * 3) 차트에서 기간 변경 — 탭·범위 유지 (그리드 안 튐)
 * 4) listMode=channel → graph 정규화
 *
 * Usage:
 *   node scripts/farm-hub-url-manual-smoke.mjs
 *   UI_VERIFY_BASE=https://<preview>.vercel.app node scripts/farm-hub-url-manual-smoke.mjs
 *
 * Vercel 배포본 검증: Git 연동 Preview/Production URL을 UI_VERIFY_BASE로 지정.
 * (로컬 .env.local의 Supabase와 배포 환경이 같은 프로젝트여야 테스트 계정 로그인 가능)
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  ensureTestPasswords,
  passwordForEmail,
  TEST_ACCOUNTS,
} from "./test-accounts.mjs";
import { login } from "./audit-shared.mjs";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const FARM_Q = "lsind=FARM01&item=P00";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function qs(url) {
  return new URL(url).searchParams;
}

async function waitFarmReady(page) {
  await page.waitForURL((u) => u.pathname.startsWith("/farm"), {
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && key, "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await ensureTestPasswords(admin);

  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
  } catch {
    browser = await chromium.launch({ headless: true });
  }

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  const results = [];

  try {
    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.operator.email,
      password: passwordForEmail(TEST_ACCOUNTS.operator.email),
    });

    // —— 1) 차트 딥링크 · reload ——
    const chartPath = `/farm?${FARM_Q}&view=chart&trendPeriod=7d&chartSp=SP03&chartStall=1`;
    await page.goto(`${BASE}${chartPath}`, { waitUntil: "load" });
    await waitFarmReady(page);
    await page
      .locator('[data-farm-view-panel="chart"][data-farm-view-active="true"]')
      .waitFor({ timeout: 15000 });

    let p = qs(page.url());
    assert(p.get("view") === "chart", "1a: view=chart");
    assert(p.get("trendPeriod") === "7d", "1a: trendPeriod=7d");
    assert(p.get("chartSp") === "SP03", "1a: chartSp");
    assert(p.get("chartStall") === "1", "1a: chartStall");

    await page.reload({ waitUntil: "load" });
    await waitFarmReady(page);
    await page
      .locator('[data-farm-view-panel="chart"][data-farm-view-active="true"]')
      .waitFor({ timeout: 15000 });
    p = qs(page.url());
    assert(p.get("view") === "chart", "1b reload: view=chart");
    assert(p.get("chartSp") === "SP03", "1b reload: chartSp");
    assert(p.get("chartStall") === "1", "1b reload: chartStall");
    assert(p.get("trendPeriod") === "7d", "1b reload: trendPeriod");
    results.push("smoke 1: chart deeplink reload — PASS");

    // —— 2) 로고 soft home ——
    await page.getByRole("link", { name: "모니터링 홈" }).click();
    await page.waitForTimeout(1200);
    p = qs(page.url());
    assert(!p.get("view"), "2: view cleared (map)");
    assert(!p.get("chartSp"), "2: chartSp cleared");
    assert(!p.get("chartStall"), "2: chartStall cleared");
    assert(p.get("lsind") === "FARM01", "2: lsind kept");
    assert(p.get("item") === "P00", "2: item kept");
    assert(p.get("trendPeriod") === "7d", "2: trendPeriod kept");
    await page
      .locator('[data-farm-view-panel="map"][data-farm-view-active="true"]')
      .waitFor({ timeout: 10000 });
    results.push("smoke 2: soft home (logo) — PASS");

    // —— 3) 기간 변경 시 차트 유지 ——
    await page.goto(
      `${BASE}/farm?${FARM_Q}&view=chart&trendPeriod=7d&chartSp=SP03&chartStall=1`,
      { waitUntil: "load" },
    );
    await waitFarmReady(page);
    await page
      .locator('[data-farm-view-panel="chart"][data-farm-view-active="true"]')
      .waitFor({ timeout: 15000 });

    const periodGroup = page
      .locator('[role="group"][aria-label="추이 기간"]')
      .first();
    await periodGroup.getByRole("button", { name: "30일" }).click();
    await page.waitForTimeout(1500);

    p = qs(page.url());
    assert(p.get("view") === "chart", "3: still view=chart (no jump to map)");
    assert(p.get("trendPeriod") === "30d", "3: trendPeriod=30d");
    assert(p.get("chartSp") === "SP03", "3: chartSp kept");
    assert(p.get("chartStall") === "1", "3: chartStall kept");
    await page
      .locator('[data-farm-view-panel="chart"][data-farm-view-active="true"]')
      .waitFor({ timeout: 5000 });
    results.push("smoke 3: period keeps chart+scope — PASS");

    // —— 4) listMode=channel 정규화 ——
    await page.goto(
      `${BASE}/farm?${FARM_Q}&view=list&listMode=channel`,
      { waitUntil: "load" },
    );
    await waitFarmReady(page);
    await page
      .locator('[data-farm-view-panel="list"][data-farm-view-active="true"]')
      .waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    p = qs(page.url());
    assert(p.get("view") === "list", "4: view=list");
    assert(p.get("listMode") === "graph", "4: channel→graph normalized");
    results.push("smoke 4: listMode=channel normalize — PASS");

    for (const line of results) console.log(line);
    console.log("farm-hub-url-manual-smoke: all PASS");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message || err);
  process.exit(1);
});
