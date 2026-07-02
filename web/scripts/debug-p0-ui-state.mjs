#!/usr/bin/env node
import dotenv from "dotenv";
import { chromium } from "playwright";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { passwordForEmail } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/login`);
await page.locator("#email").fill("admin@test.com");
await page.locator("#password").fill(passwordForEmail("admin@test.com"));
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
await page.goto(`${BASE}/farm?tab=ops&lsind=FARM02&item=P00`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(6000);

const r = await page.evaluate(() => {
  const body = document.body.innerText || "";
  const hub = document.querySelector('[data-audit-region="admin-hub-farm-map"]');
  const buttons = hub
    ? [...hub.querySelectorAll("button")].map((b) => b.innerText.slice(0, 60))
    : [];
  return {
    url: location.href,
    hasEmptyFarmList: body.includes("표시할 농장이 없습니다"),
    hasEmptyBarn: body.includes("LIVE 데이터에 stallNo"),
    hasBarnName: body.includes("후보돈사") || body.includes("임신사"),
    barnButtons: buttons.slice(0, 8),
    barnButtonCount: buttons.length,
    stack: document.querySelector('[data-audit-region="ops-hub-desktop-grid"]')?.getAttribute(
      "data-audit-stack"
    ),
    treeFarmLabels: [...document.querySelectorAll("section button")].slice(0, 5).map((b) => b.innerText.slice(0, 30)),
  };
});

console.log(JSON.stringify(r, null, 2));
await browser.close();
