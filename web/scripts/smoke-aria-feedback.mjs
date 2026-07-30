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
  await page.waitForTimeout(1200);

  const region = page.locator('[data-audit-region="aria-turn-logs"]');
  // 필터 칩이 아닌 행 버튼만
  const rowOk = region.getByRole("button", { name: "맞음으로 표시" }).first();
  await rowOk.waitFor({ state: "visible", timeout: 15000 });
  await rowOk.click();

  const cancel = region.getByRole("button", { name: "검수 취소" }).first();
  await cancel.waitFor({ state: "visible", timeout: 15000 });

  const err = region.locator("p.text-destructive");
  if ((await err.count()) > 0 && (await err.first().isVisible())) {
    console.error("FAIL:", await err.first().innerText());
    process.exit(1);
  }
  console.log("PASS: row feedback mark ok (취소 visible)");
} finally {
  await browser.close();
}
