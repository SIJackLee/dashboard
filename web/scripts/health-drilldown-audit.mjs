#!/usr/bin/env node
/**
 * Admin ops health drill-down — ?node= dialog, ?farm=&modules=1 farm panel.
 * Usage: node scripts/health-drilldown-audit.mjs
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
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
const VIEWPORT = { width: 1280, height: 900 };

async function auditNodeDialog(page) {
  await page.goto(`${BASE}/admin/ops?node=storage`, { waitUntil: "load" });
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 30000 });
  await dialog.getByRole("heading", { name: "데이터 저장소" }).waitFor({ timeout: 10000 });
  await dialog.getByText("storage").waitFor({ timeout: 10000 });
  return { ok: true, node: "storage" };
}

async function auditFarmModulesPanel(page) {
  await page.goto(`${BASE}/admin/ops?farm=FARM01--P00&modules=1`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "접기" }).waitFor({ timeout: 15000 });
  // 기본 필터가「이상만」이라 정상 FARM01은 숨겨짐 →「전체」필수
  await page.getByRole("button", { name: "전체", exact: true }).click({
    force: true,
  });
  // desktop table + mobile list 둘 다 data-health-farm-id 보유
  const row = page.locator('[data-health-farm-id^="FARM01"]').first();
  await row.waitFor({ state: "attached", timeout: 20000 });
  const farmId = await row.getAttribute("data-health-farm-id");
  if (!farmId) {
    throw new Error("health farm row에 data-health-farm-id 없음");
  }
  return { ok: true, farm: farmId };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await ensureTestPasswords(admin);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const results = {};

  try {
    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.admin.email,
      password: passwordForEmail(TEST_ACCOUNTS.admin.email),
    });

    results.nodeDialog = await auditNodeDialog(page);
    console.log("Health node dialog OK — storage");

    results.farmPanel = await auditFarmModulesPanel(page);
    console.log("Health farm panel OK — FARM01--P00 highlight");

    const outDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "mobile-audit-output"
    );
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, "health-drilldown-report.json"),
      JSON.stringify({ ok: true, at: new Date().toISOString(), results }, null, 2)
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
