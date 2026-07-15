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
import {
  login,
  openListControllerSettings,
  applyFromSettingsPanel,
} from "./audit-shared.mjs";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const FARM_PATH = "/farm?lsind=FARM01&item=P00&tab=ops&view=list";
const VIEWPORT = { width: 390, height: 844 };

async function runApplyFlow(page) {
  await page.goto(`${BASE}${FARM_PATH}`, { waitUntil: "load" });
  await openListControllerSettings(page);
  const panel = page.locator('[data-audit-region="barn-list-accordion-panel"]').first();
  return applyFromSettingsPanel(page, panel);
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
    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.operator.email,
      password: passwordForEmail(TEST_ACCOUNTS.operator.email),
    });
    const result = await runApplyFlow(page);
    console.log(
      `Operator apply smoke passed — setpoint ${result.setpoint}℃ · ${result.ack}`
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
          ackText: result.ack,
          setpoint: result.setpoint,
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
