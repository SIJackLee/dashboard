#!/usr/bin/env node
/**
 * Mobile tour step transition timing — Kakao profile + 10% tolerance.
 * Usage: node scripts/mobile-tour-timing-audit.mjs
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ensureTestPasswords, passwordForEmail, TEST_ACCOUNTS } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const FARM_PATH = "/farm?lsind=FARM01&item=P00";
const VIEWPORT = { width: 390, height: 796 };
const TOLERANCE = 1.1;

/** 예측 지연(ms) — 최적화 후 목표 */
const STEP_BUDGET_MS = {
  1: 280,
  2: 280,
  3: 280,
  4: 280,
  5: 380,
  6: 380,
  7: 520,
  8: 450,
  9: 280,
};
const START_BUDGET_MS = 350;

async function login(page, email) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(passwordForEmail(email));
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}

async function waitStepReady(page, stepNum, timeoutMs = 20000) {
  const t0 = Date.now();
  await page.waitForFunction(
    (n) => {
      const tip = document.querySelector(".farm-tour-tooltip");
      const hole = document.querySelector(".farm-tour-hole");
      const ui = +tip?.textContent?.match(/^(\d+)/)?.[1];
      return ui === n && hole && !hole.getAttribute("data-settling");
    },
    stepNum,
    { timeout: timeoutMs },
  );
  return Date.now() - t0;
}

async function measureTourTiming(page) {
  await page.setViewportSize(VIEWPORT);
  await page.goto(`${BASE}${FARM_PATH}`, { waitUntil: "networkidle" });

  const startT0 = Date.now();
  await page.evaluate(() => {
    sessionStorage.setItem("farm-tour-restart", "1");
    window.dispatchEvent(new CustomEvent("farm-tour-restart"));
  });
  await page.waitForSelector(".farm-tour-tooltip", { timeout: 20000 });
  const step1Ms = await waitStepReady(page, 1);
  const startMs = Date.now() - startT0;

  const transitions = [{ step: 1, ms: step1Ms, kind: "initial" }];

  for (let step = 2; step <= 9; step += 1) {
    const t0 = Date.now();
    await page.locator(".farm-tour-tooltip button", { hasText: /^(다음|완료)$/ }).first().click();
    const ms = await waitStepReady(page, step);
    transitions.push({ step, ms, kind: "transition", clickToReady: ms, sinceClick: Date.now() - t0 });
  }

  return { startMs, transitions, viewport: VIEWPORT };
}

function evaluateBudget(name, ms, budget) {
  const max = Math.round(budget * TOLERANCE);
  return { name, ms, budget, max, pass: ms <= max };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing env for Supabase");
    process.exit(2);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  await ensureTestPasswords(admin);

  const outDir = join(dirname(fileURLToPath(import.meta.url)), "mobile-audit-output");
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await login(page, TEST_ACCOUNTS.operator.email);

  const timing = await measureTourTiming(page);
  await browser.close();

  const checks = [
    evaluateBudget("start→step1", timing.startMs, START_BUDGET_MS),
    ...timing.transitions.map((t) =>
      evaluateBudget(
        t.kind === "initial" ? `step${t.step} initial` : `step${t.step} transition`,
        t.ms,
        STEP_BUDGET_MS[t.step] ?? 280,
      ),
    ),
  ];

  const failed = checks.filter((c) => !c.pass);
  const report = {
    at: new Date().toISOString(),
    profile: "kakao-webview",
    tolerance: TOLERANCE,
    timing,
    checks,
    summary: {
      pass: failed.length === 0,
      failed: failed.length,
      total: checks.length,
    },
  };

  const reportPath = join(outDir, "tour-timing-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`Tour timing (Kakao) — ${checks.length - failed.length}/${checks.length} within budget`);
  for (const c of checks) {
    console.log(`  ${c.pass ? "OK" : "FAIL"} ${c.name}: ${c.ms}ms (max ${c.max}ms)`);
  }
  console.log(`Report: ${reportPath}`);

  if (failed.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
