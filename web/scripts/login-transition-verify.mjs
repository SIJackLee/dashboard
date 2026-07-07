import { chromium } from "playwright";
import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { TEST_ACCOUNTS } from "./test-accounts.mjs";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.context().clearCookies();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.locator("#email").fill(TEST_ACCOUNTS.admin.email);
await page.locator("#password").fill(TEST_ACCOUNTS.admin.password);

let overlaySeen = false;
const overlayWatch = page
  .waitForSelector('[aria-busy="true"]', { timeout: 8000 })
  .then(() => {
    overlaySeen = true;
  })
  .catch(() => {});

await page.locator('button[type="submit"]').click();
await overlayWatch;
await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
  timeout: 30000,
});

await page.waitForSelector('nav[aria-label="앱 메뉴"]', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(500);

const finalPath = new URL(page.url()).pathname;
const hasNav = await page.locator('nav[aria-label="앱 메뉴"]').count();
const hasOverlay = await page
  .locator('[role="status"][aria-busy="true"]')
  .filter({ hasText: "이동 중" })
  .count();
const bodyText = await page.locator("body").innerText();

const result = {
  overlaySeen,
  overlayStillVisible: hasOverlay > 0,
  finalPath,
  hasNav: hasNav > 0,
  h1: await page.locator("h1").first().innerText().catch(() => ""),
  bodySnippet: bodyText.slice(0, 300),
  ok: finalPath === "/farm" && hasNav > 0 && overlaySeen && hasOverlay === 0,
};

console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(result.ok ? 0 : 1);
