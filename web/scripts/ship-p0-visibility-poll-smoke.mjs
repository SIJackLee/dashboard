#!/usr/bin/env node
/**
 * SHIP 수동 시나리오 #4(탭 숨김 폴링) · #8(대량 LIVE 폴링 폭주) 자동화.
 * Usage: node scripts/ship-p0-visibility-poll-smoke.mjs  (dev 서버 실행 중)
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "fs";
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
const LIST = "/farm?lsind=FARM01&item=P00&view=list&listLayout=flat";
const VIEWPORT = { width: 1280, height: 900 };

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Next server action POST — body는 함수명이 아니라 action id + JSON args. */
function isLiveOrCommandPoll(req) {
  if (req.method() !== "POST") return false;
  if (!/\/farm(\?|$)/.test(req.url())) return false;
  if (!req.headers()["next-action"]) return false;
  const data = req.postData() ?? "";
  // form-data 적용 POST 제외
  if (data.includes("WebKitFormBoundary") || data.includes("multipart")) {
    return false;
  }
  // command id poll: ["uuid"] · farm live: [{"lsindRegistNo":...}]
  return (
    /^\s*\[\s*"[0-9a-f-]{36}"/i.test(data) ||
    /lsindRegistNo/.test(data)
  );
}

async function setDocumentHidden(page, hidden) {
  await page.evaluate((isHidden) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => isHidden,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (isHidden ? "hidden" : "visible"),
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

async function countPollStartsDuring(page, ms, { afterTs = null, graceMs = 0 } = {}) {
  let n = 0;
  let nAfterGrace = 0;
  const handler = (req) => {
    if (!isLiveOrCommandPoll(req)) return;
    n += 1;
    if (afterTs != null && Date.now() - afterTs >= graceMs) {
      nAfterGrace += 1;
    }
  };
  page.on("request", handler);
  await page.waitForTimeout(ms);
  page.off("request", handler);
  return { total: n, afterGrace: afterTs == null ? n : nAfterGrace };
}

/** 폴링 in-flight가 quietMs 동안 0일 때까지 대기 */
async function waitForPollQuiet(page, { quietMs = 900, timeoutMs = 25000 } = {}) {
  let inFlight = 0;
  const onReq = (req) => {
    if (isLiveOrCommandPoll(req)) inFlight += 1;
  };
  const onDone = (req) => {
    if (isLiveOrCommandPoll(req)) inFlight = Math.max(0, inFlight - 1);
  };
  page.on("request", onReq);
  page.on("requestfinished", onDone);
  page.on("requestfailed", onDone);

  const deadline = Date.now() + timeoutMs;
  let quietSince = inFlight === 0 ? Date.now() : null;
  while (Date.now() < deadline) {
    if (inFlight === 0) {
      if (quietSince == null) quietSince = Date.now();
      if (Date.now() - quietSince >= quietMs) break;
    } else {
      quietSince = null;
    }
    await page.waitForTimeout(50);
  }
  page.off("request", onReq);
  page.off("requestfinished", onDone);
  page.off("requestfailed", onDone);
  return inFlight === 0;
}

/** 목록 일괄 ON — enterBulk가 visible SP 전부 선택. chip 재클릭은 해제되므로 금지. */
async function openListBulkModal(page) {
  await page.goto(`${BASE}${LIST}&_=${Date.now()}`, { waitUntil: "load" });
  await page.waitForSelector('[data-audit-region="barn-list-summary"]', {
    timeout: 45000,
  });
  await page.waitForTimeout(800);

  const bulkSwitch = page.getByRole("switch", { name: /일괄적용/ });
  await bulkSwitch.waitFor({ state: "visible", timeout: 20000 });
  if ((await bulkSwitch.getAttribute("aria-checked")) !== "true") {
    await bulkSwitch.click();
  }
  await page.waitForTimeout(500);

  const openModal = page.getByRole("button", { name: /설정\s*입력/ });
  await openModal.waitFor({ state: "visible", timeout: 15000 });
  if (!(await openModal.isEnabled())) {
    const chips = page.locator(
      '[data-audit-region="barn-list-bulk-sp-chips"] button',
    );
    const n = await chips.count();
    assert(n > 0, "설정입력 비활성 — SP chip 없음");
    for (let i = 0; i < n; i++) {
      await chips.nth(i).click();
      await page.waitForTimeout(80);
    }
  }
  assert(await openModal.isEnabled(), "설정입력 비활성 — SP 미선택");
  await openModal.click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 15000 });
}

async function setSection(page, re, on) {
  const label = page
    .getByRole("dialog")
    .locator("label")
    .filter({ hasText: re })
    .first();
  const box = label.locator('input[type="checkbox"]');
  for (let i = 0; i < 5; i++) {
    if ((await box.isChecked()) === on) return;
    await label.click({ force: true });
    await page.waitForTimeout(150);
  }
}

async function applyBulkSetpoint(page) {
  await openListBulkModal(page);
  const dialog = page.getByRole("dialog");
  await setSection(page, /설정온도/, true);
  await setSection(page, /환기/, false);
  await setSection(page, /알람/, false);

  const setpoint = dialog.getByLabel("설정온도", { exact: true }).first();
  if (await setpoint.isVisible().catch(() => false)) {
    const raw = await setpoint.inputValue();
    const base = parseFloat(raw.replace(/[^\d.-]/g, "")) || 25;
    const next = Math.min(34, Math.max(16, base >= 28 ? base - 0.5 : base + 0.5));
    await setpoint.fill(String(next));
    await setpoint.press("Tab");
    await page.waitForTimeout(300);
  }

  await dialog.getByRole("button", { name: /적용$/ }).click();
  await page
    .getByText(/제어 .*전송|일괄 적용|채널 미매칭|전송 대기|명령 등록/)
    .first()
    .waitFor({ state: "visible", timeout: 45000 });
}

async function scenario4_tabHidden(page) {
  // 대량 적용으로 LIVE 대기 폴링 구간을 길게 확보
  await applyBulkSetpoint(page);
  await page.waitForTimeout(1000);

  const baseline = await countPollStartsDuring(page, 10000);
  assert(
    baseline.total >= 1,
    `시나리오4 FAIL: 숨김 전 폴링 기준선 없음 (baseline=${baseline.total})`,
  );

  // in-flight / interval 갭 오탐 방지: quiet → hide → drain 후 신규 start만 집계
  const quiet = await waitForPollQuiet(page, { quietMs: 900, timeoutMs: 25000 });
  assert(quiet, "시나리오4 FAIL: 숨김 전 폴링 quiet 미도달");

  await setDocumentHidden(page, true);
  const hiddenRead = await page.evaluate(() => ({
    hidden: document.hidden,
    visibilityState: document.visibilityState,
  }));
  assert(hiddenRead.hidden === true, "시나리오4 FAIL: document.hidden 시뮬레이션 실패");

  // hide 직후 배선·잔여 tick drain (이 구간 POST는 집계 제외)
  await page.waitForTimeout(1500);

  const hidden = await countPollStartsDuring(page, 16000);

  await setDocumentHidden(page, false);
  const visible = await countPollStartsDuring(page, 12000);

  assert(
    hidden.total <= 1,
    `시나리오4 FAIL: 숨김 drain 후 신규 폴링 ${hidden.total}회 (기대 ≤1, baseline=${baseline.total})`,
  );

  const stillWaiting = await page
    .getByText(/전송 대기|명령 등록|LIVE|현장 반영/)
    .first()
    .isVisible()
    .catch(() => false);

  if (stillWaiting) {
    assert(
      visible.total >= 1,
      `시나리오4 FAIL: 복귀 후 폴링 재개 없음 (visible=${visible.total})`,
    );
  } else if (visible.total === 0) {
    console.log("  (resume skip: LIVE 대기 종료됨)");
  }

  return {
    baseline: baseline.total,
    hiddenAfterDrain: hidden.total,
    visiblePolls: visible.total,
    stillWaiting,
    quiet: true,
  };
}

async function scenario8_bulkLiveInflight(page) {
  let inFlight = 0;
  let maxInFlight = 0;
  let pollPosts = 0;
  const onReq = (req) => {
    if (!isLiveOrCommandPoll(req)) return;
    pollPosts += 1;
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
  };
  const onDone = (req) => {
    if (!isLiveOrCommandPoll(req)) return;
    inFlight = Math.max(0, inFlight - 1);
  };
  page.on("request", onReq);
  page.on("requestfinished", onDone);
  page.on("requestfailed", onDone);

  await applyBulkSetpoint(page);
  await page.waitForTimeout(20000);

  page.off("request", onReq);
  page.off("requestfinished", onDone);
  page.off("requestfailed", onDone);

  assert(
    pollPosts >= 1,
    `시나리오8 FAIL: LIVE/명령 폴링 POST 없음`,
  );
  // tracker inFlight 가드 + interval — 동시 4 초과면 폭주
  assert(
    maxInFlight <= 4,
    `시나리오8 FAIL: 동시 in-flight ${maxInFlight} (기대 ≤4, posts=${pollPosts})`,
  );
  return { maxInFlight, pollPosts };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && key, "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await ensureTestPasswords(admin);

  const browser = await chromium.launch({ headless: true });
  const page = await (
    await browser.newContext({ viewport: VIEWPORT })
  ).newPage();

  const results = [];
  try {
    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.operator.email,
      password: passwordForEmail(TEST_ACCOUNTS.operator.email),
    });

    process.stdout.write("▶ 4 탭 숨김 폴링 ... ");
    try {
      const detail = await scenario4_tabHidden(page);
      results.push({ id: 4, ok: true, detail });
      console.log("PASS", JSON.stringify(detail));
    } catch (err) {
      results.push({ id: 4, ok: false, error: String(err?.message ?? err) });
      console.log("FAIL", err?.message ?? err);
    }

    process.stdout.write("▶ 8 대량 LIVE 폴링 ... ");
    try {
      const detail = await scenario8_bulkLiveInflight(page);
      results.push({ id: 8, ok: true, detail });
      console.log("PASS", JSON.stringify(detail));
    } catch (err) {
      results.push({ id: 8, ok: false, error: String(err?.message ?? err) });
      console.log("FAIL", err?.message ?? err);
    }
  } finally {
    await browser.close();
  }

  const outDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "mobile-audit-output",
  );
  mkdirSync(outDir, { recursive: true });
  const reportPath = join(outDir, "ship-p0-visibility-poll-report.json");
  writeFileSync(
    reportPath,
    JSON.stringify({ at: new Date().toISOString(), results }, null, 2),
  );
  console.log("report:", reportPath);

  if (results.some((r) => !r.ok)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
