#!/usr/bin/env node
/**
 * Mobile tour scroll-band audit — 390×844, 9-step spotlight band alignment.
 * Usage: node scripts/mobile-tour-band-audit.mjs
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
const VIEWPORT = { width: 390, height: 844 };
const DRIFT_THRESHOLD = 12;

/** 스크롤 band 검증 대상 스텝 — data-tour-id suffix. */
const BAND_TARGETS = {
  2: "period-select",
  3: "barn-card",
  5: "detail-panel-chart-first",
  6: "bulk-apply",
  7: "controller-gauge",
};

async function login(page, email) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(passwordForEmail(email));
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}

async function waitTourStep(page, stepNum, timeoutMs = 16000) {
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
}

async function auditTourBands(page) {
  await page.goto(`${BASE}${FARM_PATH}`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    sessionStorage.setItem("farm-tour-restart", "1");
    window.dispatchEvent(new CustomEvent("farm-tour-restart"));
  });
  await page.waitForSelector(".farm-tour-tooltip", { timeout: 20000 });
  await page.waitForTimeout(1200);

  const results = [];

  for (let step = 1; step <= 9; step += 1) {
    if (step > 1) {
      const nextBtn = page.locator(".farm-tour-tooltip button", {
        hasText: /^(다음|완료)$/,
      });
      await nextBtn.first().click();
    }

    await waitTourStep(page, step);
    await page.waitForTimeout(500);

    const targetId = BAND_TARGETS[step];
    if (!targetId) {
      results.push({ step, targetId: null, skipped: true });
      continue;
    }

    const metrics = await page.evaluate(
      ({ targetId, driftThreshold }) => {
        const findVisible = (sel) => {
          for (const el of document.querySelectorAll(sel)) {
            if (el.offsetParent) return el;
          }
          return null;
        };

        const el = findVisible(`[data-tour-id="${targetId}"]`);
        if (!el) {
          return { missing: true };
        }

        const header = document.querySelector("header[data-app-header]");
        const headerBottom = header
          ? Math.round(header.getBoundingClientRect().bottom)
          : 96;
        const headerClearance = headerBottom + 12;
        const tooltip = document.querySelector(".farm-tour-tooltip");
        const tipTop = tooltip
          ? Math.round(tooltip.getBoundingClientRect().top)
          : Math.round(window.innerHeight * 0.48);
        const maxBottom = tipTop - 16;
        const r = el.getBoundingClientRect();
        const top = Math.round(r.top);
        const bottom = Math.round(r.bottom);
        const h = Math.round(r.height);
        const topDrift = Math.max(0, headerClearance - top);
        const bottomDrift = Math.max(0, bottom - maxBottom);
        const drift = Math.max(topDrift, bottomDrift);
        const visibleH =
          Math.min(bottom, maxBottom) - Math.max(top, headerClearance);
        const hole = document.querySelector(".farm-tour-hole");
        const hr = hole?.getBoundingClientRect();
        const holeMatches = hr
          ? Math.abs(Math.round(hr.top) - top) < 16 &&
            Math.abs(Math.round(hr.height) - h) < 16
          : false;

        return {
          headerClearance,
          maxBottom,
          top,
          bottom,
          h,
          topDrift,
          bottomDrift,
          drift,
          visibleH,
          inBand: drift < driftThreshold && visibleH > 8,
          holeMatches,
        };
      },
      { targetId, driftThreshold: DRIFT_THRESHOLD },
    );

    results.push({
      step,
      targetId,
      ...metrics,
      pass: !metrics.missing && metrics.inBand && metrics.holeMatches,
    });
  }

  return results;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(2);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  await ensureTestPasswords(admin);

  const outDir = join(dirname(fileURLToPath(import.meta.url)), "mobile-audit-output");
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });
  await login(page, TEST_ACCOUNTS.operator.email);

  const results = await auditTourBands(page);
  await browser.close();

  const checked = results.filter((r) => !r.skipped);
  const failed = checked.filter((r) => !r.pass);
  const report = {
    at: new Date().toISOString(),
    viewport: VIEWPORT,
    driftThreshold: DRIFT_THRESHOLD,
    summary: {
      checked: checked.length,
      passed: checked.length - failed.length,
      failed: failed.length,
      allPass: failed.length === 0,
    },
    results,
  };

  const reportPath = join(outDir, "tour-band-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(
    `Tour band audit — ${report.summary.passed}/${report.summary.checked} passed`,
  );
  for (const r of failed) {
    console.log(
      `  FAIL step ${r.step} (${r.targetId}): drift=${r.drift} top=${r.topDrift} bottom=${r.bottomDrift} hole=${r.holeMatches}`,
    );
  }
  console.log(`Report: ${reportPath}`);

  if (failed.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
