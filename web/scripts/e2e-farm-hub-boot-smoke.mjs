#!/usr/bin/env node
/**
 * farm 허브 부트 스모크 (미인증 · 시크릿 불필요 · CI 친화)
 *
 * 인증 기반 심화 시나리오는 `npm run smoke:hub-url`(test-accounts 필요).
 * 이 스모크는 앱이 뜨고 미들웨어 가드가 동작하는지만 빠르게 확인한다:
 *   1) 미인증 `/farm` 진입 → `/login` 리다이렉트 (search 유지)
 *   2) `/login` 렌더 — 입력 필드 존재
 *
 * Usage:
 *   UI_VERIFY_BASE=http://localhost:3000 npm run smoke:boot
 *   UI_VERIFY_BASE=https://<preview>.vercel.app npm run smoke:boot
 * (서버가 떠 있어야 하며, chromium 미설치 시 `npx playwright install chromium`)
 */
import { chromium } from "playwright";

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const NAV_TIMEOUT = 30000;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function launchChromium() {
  try {
    return await chromium.launch({ headless: true, channel: "chrome" });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

async function main() {
  const browser = await launchChromium();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);
  const results = [];

  try {
    // —— 1) 미인증 /farm → /login 리다이렉트 ——
    await page.goto(`${BASE}/farm?lsind=FARM01&item=P00`, {
      waitUntil: "load",
    });
    await page
      .waitForURL((u) => u.pathname.startsWith("/login"), {
        timeout: NAV_TIMEOUT,
      })
      .catch(() => {});
    const guarded = new URL(page.url());
    assert(
      guarded.pathname.startsWith("/login"),
      `1: 미인증 /farm 은 /login 으로 가야 함 (현재 ${guarded.pathname})`,
    );
    results.push("boot 1: unauthenticated /farm → /login — PASS");

    // —— 2) /login 렌더 — 입력 필드 존재 ——
    await page.goto(`${BASE}/login`, { waitUntil: "load" });
    const inputCount = await page.locator("input").count();
    assert(inputCount > 0, "2: /login 에 입력 필드가 없음");
    results.push("boot 2: /login renders input fields — PASS");

    for (const line of results) console.log(line);
    console.log("e2e-farm-hub-boot-smoke: all PASS");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message || err);
  process.exit(1);
});
