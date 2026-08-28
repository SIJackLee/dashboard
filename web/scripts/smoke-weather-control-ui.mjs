#!/usr/bin/env node
/**
 * Phase E UI smoke — /farm DELIN 뱃지 (게이트 off·미노출이어도 PASS)
 * Usage: node scripts/smoke-weather-control-ui.mjs  (dev 서버 실행 중)
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { login } from "./audit-shared.mjs";
import { passwordForEmail, TEST_ACCOUNTS } from "./test-accounts.mjs";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const FARM_MAP = `${BASE}/farm?lsind=FARM01&item=P00&view=map`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.admin.email,
      password: passwordForEmail(TEST_ACCOUNTS.admin.email),
    });

    await page.goto(FARM_MAP, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(2000);

    const badge = page.getByTestId("delin-env-badge");
    const badgeVisible = await badge.isVisible().catch(() => false);

    console.log(
      JSON.stringify({
        ok: true,
        delinBadge: badgeVisible,
      }),
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
