#!/usr/bin/env node
/**
 * 상세 재검수 — hub TTFB · flat 소속 · ACK 문구 샘플.
 * Usage: node scripts/detailed-reverify.mjs  (dev 서버 실행 중)
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
import {
  login,
  openListControllerSettings,
  applyFromSettingsPanel,
} from "./audit-shared.mjs";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const VIEWPORT = { width: 1280, height: 900 };

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function measureHubTtfb(page) {
  await login(page, {
    base: BASE,
    email: TEST_ACCOUNTS.admin.email,
    password: passwordForEmail(TEST_ACCOUNTS.admin.email),
  });

  // 로그인 직후 warm overview 가정 — /farm document 응답 시각
  const t0 = Date.now();
  const resp = await page.goto(`${BASE}/farm`, { waitUntil: "domcontentloaded" });
  const ttfbMs = Date.now() - t0;
  const status = resp?.status() ?? 0;
  assert(status === 200, `admin /farm status ${status}`);

  await page.waitForTimeout(4000);
  const body = await page.locator("body").innerText();
  const hasBarns =
    /임신사/.test(body) && /분만사/.test(body) && /자돈사/.test(body);
  const stuckLoading =
    /불러오는 중/.test(body) && !/임신사/.test(body);

  return {
    ttfbMs,
    status,
    hasBarns,
    stuckLoading,
    pass: status === 200 && hasBarns && !stuckLoading && ttfbMs < 3000,
  };
}

async function checkFlatAffiliation(page) {
  await page.goto(`${BASE}/farm?lsind=FARM01&item=P00&view=list`, {
    waitUntil: "load",
  });
  await page.waitForSelector('[data-audit-region="barn-list-summary"]', {
    timeout: 45000,
  });
  await page.waitForTimeout(2000);

  const layout = await page
    .locator('[data-audit-region="barn-list-summary"]')
    .getAttribute("data-list-layout");
  const text = await page
    .locator('[data-audit-region="barn-list-summary"]')
    .innerText();

  // flat이면 showAffiliation → "임신사 · 축사" 형태
  const affiliationOk =
    layout === "group" ||
    /임신사\s*·\s*축사|분만사\s*·\s*축사|자돈사\s*·\s*축사/.test(text);

  return {
    layout,
    affiliationOk,
    sample: text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /임신사|분만사|자돈사/.test(l))
      .slice(0, 8),
    pass: affiliationOk,
  };
}

async function checkAckTitles(page) {
  await page.context().clearCookies();
  await login(page, {
    base: BASE,
    email: TEST_ACCOUNTS.operator.email,
    password: passwordForEmail(TEST_ACCOUNTS.operator.email),
  });
  await page.goto(`${BASE}/farm?lsind=FARM01&item=P00&view=list`, {
    waitUntil: "load",
  });
  await openListControllerSettings(page);
  const panel = page
    .locator('[data-audit-region="barn-list-accordion-panel"]')
    .first();
  const result = await applyFromSettingsPanel(page, panel);
  const known =
    /명령 등록|전송 대기|장치 ACK|현장 확인|현장 반영|LIVE 설정/.test(
      result.ack,
    );
  return {
    ack: result.ack,
    setpoint: result.setpoint,
    pass: known,
  };
}

async function checkHydrationDoc() {
  const { readFileSync } = await import("fs");
  const doc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../docs/SHIP_CHECKLIST.md"),
    "utf8",
  );
  const hasTable = /data-cursor-ref/.test(doc) && /앱 버그 아님/.test(doc);
  const hasGuide = /Hydration 참고/.test(doc);
  return { hasTable, hasGuide, pass: hasTable && hasGuide };
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
  const report = { at: new Date().toISOString(), base: BASE, items: {} };

  try {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();

    console.log("— 1 hub TTFB");
    report.items.hubTtfb = await measureHubTtfb(page);
    console.log(JSON.stringify(report.items.hubTtfb));

    console.log("— 3 flat 소속");
    report.items.flatAffiliation = await checkFlatAffiliation(page);
    console.log(JSON.stringify(report.items.flatAffiliation));

    await ctx.close();

    const ctx2 = await browser.newContext({ viewport: VIEWPORT });
    const page2 = await ctx2.newPage();
    console.log("— 2 Apply ACK");
    report.items.applyAck = await checkAckTitles(page2);
    console.log(JSON.stringify(report.items.applyAck));
    await ctx2.close();

    console.log("— 5 hydration doc");
    report.items.hydrationDoc = await checkHydrationDoc();
    console.log(JSON.stringify(report.items.hydrationDoc));
  } finally {
    await browser.close();
  }

  const fails = Object.entries(report.items)
    .filter(([, v]) => v && v.pass === false)
    .map(([k]) => k);
  report.ok = fails.length === 0;

  const outDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "mobile-audit-output",
  );
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "detailed-reverify-report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(report.ok ? "PASS detailed reverify" : `FAIL: ${fails.join(", ")}`);
  console.log(outPath);
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
