#!/usr/bin/env node
/**
 * Operator thermo apply smoke — list settings panel → 적용 → ACK banner.
 * Usage: node scripts/operator-apply-audit.mjs
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

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const FARM_PATH = "/farm?lsind=FARM01&item=P00&tab=ops&view=list";
const VIEWPORT = { width: 390, height: 844 };

const ACK_PATTERNS = [
  /명령을 등록했습니다/,
  /통신모듈/,
  /장치 ACK/,
  /현장 반영 확인/,
  /LIVE 설정값/,
  /pending|sent|applied/i,
];

async function login(page, email) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(passwordForEmail(email));
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
    timeout: 30000,
  });
}

async function runApplyFlow(page) {
  await page.goto(`${BASE}${FARM_PATH}`, { waitUntil: "load" });
  await page.waitForSelector('[data-audit-region="barn-list-summary"]', {
    timeout: 30000,
  });

  const settingsBtn = page.getByRole("button", { name: "설정" }).first();
  await settingsBtn.waitFor({ state: "visible", timeout: 15000 });
  await settingsBtn.click();

  const applyBtn = page.getByRole("button", { name: "적용", exact: true });
  await applyBtn.waitFor({ state: "visible", timeout: 15000 });

  const setpointInput = page.getByLabel("설정온도").first();
  await setpointInput.waitFor({ state: "visible", timeout: 10000 });
  const raw = await setpointInput.inputValue();
  const current = parseFloat(raw.replace(/[^\d.-]/g, ""));
  const next = Number.isFinite(current)
    ? Math.min(35, Math.max(15, current + 0.5))
    : 25;
  await setpointInput.fill(String(next));
  await setpointInput.press("Tab");

  await page.waitForFunction(
    (btn) => {
      const el = [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "적용"
      );
      return el && !el.disabled;
    },
    null,
    { timeout: 15000 }
  );

  await applyBtn.click();

  const deadline = Date.now() + 20000;
  let ackText = "";
  while (Date.now() < deadline) {
    const body = await page.locator("body").innerText();
    if (ACK_PATTERNS.some((re) => re.test(body))) {
      ackText = body
        .split("\n")
        .find((line) => ACK_PATTERNS.some((re) => re.test(line)))
        ?.trim();
      break;
    }
    await page.waitForTimeout(500);
  }

  if (!ackText) {
    throw new Error("ACK 배너/토스트 문구를 찾지 못했습니다.");
  }

  return { ackText, setpoint: next };
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
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  try {
    await login(page, TEST_ACCOUNTS.operator.email);
    const result = await runApplyFlow(page);
    console.log(
      `Operator apply smoke passed — setpoint ${result.setpoint}℃ · ${result.ackText}`
    );

    const outDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "mobile-audit-output"
    );
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, "operator-apply-report.json"),
      JSON.stringify(
        {
          ok: true,
          at: new Date().toISOString(),
          path: FARM_PATH,
          ...result,
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
