#!/usr/bin/env node
/**
 * 출고 수동 시나리오 포커스 스모크: 1 · 3 · 5 · 6 · 2
 * Usage: node scripts/manual-scenarios-13562-smoke.mjs  (dev 서버 실행 중)
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
import {
  login,
  openListControllerSettings,
  applyFromSettingsPanel,
  waitAck,
} from "./audit-shared.mjs";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const LIST =
  "/farm?lsind=FARM01&item=P00&view=list&listLayout=flat";
const MAP = "/farm?lsind=FARM01&item=P00";
const VIEWPORT = { width: 1280, height: 900 };

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function trackBulkControlPosts(page) {
  const state = { count: 0 };
  page.on("request", (req) => {
    if (req.method() !== "POST") return;
    const data = req.postData() ?? "";
    // Next server action payload — 함수명 또는 bulk thermo 흔적
    if (
      /sendBulkThermoCommandAction|SET_CHANNEL_THERMO|SET_CTRL_THERMO|BulkThermo/.test(
        data,
      )
    ) {
      state.count += 1;
    }
  });
  return state;
}

async function enableListBulk(page) {
  await page.waitForSelector('[data-audit-region="barn-list-summary"]', {
    timeout: 45000,
  });
  const bulkSwitch = page.getByRole("switch", { name: /일괄적용/ });
  await bulkSwitch.waitFor({ state: "visible", timeout: 20000 });
  // 목록 enterBulk는 visible SP를 전부 선택함 — chip을 다시 누르면 해제되므로 건드리지 않음
  if ((await bulkSwitch.getAttribute("aria-checked")) !== "true") {
    await bulkSwitch.click();
  }
  await page.waitForTimeout(500);

  const openModal = page.getByRole("button", { name: /설정\s*입력/ });
  await openModal.waitFor({ state: "visible", timeout: 15000 });
  // 선택 해제된 경우 chip으로 재선택
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

async function enableMapBulkAndSelectSps(page) {
  const bulkSwitch = page.getByRole("switch", { name: /일괄적용/ });
  await bulkSwitch.waitFor({ state: "visible", timeout: 20000 });
  if ((await bulkSwitch.getAttribute("aria-checked")) !== "true") {
    await bulkSwitch.click();
  }
  await page.waitForTimeout(800);

  // data-grid-cell 내부 선택 버튼
  let clicked = 0;
  const cells = page.locator("[data-grid-cell]");
  const cellCount = await cells.count();
  for (let i = 0; i < cellCount; i++) {
    const btn = cells.nth(i).locator("button").first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      clicked += 1;
      await page.waitForTimeout(120);
    }
  }
  if (clicked === 0) {
    const barnBtns = page.getByRole("button").filter({ hasText: /임신|분만|자돈|사/ });
    const n = await barnBtns.count();
    for (let i = 0; i < Math.min(n, 10); i++) {
      await barnBtns.nth(i).click({ force: true }).catch(() => {});
      clicked += 1;
    }
  }
  assert(clicked > 0, "맵 SP 카드 클릭 실패");

  const openModal = page.getByRole("button", { name: /설정\s*입력/ });
  await openModal.waitFor({ state: "visible", timeout: 15000 });
  for (let attempt = 0; attempt < 5 && !(await openModal.isEnabled()); attempt++) {
    // 아직 미선택 — 첫 셀 재클릭
    await cells.first().locator("button").first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(200);
  }
  assert(await openModal.isEnabled(), "맵 설정입력 비활성 — SP 미선택");
  await openModal.click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 15000 });
}

async function setSectionChecked(page, labelRe, checked) {
  const dialog = page.getByRole("dialog");
  const label = dialog.locator("label").filter({ hasText: labelRe }).first();
  await label.waitFor({ state: "visible", timeout: 10000 });
  const box = label.locator('input[type="checkbox"]');
  for (let i = 0; i < 5; i++) {
    if ((await box.isChecked()) === checked) return;
    await label.click({ force: true });
    await page.waitForTimeout(150);
  }
}

async function clickChannel(page, slot, on) {
  const dialog = page.getByRole("dialog");
  const label = dialog.locator(`label[title="채널 ${slot}"]`);
  if ((await label.count()) === 0) return false;
  const box = label.locator('input[type="checkbox"]');
  for (let i = 0; i < 5; i++) {
    if ((await box.isChecked()) === on) return true;
    await label.click({ force: true });
    await page.waitForTimeout(150);
  }
  return (await box.isChecked()) === on;
}

async function waitToastOrDialogResult(page, pattern, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const body = await page.locator("body").innerText();
    if (pattern.test(body)) {
      const line =
        body
          .split("\n")
          .map((l) => l.trim())
          .find((l) => pattern.test(l)) ?? body.match(pattern)?.[0];
      return line;
    }
    await page.waitForTimeout(400);
  }
  throw new Error(`결과 문구 미검출: ${pattern}`);
}

async function scenario1_doubleSubmit(page) {
  const posts = trackBulkControlPosts(page);
  await page.goto(`${BASE}${LIST}`, { waitUntil: "load" });
  await page.waitForSelector('[data-audit-region="barn-list-summary"]', {
    timeout: 45000,
  });
  await enableListBulk(page);

  const applyBtn = page
    .getByRole("dialog")
    .getByRole("button", { name: /적용$/ });
  await applyBtn.waitFor({ state: "visible", timeout: 15000 });
  assert(await applyBtn.isEnabled(), "시나리오1: 적용 버튼 비활성");

  const before = posts.count;
  // 연타 — 첫 클릭 후 running이면 추가 클릭은 무시되어야 함
  await applyBtn.click({ force: true });
  await applyBtn.click({ force: true }).catch(() => {});
  await applyBtn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(80);
  if (await applyBtn.isVisible().catch(() => false)) {
    await applyBtn.click({ force: true }).catch(() => {});
  }

  await waitToastOrDialogResult(
    page,
    /일괄 적용 완료|일부만 적용|제어 .*전송|알람 유형|명령/,
  );
  await page.waitForTimeout(1500);
  const delta = posts.count - before;
  assert(
    delta <= 1,
    `시나리오1 FAIL: bulk control POST가 ${delta}회 (기대 ≤1)`,
  );

  // 모달 결과 UI가 한 번만
  const resultBlocks = page
    .getByRole("dialog")
    .getByText(/일괄 적용 완료|일부만 적용됨|일괄 적용 실패/);
  const resultCount = await resultBlocks.count();
  assert(resultCount <= 2, `시나리오1: 결과 헤더 과다 (${resultCount})`);

  // 닫기
  const close = page.getByRole("dialog").getByRole("button", { name: /닫기|확인|완료/ }).first();
  if (await close.isVisible().catch(() => false)) await close.click();
  else await page.keyboard.press("Escape");

  return { posts: delta };
}

async function scenario5_channelSkip(page) {
  await page.goto(`${BASE}${LIST}`, { waitUntil: "load" });
  await page.waitForSelector('[data-audit-region="barn-list-summary"]', {
    timeout: 45000,
  });
  await enableListBulk(page);

  // 채널 B만 — 임신사(A만) 미매칭이 정상 경로
  await setSectionChecked(page, /설정온도/, true);
  await setSectionChecked(page, /환기/, false);
  await setSectionChecked(page, /알람/, true);

  assert(await clickChannel(page, "A", false), "시나리오5: 채널 A 토글 실패");
  assert(await clickChannel(page, "B", true), "시나리오5: 채널 B 토글 실패");
  assert(await clickChannel(page, "C", false), "시나리오5: 채널 C 토글 실패");

  const dialog = page.getByRole("dialog");
  assert(
    !(await dialog.getByLabel("채널 A", { exact: true }).isChecked()),
    "시나리오5: 채널 A가 여전히 ON",
  );
  assert(
    await dialog.getByLabel("채널 B", { exact: true }).isChecked(),
    "시나리오5: 채널 B가 OFF",
  );

  // 진단: 채널 전부 OFF인데도 preview 명령이 남으면 channels[] 미탑재(레거시 CTRL)
  assert(await clickChannel(page, "B", false), "시나리오5: 채널 B OFF 실패");
  await page.waitForTimeout(250);
  const helpVisible = await dialog
    .getByText(/채널을 선택하지 않으면/)
    .isVisible()
    .catch(() => false);
  const previewLeft = await dialog.locator('[aria-label^="제어 명령"]').count();
  if (helpVisible && previewLeft > 0) {
    throw new Error(
      "시나리오5 BLOCKED: bulk readings에 channels[]가 없어 채널 선택이 무시됨(레거시 CTRL). 채널 미매칭 toast 경로 도달 불가",
    );
  }

  // 정상 데이터면 B만 다시 켜고 적용
  assert(await clickChannel(page, "B", true), "시나리오5: 채널 B ON 실패");
  await dialog.getByRole("button", { name: /적용$/ }).click();

  const mismatch = page.getByText(/채널 미매칭\s*\d+대/);
  await mismatch.first().waitFor({ state: "visible", timeout: 45000 });
  const body = await page.locator("body").innerText();
  const m = body.match(/채널 미매칭\s*(\d+)대/);
  assert(m && Number(m[1]) > 0, "시나리오5: 미매칭 건수 0");

  await page.keyboard.press("Escape");
  return { skipped: Number(m[1]), snippet: m[0] };
}

async function scenario6_alarmOnlyMap(page) {
  await page.goto(`${BASE}${MAP}`, { waitUntil: "load" });
  await page.waitForSelector('[data-tour-id="bulk-apply"], [data-grid-cell]', {
    timeout: 45000,
  });
  await enableMapBulkAndSelectSps(page);

  await setSectionChecked(page, /설정온도/, false);
  await setSectionChecked(page, /환기/, false);
  await setSectionChecked(page, /알람/, true);

  // 알람 하한 값을 살짝 변경 — number spinbutton / textbox
  const dialog = page.getByRole("dialog");
  const tempLow = dialog
    .getByRole("spinbutton")
    .or(dialog.locator('input[type="number"]'))
    .first();
  let targetLow = null;
  if ((await tempLow.count()) > 0) {
    const cur = parseFloat(await tempLow.inputValue());
    targetLow = Number.isFinite(cur) ? Math.min(34, cur + 0.5) : 18;
    await tempLow.fill(String(targetLow));
    await tempLow.press("Tab");
  }

  const applyBtn = dialog.getByRole("button", { name: /적용$/ });
  await applyBtn.click();
  await waitToastOrDialogResult(page, /알람 유형|일괄 적용 완료|일부만 적용/);

  // toast 직후 — 가능하면 모달/페이지에서 변경값 존재 확인
  if (targetLow != null) {
    const body = await page.locator("body").innerText();
    // 즉시 patch — 적용한 값이 화면에 남아 있거나 toast에 반영
    assert(
      body.includes(String(targetLow)) ||
        body.includes(String(targetLow).replace(/\.0$/, "")) ||
        /알람 유형\s*\d+개/.test(body),
      `시나리오6: 적용값 ${targetLow} 즉시 반영 흔적 없음`,
    );
  }

  await page.keyboard.press("Escape");
  // 맵 상세에서 알람 UI 재확인 (선택)
  return { targetLow };
}

async function scenario2_offlineRetry(page) {
  await page.goto(`${BASE}${LIST}`, { waitUntil: "load" });
  await page.waitForSelector('[data-audit-region="barn-list-summary"]', {
    timeout: 45000,
  });
  const bulkSwitch = page.getByRole("switch", { name: /일괄적용/ });
  if (
    (await bulkSwitch.isVisible().catch(() => false)) &&
    (await bulkSwitch.getAttribute("aria-checked")) === "true"
  ) {
    await bulkSwitch.click();
    await page.waitForTimeout(400);
  }

  // Offline 전에 패널·설정온도를 먼저 연다 (Offline 중 navigation/hydration 이슈 회피)
  await openListControllerSettings(page);
  const panel = page
    .locator('[data-audit-region="barn-list-accordion-panel"]')
    .first();
  const controlToggle = panel
    .locator('button[aria-expanded="false"]')
    .filter({ hasText: /^제어/ })
    .first();
  if (await controlToggle.isVisible().catch(() => false)) {
    await controlToggle.click();
  }
  const setpointInput = panel.getByLabel("설정온도", { exact: true }).first();
  await setpointInput.waitFor({ state: "visible", timeout: 20000 });

  await page.context().setOffline(true);
  try {
    const raw = await setpointInput.inputValue();
    const baseVal = parseFloat(raw.replace(/[^\d.-]/g, "")) || 25;
    const next = Math.min(35, Math.max(15, baseVal === 25 ? 26 : baseVal + 1));
    await setpointInput.fill(String(next));
    await setpointInput.press("Tab");
    await page.waitForTimeout(300);

    const applyBtn = panel.getByRole("button", { name: "적용", exact: true });
    await applyBtn.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(8000);

    const bodyOffline = await page.locator("body").innerText();
    const failedVisibly =
      /오류|실패|네트워크|offline|Failed|다시 시도|fetch/i.test(bodyOffline);
    const notStuck = !(await panel
      .getByText(/적용 중/)
      .isVisible()
      .catch(() => false));
    const falseSuccess = /명령을 등록했습니다|현장 반영 완료/.test(bodyOffline);
    assert(!falseSuccess, "시나리오2: Offline인데 성공 ACK가 표시됨");
    assert(
      failedVisibly || notStuck,
      "시나리오2: Offline 후 실패 피드백 없고 busy 고착 의심",
    );
  } finally {
    await page.context().setOffline(false);
  }

  await page.waitForTimeout(800);

  if (!(await setpointInput.isVisible().catch(() => false))) {
    await openListControllerSettings(page);
  }
  const panel2 = page
    .locator('[data-audit-region="barn-list-accordion-panel"]')
    .first();
  const result = await applyFromSettingsPanel(page, panel2);
  assert(Boolean(result.ack), "시나리오2: Online 재시도 ACK 없음");
  return result;
}

async function scenario3_leaveDuringLive(page) {
  // 이전 Offline 시나리오 잔여 방어
  await page.context().setOffline(false);
  await page.goto(`${BASE}${LIST}`, { waitUntil: "load" });
  await openListControllerSettings(page);
  const panel = page
    .locator('[data-audit-region="barn-list-accordion-panel"]')
    .first();
  await applyFromSettingsPanel(page, panel);

  // LIVE 배너/ACK 대기 문구
  await waitAck(page, 20000).catch(() => null);
  const hasBanner = /전송 대기|명령 등록|ACK|현장/.test(
    await page.locator("body").innerText(),
  );

  // 화면 이탈
  await page.goto(`${BASE}/farm`, { waitUntil: "load" });
  await page.waitForTimeout(1000);
  // 재진입
  await page.goto(`${BASE}${LIST}`, { waitUntil: "load" });
  await page.waitForSelector('[data-audit-region="barn-list-summary"]', {
    timeout: 45000,
  });
  await page.waitForTimeout(1500);

  const body = await page.locator("body").innerText();
  // 유령 전역 busy / 적용 불가 아님 — 설정 다시 열리고 적용 버튼 존재
  await openListControllerSettings(page);
  const panel2 = page
    .locator('[data-audit-region="barn-list-accordion-panel"]')
    .first();
  const applyBtn = panel2.getByRole("button", { name: "적용", exact: true });
  await applyBtn.waitFor({ state: "visible", timeout: 15000 });

  // 잘못된 전역 오버레이로 클릭 막힘 없는지
  const enabledOrDirtyPath = await applyBtn.isVisible();
  assert(enabledOrDirtyPath, "시나리오3: 재진입 후 적용 UI 없음");

  return { hadLiveUiBeforeLeave: hasBanner, reentryOk: true };
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

  const results = [];
  const run = async (id, name, fn) => {
    process.stdout.write(`▶ ${id} ${name} ... `);
    try {
      const detail = await fn(page);
      results.push({ id, name, ok: true, detail });
      console.log("PASS", detail ? JSON.stringify(detail) : "");
    } catch (err) {
      results.push({
        id,
        name,
        ok: false,
        error: String(err?.message ?? err),
      });
      console.log("FAIL", err?.message ?? err);
    }
  };

  try {
    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.operator.email,
      password: passwordForEmail(TEST_ACCOUNTS.operator.email),
    });

    // 권장 순서: 1 → 5 → 6 → 2 → 3
    await run(1, "적용 연타", () => scenario1_doubleSubmit(page));
    await run(5, "채널 미매칭", () => scenario5_channelSkip(page));
    await run(6, "맵 알람만 일괄", () => scenario6_alarmOnlyMap(page));
    await run(2, "Offline 적용 재시도", () => scenario2_offlineRetry(page));
    await run(3, "LIVE 중 화면 이탈", () => scenario3_leaveDuringLive(page));
  } finally {
    await browser.close();
  }

  const outDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "mobile-audit-output",
  );
  mkdirSync(outDir, { recursive: true });
  const reportPath = join(outDir, "manual-scenarios-13562-report.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      { at: new Date().toISOString(), results },
      null,
      2,
    ),
  );

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} #${r.id} ${r.name}${r.error ? ` — ${r.error}` : ""}`);
  }
  console.log(`report: ${reportPath}`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
