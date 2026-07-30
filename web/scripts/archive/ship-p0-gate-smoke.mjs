#!/usr/bin/env node
/**
 * P0-2 / P0-3 출고 게이트 — Playwright Chromium (Cursor IDE 브라우저 아님)
 * - P0-2: cold load hydration console · 테마 토글 · 적용 1회
 * - P0-3: FARM01 LIVE 축사(임신/분만/자돈) 표시 = uplink 가동 증거
 * Usage: node scripts/ship-p0-gate-smoke.mjs  (dev 서버 실행 중)
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
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
const FARM = "/farm?lsind=FARM01&item=P00&view=list";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function isHydrationNoise(text) {
  return /hydrat|Minified React error #418|#419|#425|did not match/i.test(
    text,
  );
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && key, "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await ensureTestPasswords(admin);

  const hydrationHits = [];
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
  } catch {
    browser = await chromium.launch({ headless: true });
  }

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" && isHydrationNoise(msg.text())) {
      hydrationHits.push({
        source: "console",
        text: msg.text().slice(0, 240),
      });
    }
  });
  page.on("pageerror", (err) => {
    if (isHydrationNoise(err.message)) {
      hydrationHits.push({
        source: "pageerror",
        text: err.message.slice(0, 240),
      });
    }
  });

  try {
    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.operator.email,
      password: passwordForEmail(TEST_ACCOUNTS.operator.email),
    });

    await page.goto(`${BASE}${FARM}`, { waitUntil: "load" });
    await page.waitForTimeout(3500);
    const body = await page.locator("body").innerText();
    assert(
      /임신사/.test(body) && /분만사/.test(body) && /자돈사/.test(body),
      "P0-3 FAIL: LIVE 축사 미표시 (시뮬 uplink?)",
    );
    const afterLoadHits = hydrationHits.length;

    const themeBtn = page
      .getByRole("button", { name: /테마|dark|light|theme/i })
      .first();
    const themeAlt = page
      .locator(
        '[data-tour-id="theme-toggle"], button[aria-label*="테마"], button[aria-label*="theme"]',
      )
      .first();
    let themeOk = false;
    if (await themeBtn.isVisible().catch(() => false)) {
      await themeBtn.click();
      await page.waitForTimeout(800);
      await themeBtn.click();
      await page.waitForTimeout(800);
      themeOk = true;
    } else if (await themeAlt.isVisible().catch(() => false)) {
      await themeAlt.click();
      await page.waitForTimeout(800);
      await themeAlt.click();
      await page.waitForTimeout(800);
      themeOk = true;
    } else {
      const any = page
        .locator("header button")
        .filter({ has: page.locator("svg") })
        .nth(0);
      if (await any.isVisible().catch(() => false)) {
        await any.click();
        await page.waitForTimeout(500);
        themeOk = true;
      }
    }
    assert(themeOk, "P0-2 FAIL: 테마 토글 버튼을 찾지 못함");
    const afterThemeHits = hydrationHits.length;

    await openListControllerSettings(page);
    const panel = page
      .locator('[data-audit-region="barn-list-accordion-panel"]')
      .first();
    const result = await applyFromSettingsPanel(page, panel);
    assert(
      /명령 등록|전송 대기|장치 ACK|현장 반영|LIVE 설정/.test(result.ack),
      `P0-2 FAIL: apply ACK 이상 — ${result.ack}`,
    );

    assert(
      afterLoadHits === 0,
      `P0-2 FAIL: cold load hydration — ${JSON.stringify(hydrationHits)}`,
    );
    assert(
      afterThemeHits === 0,
      `P0-2 FAIL: theme toggle hydration — ${JSON.stringify(hydrationHits)}`,
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          p0_2: {
            hydrationHits: 0,
            themeToggle: true,
            applyAck: result.ack,
            setpoint: result.setpoint,
          },
          p0_3: { liveBarns: true },
          browser: "chromium",
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log("PASS P0-2 hydration/theme/apply · P0-3 LIVE barns");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
