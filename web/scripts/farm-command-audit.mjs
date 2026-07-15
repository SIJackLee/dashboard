#!/usr/bin/env node
/**
 * Farm command UX audit — list/map apply, bulk ACK toast, viewer deny.
 * Usage: node scripts/farm-command-audit.mjs
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
const VIEWPORT = { width: 390, height: 844 };
const LIST_PATH = "/farm?lsind=FARM01&item=P00&tab=ops&view=list";
const MAP_PATH = "/farm?lsind=FARM01&item=P00";

const ACK_PATTERNS = [
  /명령을 등록했습니다/,
  /통신모듈/,
  /장치 ACK/,
  /현장 반영 확인/,
  /LIVE 설정값/,
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

async function waitAck(page, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const body = await page.locator("body").innerText();
    if (ACK_PATTERNS.some((re) => re.test(body))) {
      return body.split("\n").find((line) => ACK_PATTERNS.some((re) => re.test(line)))?.trim() ?? "ACK";
    }
    await page.waitForTimeout(500);
  }
  throw new Error("ACK 배너/토스트 문구를 찾지 못했습니다.");
}

async function applyFromSettingsPanel(page) {
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

  await page.waitForFunction(() => {
    const el = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "적용"
    );
    return el && !el.disabled;
  }, null, { timeout: 15000 });

  await applyBtn.click();
  const ack = await waitAck(page);
  return { ack, setpoint: next };
}

async function auditListApply(page) {
  await page.goto(`${BASE}${LIST_PATH}`, { waitUntil: "load" });
  await page.waitForSelector('[data-audit-region="barn-list-summary"]', {
    timeout: 30000,
  });
  return applyFromSettingsPanel(page);
}

async function auditMapApply(page) {
  await page.goto(`${BASE}${MAP_PATH}`, { waitUntil: "load" });
  await page.waitForSelector('[data-tour-id="heatmap"]', { timeout: 30000 });
  const metricBtn = page.locator('[data-tour-id="heatmap"] button').first();
  await metricBtn.click();
  await page.waitForSelector('[data-tour-id="detail-panel"]', { timeout: 15000 });
  return applyFromSettingsPanel(page);
}

async function auditViewerDenied(page) {
  await page.goto(`${BASE}${LIST_PATH}`, { waitUntil: "load" });
  await page.getByRole("button", { name: "설정" }).first().click();
  const applyBtn = page.getByRole("button", { name: "적용", exact: true });
  await applyBtn.waitFor({ state: "visible", timeout: 15000 });
  const denied =
    (await applyBtn.isDisabled()) ||
    (await page.getByText("명령 권한이 없어").count()) > 0;
  if (!denied) {
    throw new Error("viewer 계정에서 적용 버튼/권한 제한이 기대와 다릅니다.");
  }
  return { denied: true };
}

async function auditBulkAck(page) {
  await page.goto(`${BASE}${LIST_PATH}`, { waitUntil: "load" });
  await page.waitForSelector('[data-audit-region="barn-list-summary"]', {
    timeout: 30000,
  });
  const bulkSwitch = page.getByRole("switch", { name: /일괄적용/ });
  if ((await bulkSwitch.count()) === 0) {
    return { skipped: true, reason: "bulk UI 없음" };
  }
  await bulkSwitch.click();
  const chip = page.locator('[data-audit-region="barn-list-bulk-sp-chips"] button').first();
  if ((await chip.count()) === 0) {
    return { skipped: true, reason: "SP chip 없음" };
  }
  await chip.click();
  const openModal = page.getByRole("button", { name: "설정 입력" });
  if ((await openModal.count()) === 0) {
    return { skipped: true, reason: "일괄 적용 대상 없음" };
  }
  await openModal.click();
  const applyBtn = page.getByRole("button", { name: /적용$/ });
  await applyBtn.waitFor({ state: "visible", timeout: 15000 });
  await applyBtn.click();
  const toast = await page.getByText(/제어 .* 전송|일괄 적용 완료|알람 유형/).first().textContent({ timeout: 30000 });
  return { toast: toast?.trim() ?? "일괄 적용 완료" };
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
  const results = {};

  try {
    await login(page, TEST_ACCOUNTS.operator.email);
    results.listApply = await auditListApply(page);
    console.log(`List apply OK — ${results.listApply.ack}`);

    results.mapApply = await auditMapApply(page);
    console.log(`Map apply OK — ${results.mapApply.ack}`);

    results.bulkAck = await auditBulkAck(page);
    console.log(`Bulk ACK — ${results.bulkAck.skipped ? results.bulkAck.reason : results.bulkAck.toast}`);

    await login(page, TEST_ACCOUNTS.viewer.email);
    results.viewerDenied = await auditViewerDenied(page);
    console.log("Viewer apply denied OK");

    const outDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "mobile-audit-output"
    );
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, "farm-command-report.json"),
      JSON.stringify({ ok: true, at: new Date().toISOString(), results }, null, 2)
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
