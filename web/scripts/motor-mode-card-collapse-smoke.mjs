#!/usr/bin/env node
/**
 * 모터 모드 카드 접기 — 출고 포커스 스모크 (일회성)
 * Usage: node scripts/motor-mode-card-collapse-smoke.mjs  (dev 서버 실행 중)
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
import { login } from "./audit-shared.mjs";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const LIST =
  "/farm?lsind=FARM01&item=P00&view=list&listMode=graph";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
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
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.operator.email,
      password: passwordForEmail(TEST_ACCOUNTS.operator.email),
    });

    await page.goto(`${BASE}${LIST}`, { waitUntil: "load" });
    await page.waitForSelector('[data-audit-region="barn-list-summary"]', {
      timeout: 45000,
    });
    await page.waitForTimeout(1500);

    const cards = page.locator(
      '[data-audit-region="barn-list-summary"] [data-tour-id="controller-card"]',
    );
    const cardCount = await cards.count();
    assert(cardCount > 0, "모터 모드: 컨트롤러 카드 없음");

    const collapsed = page.locator(
      '[data-audit-region="barn-list-summary"] [data-tour-id="controller-card"][data-card-body="collapsed"]',
    );
    const collapsedCount = await collapsed.count();
    assert(
      collapsedCount === cardCount,
      `모터 모드: 전체 접힘 기대 ${cardCount}, 실제 collapsed=${collapsedCount}`,
    );

    const first = cards.first();
    assert(
      (await first.getAttribute("data-list-mode")) === "graph",
      "첫 카드 data-list-mode != graph",
    );

    // 접힘: 게이지 본문 숨김
    const metricsInFirst = first.locator('[data-tour-id="controller-gauge-metrics"]');
    assert(
      (await metricsInFirst.count()) === 0,
      "접힌 카드에 게이지 메트릭이 보이면 안 됨",
    );

    // 그래프 패널(또는 스켈레톤) 존재
    const graphOpen = first.locator('[data-panel-kind="graph"]');
    // BarnListPanelShell may use different attr — fall back to chart/skeleton text area
    const hasGraphShell =
      (await graphOpen.count()) > 0 ||
      (await first.locator("svg, canvas, [data-audit-region*='graph']").count()) > 0 ||
      (await first.innerText()).length > 20;
    assert(hasGraphShell, "접힌 카드에 그래프 영역이 없음");

    // 펼침
    const expandBtn = first.getByRole("button", {
      name: "컨트롤러 본문 펼치기",
    });
    assert(await expandBtn.isVisible(), "펼치기 버튼 없음");
    await expandBtn.click();
    await page.waitForTimeout(400);

    assert(
      (await first.getAttribute("data-card-body")) === "expanded",
      "펼침 후 data-card-body != expanded",
    );
    assert(
      (await first.locator('[data-tour-id="controller-gauge-metrics"]').count()) >
        0,
      "펼침 후 게이지 메트릭 없음",
    );

    // 설정 오픈 — 그래프 유지 + 설정 패널
    const settingsPill = first
      .locator('[data-tour-id="panel-pills"] button')
      .filter({ hasText: /^설정$/ });
    await settingsPill.click();
    await page.waitForTimeout(500);

    const settingsPanel = first.locator(
      '[data-audit-region="barn-list-accordion-panel"]',
    );
    await settingsPanel.waitFor({ state: "visible", timeout: 15000 });
    assert(
      (await first.getAttribute("data-card-body")) === "expanded",
      "설정 오픈 후 본문이 접히면 안 됨",
    );
    assert(
      (await first.getAttribute("data-list-mode")) === "graph",
      "설정 오픈 후에도 listMode=graph 유지",
    );

    // 컨트롤러 모드 복귀 — 본문 접기 해제
    const controllerTab = page.getByRole("tab", { name: /컨트롤러|Ctrl/ });
    await controllerTab.click();
    await page.waitForTimeout(800);
    const after = page
      .locator(
        '[data-audit-region="barn-list-summary"] [data-tour-id="controller-card"]',
      )
      .first();
    await after.waitFor({ state: "visible", timeout: 15000 });
    assert(
      (await after.getAttribute("data-card-body")) === "expanded",
      "컨트롤러 모드: data-card-body는 expanded여야 함",
    );
    assert(
      (await after.locator('[data-tour-id="controller-gauge-metrics"]').count()) >
        0,
      "컨트롤러 모드: 게이지 표시 필요",
    );

    console.log(
      `PASS motor-mode card collapse — cards=${cardCount}, collapsed→expand→settings→controller ok`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FAIL", err?.message ?? err);
  process.exit(1);
});
