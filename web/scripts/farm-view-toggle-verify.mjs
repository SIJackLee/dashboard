#!/usr/bin/env node
/**
 * 그리드 ↔ 목록 토글 성능·shallow 검증
 * Usage: node scripts/farm-view-toggle-verify.mjs
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ensureTestPasswords, passwordForEmail, TEST_ACCOUNTS } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const MAX_COLD_LIST_MS = 1200;
const MAX_WARM_TOGGLE_MS = 450;
const MAX_RSC_FETCHES_PER_TOGGLE = 0;

async function login(page, email) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(passwordForEmail(email));
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}

async function benchmarkToggle(page, label) {
  const rscFetches = [];
  const onReq = (req) => {
    const u = req.url();
    if (u.includes("/farm") && req.resourceType() === "document") {
      rscFetches.push(u);
    }
  };
  page.on("request", onReq);

  await page.getByRole("tab", { name: "그리드" }).click();
  await page.waitForSelector("[data-grid-cell]", { timeout: 15000 });

  const t0 = Date.now();
  await page.getByRole("tab", { name: "목록" }).click({ noWaitAfter: true });
  await page.waitForFunction(
    () =>
      document.querySelector('[data-farm-view-panel="list"]')?.getAttribute("data-farm-view-active") ===
      "true",
    { timeout: 15000 }
  );
  const listMs = Date.now() - t0;

  const rscAfterList = rscFetches.length;
  rscFetches.length = 0;

  const t1 = Date.now();
  await page.getByRole("tab", { name: "그리드" }).click({ noWaitAfter: true });
  await page.waitForFunction(
    () =>
      document.querySelector('[data-farm-view-panel="map"]')?.getAttribute("data-farm-view-active") ===
      "true",
    { timeout: 15000 }
  );
  const mapMs = Date.now() - t1;

  const rscAfterMap = rscFetches.length;
  page.off("request", onReq);

  const round2ListStart = Date.now();
  await page.getByRole("tab", { name: "목록" }).click({ noWaitAfter: true });
  await page.waitForFunction(
    () =>
      document.querySelector('[data-farm-view-panel="list"]')?.getAttribute("data-farm-view-active") ===
      "true",
    { timeout: 15000 }
  );
  const list2Ms = Date.now() - round2ListStart;

  const pass =
    listMs <= MAX_COLD_LIST_MS &&
    mapMs <= MAX_WARM_TOGGLE_MS &&
    list2Ms <= MAX_WARM_TOGGLE_MS &&
    rscAfterList <= MAX_RSC_FETCHES_PER_TOGGLE &&
    rscAfterMap <= MAX_RSC_FETCHES_PER_TOGGLE;

  console.log(
    `${pass ? "PASS" : "FAIL"} [${label}] list=${listMs}ms map=${mapMs}ms list2=${list2Ms}ms rsc(list/map)=${rscAfterList}/${rscAfterMap}`
  );

  return { pass, listMs, mapMs, list2Ms, rscAfterList, rscAfterMap };
}

async function main() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  await ensureTestPasswords(adminClient);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await login(page, TEST_ACCOUNTS.admin.email);
  await page.goto(`${BASE}/farm?lsind=FARM01&item=P00`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-grid-cell]", { timeout: 30000 });

  const admin = await benchmarkToggle(page, "admin-scoped");
  await login(page, TEST_ACCOUNTS.operator.email);
  await page.goto(`${BASE}/farm`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-grid-cell]", { timeout: 30000 });
  const operator = await benchmarkToggle(page, "operator");

  await browser.close();

  const allPass = admin.pass && operator.pass;
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
