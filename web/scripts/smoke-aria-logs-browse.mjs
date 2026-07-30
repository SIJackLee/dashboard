#!/usr/bin/env node
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

try {
  await login(page, {
    base: BASE,
    email: TEST_ACCOUNTS.admin.email,
    password: passwordForEmail(TEST_ACCOUNTS.admin.email),
  });
  await page.goto(`${BASE}/admin/ops#aria-logs`, {
    waitUntil: "load",
    timeout: 30000,
  });
  await page.getByRole("heading", { name: "ARIA 턴 로그" }).waitFor({
    state: "visible",
    timeout: 20000,
  });
  await page.waitForTimeout(1000);

  const section = page.locator('[data-audit-region="aria-turn-logs"]');
  console.log("=== ALL ===");
  console.log(await section.innerText());

  await page.getByRole("button", { name: "FARM", exact: true }).click();
  await page.waitForTimeout(1500);
  console.log("=== FARM ===");
  console.log(await section.innerText());

  await page.getByRole("button", { name: "CHAT", exact: true }).click();
  await page.getByText("기록이 없습니다").waitFor({ timeout: 10000 });
  console.log("=== CHAT ===");
  console.log(await section.innerText());
} finally {
  await browser.close();
}
