#!/usr/bin/env node
import dotenv from "dotenv";
import { chromium } from "playwright";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { passwordForEmail } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 768, height: 900 } });
await page.goto("http://localhost:3000/login");
await page.locator("#email").fill("admin@test.com");
await page.locator("#password").fill(passwordForEmail("admin@test.com"));
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"));
await page.goto("http://localhost:3000/farm?tab=ops&lsind=FARM02&item=P00");
await page.waitForTimeout(5000);
const btn = page
  .locator('[data-audit-region="admin-hub-farm-map"] button')
  .filter({ hasText: "후보돈사" })
  .first();
console.log("btn count", await btn.count());
await btn.click({ force: true });
await page.waitForTimeout(3000);
console.log(
  JSON.stringify(
    await page.evaluate(() => ({
      url: location.href,
      ops: !!document.querySelector('[data-audit-region="ops-controller-panel"]'),
      grid: !!document.querySelector('[data-audit-region="admin-hub-farm-map"]'),
      snippet: document.body.innerText.slice(0, 500),
    })),
    null,
    2
  )
);
await browser.close();
