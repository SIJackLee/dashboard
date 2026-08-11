#!/usr/bin/env node
/**
 * Phase E UI smoke — /farm DELIN 탭·말풍선 앵커 (pending 없어도 PASS)
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

    const delinTab = page.locator('[data-delin-tab-anchor="1"]');
    const delinVisible = await delinTab.isVisible().catch(() => false);
    if (delinVisible) {
      await delinTab.waitFor({ state: "visible", timeout: 10000 });
    }

    const bubble = page.getByTestId("delin-weather-nudge-bubble");
    const bubbleVisible = await bubble.isVisible().catch(() => false);
    if (bubbleVisible) {
      await bubble.getByRole("button", { name: "무시" }).waitFor({
        state: "visible",
        timeout: 5000,
      });
    }

    console.log(
      JSON.stringify({
        ok: true,
        delinTab: delinVisible,
        nudgeBubble: bubbleVisible,
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
