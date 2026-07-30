#!/usr/bin/env node
/**
 * #4 탭 숨김 폴링 — in-flight vs 가드 미동작 실측
 * Usage: node scripts/diag-tab-hidden-poll.mjs
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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function isLiveOrCommandPoll(req) {
  if (req.method() !== "POST") return false;
  if (!/\/farm(\?|$)/.test(req.url())) return false;
  if (!req.headers()["next-action"]) return false;
  const data = req.postData() ?? "";
  if (data.includes("WebKitFormBoundary") || data.includes("multipart")) {
    return false;
  }
  return (
    /^\s*\[\s*"[0-9a-f-]{36}"/i.test(data) || /lsindRegistNo/.test(data)
  );
}

function classifyBody(data) {
  if (/^\s*\[\s*"[0-9a-f-]{36}"/i.test(data ?? "")) return "cmd";
  if (/lsindRegistNo/.test(data ?? "")) return "live";
  return "other";
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
    for (let i = 0; i < n; i++) {
      await chips.nth(i).click();
      await page.waitForTimeout(80);
    }
  }
  await openModal.click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 15000 });
}

async function applyBulkSetpoint(page) {
  await openListBulkModal(page);
  const dialog = page.getByRole("dialog");
  for (const [re, on] of [
    [/설정온도/, true],
    [/환기/, false],
    [/알람/, false],
  ]) {
    const label = dialog.locator("label").filter({ hasText: re }).first();
    const box = label.locator('input[type="checkbox"]');
    for (let i = 0; i < 5; i++) {
      if ((await box.isChecked()) === on) break;
      await label.click({ force: true });
      await page.waitForTimeout(150);
    }
  }
  const setpoint = dialog.getByLabel("설정온도", { exact: true }).first();
  if (await setpoint.isVisible().catch(() => false)) {
    const raw = await setpoint.inputValue();
    const base = parseFloat(raw.replace(/[^\d.-]/g, "")) || 25;
    const next = Math.min(34, Math.max(16, base >= 28 ? base - 0.5 : base + 0.5));
    await setpoint.fill(String(next));
    await setpoint.press("Tab");
  }
  await dialog.getByRole("button", { name: /적용$/ }).click();
  await page
    .getByText(/제어 .*전송|일괄 적용|채널 미매칭|전송 대기|명령 등록/)
    .first()
    .waitFor({ state: "visible", timeout: 45000 });
}

/** in-flight가 0인 상태가 quietMs 동안 유지될 때까지 대기 */
async function waitForQuiet(page, { quietMs = 800, timeoutMs = 20000 } = {}) {
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
  return { quiet: inFlight === 0 && quietSince != null };
}

async function runPhase(page, label, ms, tHide) {
  const events = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const onReq = (req) => {
    if (!isLiveOrCommandPoll(req)) return;
    const t = Date.now();
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    events.push({
      kind: "start",
      t,
      relHide: tHide == null ? null : t - tHide,
      type: classifyBody(req.postData()),
      inFlight,
    });
  };
  const onDone = (req) => {
    if (!isLiveOrCommandPoll(req)) return;
    const t = Date.now();
    inFlight = Math.max(0, inFlight - 1);
    events.push({
      kind: "end",
      t,
      relHide: tHide == null ? null : t - tHide,
      type: classifyBody(req.postData()),
      inFlight,
    });
  };
  page.on("request", onReq);
  page.on("requestfinished", onDone);
  page.on("requestfailed", onDone);
  await page.waitForTimeout(ms);
  page.off("request", onReq);
  page.off("requestfinished", onDone);
  page.off("requestfailed", onDone);
  const starts = events.filter((e) => e.kind === "start");
  return { label, ms, starts: starts.length, maxInFlight, events: starts };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && key, "env 필요");

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await ensureTestPasswords(admin);

  const browser = await chromium.launch({ headless: true });
  const page = await (
    await browser.newContext({ viewport: { width: 1280, height: 900 } })
  ).newPage();

  const report = { at: new Date().toISOString(), modes: [] };

  try {
    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.operator.email,
      password: passwordForEmail(TEST_ACCOUNTS.operator.email),
    });

    await applyBulkSetpoint(page);
    await page.waitForTimeout(1500);

    // --- Mode A: 기존과 동일 — 즉시 hide (quiet 대기 없음)
    console.log("\n=== Mode A: immediate hide (no quiet) ===");
    const baselineA = await runPhase(page, "baseline", 8000, null);
    console.log("baseline starts", baselineA.starts, "maxIF", baselineA.maxInFlight);

    let tHide = Date.now();
    await setDocumentHidden(page, true);
    const hiddenReadA = await page.evaluate(() => ({
      hidden: document.hidden,
      visibilityState: document.visibilityState,
    }));
    const hiddenA = await runPhase(page, "hidden", 16000, tHide);
    const startsAfterHideA = hiddenA.events.filter(
      (e) => e.relHide != null && e.relHide >= 0,
    );
    // 숨김 후 200ms 이후에 시작된 요청 = 새 tick 후보
    const newTicksA = startsAfterHideA.filter((e) => e.relHide >= 200);
    const earlyA = startsAfterHideA.filter((e) => e.relHide < 200);

    await setDocumentHidden(page, false);
    const resumeA = await runPhase(page, "resume", 8000, null);

    const verdictA =
      newTicksA.length === 0
        ? "IN_FLIGHT_OR_RACE"
        : "GUARD_MISS_NEW_TICKS";

    const modeA = {
      mode: "A_immediate_hide",
      hiddenRead: hiddenReadA,
      baselineStarts: baselineA.starts,
      hiddenStarts: hiddenA.starts,
      earlyStartsMs200: earlyA.length,
      newStartsAfter200ms: newTicksA.length,
      newByType: {
        cmd: newTicksA.filter((e) => e.type === "cmd").length,
        live: newTicksA.filter((e) => e.type === "live").length,
      },
      resumeStarts: resumeA.starts,
      verdict: verdictA,
      sampleNew: newTicksA.slice(0, 8),
    };
    report.modes.push(modeA);
    console.log(JSON.stringify(modeA, null, 2));

    // --- Mode B: quiet 후 hide
    console.log("\n=== Mode B: quiet then hide ===");
    // 폴링이 아직 있으면 대기
    const quiet = await waitForQuiet(page, { quietMs: 900, timeoutMs: 25000 });
    console.log("quiet", quiet);

    tHide = Date.now();
    await setDocumentHidden(page, true);
    // hide 직후 한 프레임 — 진행 중 요청 소진 여유 없이 바로 측정하되,
    // 시작 시각으로만 판정
    const hiddenReadB = await page.evaluate(() => ({
      hidden: document.hidden,
      visibilityState: document.visibilityState,
    }));
    const hiddenB = await runPhase(page, "hidden", 16000, tHide);
    const newTicksB = hiddenB.events.filter(
      (e) => e.relHide != null && e.relHide >= 200,
    );
    const earlyB = hiddenB.events.filter(
      (e) => e.relHide != null && e.relHide >= 0 && e.relHide < 200,
    );

    await setDocumentHidden(page, false);

    const verdictB =
      newTicksB.length === 0
        ? "IN_FLIGHT_OR_CLEAN"
        : "GUARD_MISS_NEW_TICKS";

    const modeB = {
      mode: "B_quiet_then_hide",
      quiet,
      hiddenRead: hiddenReadB,
      hiddenStarts: hiddenB.starts,
      earlyStartsMs200: earlyB.length,
      newStartsAfter200ms: newTicksB.length,
      newByType: {
        cmd: newTicksB.filter((e) => e.type === "cmd").length,
        live: newTicksB.filter((e) => e.type === "live").length,
      },
      verdict: verdictB,
      sampleNew: newTicksB.slice(0, 8),
    };
    report.modes.push(modeB);
    console.log(JSON.stringify(modeB, null, 2));

    // --- Mode C: CDP frozen (가능 시)
    console.log("\n=== Mode C: CDP Page.setWebLifecycleState frozen ===");
    try {
      await setDocumentHidden(page, false);
      await waitForQuiet(page, { quietMs: 600, timeoutMs: 15000 });
      const cdp = await page.context().newCDPSession(page);
      tHide = Date.now();
      await cdp.send("Page.setWebLifecycleState", { state: "frozen" });
      const hiddenC = await runPhase(page, "cdp-frozen", 12000, tHide);
      const newTicksC = hiddenC.events.filter(
        (e) => e.relHide != null && e.relHide >= 200,
      );
      await cdp.send("Page.setWebLifecycleState", { state: "active" });
      const modeC = {
        mode: "C_cdp_frozen",
        hiddenStarts: hiddenC.starts,
        newStartsAfter200ms: newTicksC.length,
        verdict:
          newTicksC.length === 0 ? "TIMERS_PAUSED_OR_CLEAN" : "STILL_POLLING",
      };
      report.modes.push(modeC);
      console.log(JSON.stringify(modeC, null, 2));
    } catch (err) {
      const modeC = {
        mode: "C_cdp_frozen",
        error: String(err?.message ?? err),
      };
      report.modes.push(modeC);
      console.log("CDP skip", modeC.error);
    }

    // 종합 판정
    const a = report.modes.find((m) => m.mode === "A_immediate_hide");
    const b = report.modes.find((m) => m.mode === "B_quiet_then_hide");
    let conclusion;
    if (b?.verdict === "IN_FLIGHT_OR_CLEAN" && a?.newStartsAfter200ms > 0) {
      conclusion =
        "SMOKE_FALSE_FAIL: 즉시 hide 시 in-flight/레이스가 주원인. quiet 후 가드는 동작.";
    } else if (
      b?.verdict === "GUARD_MISS_NEW_TICKS" ||
      a?.verdict === "GUARD_MISS_NEW_TICKS"
    ) {
      conclusion =
        "PRODUCT_GAP: 숨김 200ms 이후에도 새 poll start — document.hidden 가드 미흡/우회.";
    } else if (b?.verdict === "IN_FLIGHT_OR_CLEAN") {
      conclusion =
        "SMOKE_TIGHT: quiet 후 깨끗함. 스모크에 quiet/grace 필요.";
    } else {
      conclusion = "INCONCLUSIVE";
    }
    report.conclusion = conclusion;
    console.log("\n=== CONCLUSION ===", conclusion);
  } finally {
    await browser.close();
  }

  const outDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "mobile-audit-output",
  );
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "diag-tab-hidden-poll.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("report:", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
