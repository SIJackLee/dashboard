#!/usr/bin/env node
/**
 * Admin hub /farm TTFB — warm vs cache-cleared vs strict-cold.
 * Usage:
 *   npm run measure:hub-ttfb
 *   TTFB_PHASE=strict-only npm run measure:hub-ttfb
 *     (dev를 SKIP_ADMIN_HUB_WARM=1 로 재시작한 뒤)
 * Env: UI_VERIFY_BASE, TTFB_SAMPLES, TTFB_PHASE=no-restart|strict-only
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { rmSync, existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  ensureTestPasswords,
  passwordForEmail,
  TEST_ACCOUNTS,
} from "./test-accounts.mjs";
import { login } from "./audit-shared.mjs";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_DIRS = [
  join(WEB_ROOT, ".next", "cache"),
  join(WEB_ROOT, ".next", "dev", "cache"),
];
const SAMPLES = Number(process.env.TTFB_SAMPLES ?? 3);
/** no-restart | strict-only — restart는 스크립트 밖에서 수행 */
const PHASE = process.env.TTFB_PHASE ?? "no-restart";

function clearNextCache() {
  let cleared = false;
  for (const dir of CACHE_DIRS) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      cleared = true;
      console.log(`  removed ${dir}`);
    }
  }
  return cleared;
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/login`, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error(`server not ready: ${BASE}`);
}

async function gotoFarm(page) {
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await page.goto(`${BASE}/farm`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
    } catch (err) {
      lastErr = err;
      console.log(`  goto /farm retry ${attempt}/5: ${err?.message ?? err}`);
      await sleep(2000 * attempt);
    }
  }
  throw lastErr;
}

async function measureFarmNavigation(page, label, { samples = SAMPLES, waitBarns = false } = {}) {
  const rows = [];
  for (let i = 0; i < samples; i++) {
    const t0 = Date.now();
    const resp = await gotoFarm(page);
    const navMs = Date.now() - t0;
    const status = resp?.status() ?? 0;
    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      if (!nav) return null;
      return {
        responseStart: Math.round(nav.responseStart),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
      };
    });
    let hasBarns = false;
    if (waitBarns) {
      try {
        await page.waitForFunction(
          () => /임신사/.test(document.body?.innerText ?? ""),
          null,
          { timeout: 45000 },
        );
        hasBarns = true;
      } catch {
        hasBarns = false;
      }
    } else {
      await sleep(1200);
      const body = await page.locator("body").innerText();
      hasBarns = /임신사/.test(body) && /분만사/.test(body);
    }
    rows.push({
      i: i + 1,
      label,
      status,
      wallNavMs: navMs,
      responseStartMs: perf?.responseStart ?? null,
      hasBarns,
    });
    console.log(
      `  [${label} #${i + 1}] wall=${navMs}ms ttfb≈${perf?.responseStart ?? "?"}ms barns=${hasBarns}`,
    );
  }
  return rows;
}

function summarize(samples) {
  const walls = samples.map((s) => s.wallNavMs).sort((a, b) => a - b);
  const ttfbs = samples
    .map((s) => s.responseStartMs)
    .filter((n) => typeof n === "number")
    .sort((a, b) => a - b);
  const mid = (arr) => (arr.length ? arr[Math.floor(arr.length / 2)] : null);
  return {
    n: samples.length,
    wallMs: { min: walls[0], median: mid(walls), max: walls[walls.length - 1] },
    responseStartMs: ttfbs.length
      ? { min: ttfbs[0], median: mid(ttfbs), max: ttfbs[ttfbs.length - 1] }
      : null,
    barnsOk: samples.every((s) => s.hasBarns && s.status === 200),
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
    process.exit(1);
  }

  const adminSb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await ensureTestPasswords(adminSb);

  const browser = await chromium.launch({ headless: true });
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "mobile-audit-output");
  mkdirSync(outDir, { recursive: true });
  const statePath = join(outDir, "hub-ttfb-admin-state.json");

  try {
    await waitForServer(30000);

    let warmSamples = [];
    let cacheClearedSamples = [];
    let cleared = false;
    let strictSamples = [];

    if (PHASE === "strict-only") {
      // 서버를 SKIP_ADMIN_HUB_WARM=1 로 재시작한 뒤 실행 — login warm 없이 cold /farm
      console.log("— cold-boot login (expect SKIP_ADMIN_HUB_WARM=1) + /farm");
      const coldCtx = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      const coldPage = await coldCtx.newPage();
      await login(coldPage, {
        base: BASE,
        email: TEST_ACCOUNTS.admin.email,
        password: passwordForEmail(TEST_ACCOUNTS.admin.email),
      });
      strictSamples = await measureFarmNavigation(coldPage, "strict-cold", {
        samples: SAMPLES,
        waitBarns: true,
      });
      await coldCtx.close();
    } else {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      const page = await context.newPage();

      console.log("— login (admin warm overview)");
      await login(page, {
        base: BASE,
        email: TEST_ACCOUNTS.admin.email,
        password: passwordForEmail(TEST_ACCOUNTS.admin.email),
      });
      await context.storageState({ path: statePath });

      console.log(`— warm /farm ×${SAMPLES}`);
      warmSamples = await measureFarmNavigation(page, "warm", {
        waitBarns: true,
      });

      console.log("— clear .next/cache (no restart)");
      cleared = clearNextCache();
      console.log(`  cleared=${cleared}`);
      cacheClearedSamples = await measureFarmNavigation(page, "cache-cleared", {
        waitBarns: true,
      });
      await context.close();
    }

    const prevPath = join(outDir, "hub-ttfb-report.json");
    const prev = existsSync(prevPath)
      ? JSON.parse(readFileSync(prevPath, "utf8"))
      : {};

    const report = {
      at: new Date().toISOString(),
      base: BASE,
      note:
        "warm=after login overview warm; cache-cleared=.next/dev/cache deleted; strict-cold=dev restart with SKIP_ADMIN_HUB_WARM=1 then login (no overview warm).",
      warm:
        PHASE === "strict-only" && prev.warm
          ? prev.warm
          : { ...summarize(warmSamples), samples: warmSamples },
      cacheCleared:
        PHASE === "strict-only" && prev.cacheCleared
          ? prev.cacheCleared
          : {
              ...summarize(cacheClearedSamples),
              samples: cacheClearedSamples,
              diskCacheCleared: cleared,
            },
      strictCold:
        PHASE === "strict-only"
          ? { ...summarize(strictSamples), samples: strictSamples }
          : prev.strictCold ?? null,
    };

    writeFileSync(prevPath, JSON.stringify(report, null, 2));
    if (report.warm?.wallMs) {
      console.log("warm", JSON.stringify(report.warm.wallMs), JSON.stringify(report.warm.responseStartMs));
    }
    if (report.cacheCleared?.wallMs) {
      console.log(
        "cache-cleared",
        JSON.stringify(report.cacheCleared.wallMs),
        JSON.stringify(report.cacheCleared.responseStartMs),
      );
    }
    if (report.strictCold?.wallMs) {
      console.log(
        "strict-cold",
        JSON.stringify(report.strictCold.wallMs),
        JSON.stringify(report.strictCold.responseStartMs),
      );
    }
    console.log("wrote", prevPath);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
