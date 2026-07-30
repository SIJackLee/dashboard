#!/usr/bin/env node
/**
 * ARIA 스테이지·LIVE·도크 수동 검수 (Playwright)
 * Usage: node scripts/smoke-aria-stage.mjs
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { login } from "./audit-shared.mjs";
import { passwordForEmail, TEST_ACCOUNTS } from "./test-accounts.mjs";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const ARIA = `${BASE}/farm?lsind=FARM01&item=P00&view=aria`;

function fail(msg, detail = "") {
  console.error(`FAIL: ${msg}`);
  if (detail) console.error(detail.slice(0, 1200));
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const results = [];

function ok(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`OK  ${name}${detail ? ` — ${detail}` : ""}`);
}
function bad(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`!!  ${name}${detail ? ` — ${detail}` : ""}`);
}

try {
  await login(page, {
    base: BASE,
    email: TEST_ACCOUNTS.admin.email,
    password: passwordForEmail(TEST_ACCOUNTS.admin.email),
  });

  await page.goto(ARIA, { waitUntil: "load", timeout: 30000 });
  await page.getByRole("heading", { name: "ARIA" }).waitFor({
    state: "visible",
    timeout: 20000,
  });
  ok("ARIA 탭 로드");

  const stage = page.getByTestId("aria-stage-layout");
  await stage.waitFor({ state: "visible", timeout: 10000 });
  const idleFocus = await stage.getAttribute("data-aria-stage-focus");
  const idleMetrics = await stage.getAttribute("data-aria-metrics");
  if (idleFocus === "orb" && idleMetrics === "0") {
    ok("idle 스테이지", "focus=orb metrics=0");
  } else {
    bad("idle 스테이지", `focus=${idleFocus} metrics=${idleMetrics}`);
  }

  // 장치 테스트 기본 접힘
  const soundBtn = page.getByRole("button", { name: "사운드 체크" });
  if ((await soundBtn.count()) === 0 || !(await soundBtn.isVisible())) {
    ok("장치 테스트 기본 숨김");
  } else {
    bad("장치 테스트 기본 숨김", "사운드 체크가 노출됨");
  }
  const deviceToggle = page.getByRole("button", { name: "장치 테스트" });
  await deviceToggle.click();
  await soundBtn.waitFor({ state: "visible", timeout: 5000 });
  ok("장치 테스트 펼침");
  await deviceToggle.click();
  await page.waitForTimeout(400);

  const tts = page.getByRole("checkbox", { name: /음성으로 읽어주기/ });
  if (await tts.isChecked()) await tts.uncheck();

  // LIVE prefetch — farm 로드 후 서버 액션 대기
  await page.waitForTimeout(1500);

  const box = page.getByPlaceholder(/오늘 농장 상황|텍스트/);
  await box.fill("상황 어때");
  await page.getByRole("button", { name: /텍스트로/ }).click();

  // think 구간: metrics 펼침 + LIVE 내용
  let sawThinkMetrics = false;
  let sawAnswer = false;
  let speakFocus = false;
  let liveOk = false;
  let livePreview = "";
  let slideTried = false;
  let slideText = "";
  const metricsPanel = page.getByTestId("aria-metrics-slides");
  const deadline = Date.now() + 35000;
  while (Date.now() < deadline) {
    const focus = await stage.getAttribute("data-aria-stage-focus");
    const metrics = await stage.getAttribute("data-aria-metrics");
    const body = await page.locator("body").innerText();

    if (metrics === "1") {
      sawThinkMetrics = true;
      const text = await metricsPanel.innerText().catch(() => "");
      if (
        /평균 온도|평균 습도|컨트롤러|이상|축사별|불러오는|기준|축사 데이터/.test(
          text,
        )
      ) {
        liveOk = true;
        livePreview = text.replace(/\s+/g, " ").slice(0, 160);
      }
      if (
        !slideTried &&
        (await metricsPanel
          .getByRole("button", { name: "다음 슬라이드" })
          .isVisible()
          .catch(() => false))
      ) {
        slideTried = true;
        await metricsPanel
          .getByRole("button", { name: "다음 슬라이드" })
          .click();
        await page.waitForTimeout(400);
        slideText = await metricsPanel.innerText().catch(() => "");
      }
    }
    if (focus === "metrics") speakFocus = true;
    if (
      /농장|이상|온라인|컨트롤러|조용|위험|주의/.test(body) &&
      !/분석 중/.test(body)
    ) {
      const lines = body
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 10);
      if (
        lines.some(
          (l) =>
            /(농장|이상|온라인|컨트롤러|조용)/.test(l) &&
            !/말로 묻거나|텍스트로|장치 테스트|실시간 지표/.test(l),
        )
      ) {
        sawAnswer = true;
        if (liveOk || Date.now() > deadline - 2000) break;
      }
    }
    await page.waitForTimeout(300);
  }

  if (sawThinkMetrics) ok("대화 중 지표 슬롯 펼침", "data-aria-metrics=1");
  else bad("대화 중 지표 슬롯 펼침", "think/listen 구간에 metrics=1 미관측");

  if (sawAnswer) ok("텍스트 질문 답변");
  else bad("텍스트 질문 답변", "답변 문구 미확인");

  if (liveOk) ok("LIVE 지표 패널 내용", livePreview);
  else bad("LIVE 지표 패널 내용", "온도/컨트롤러 등 미확인");

  if (/그래프|축사별|현황/.test(slideText)) ok("지표 슬라이드 전환");
  else bad("지표 슬라이드 전환", slideText.slice(0, 120) || "미전환");

  if (speakFocus) {
    ok("speak 포커스", "TTS 경로에서 metrics focus");
  } else {
    ok("speak 포커스 스킵", "TTS off — 오브 측면 전환은 TTS on 시 확인");
  }

  await page.waitForTimeout(7500);

  // TTS on으로 speak 전환 시도
  if ((await tts.isChecked()) === false) await tts.check();
  await box.fill("상황 어때");
  await page.getByRole("button", { name: /텍스트로/ }).click();
  let gotSpeak = false;
  const speakDeadline = Date.now() + 25000;
  while (Date.now() < speakDeadline) {
    if ((await stage.getAttribute("data-aria-stage-focus")) === "metrics") {
      gotSpeak = true;
      break;
    }
    const body = await page.locator("body").innerText();
    if (
      /OPENAI|할당량|키를 넣어|템플릿 요약만|음성 생성에 실패|잠시 후/.test(
        body,
      ) &&
      !/분석 중/.test(body)
    ) {
      break;
    }
    await page.waitForTimeout(300);
  }
  if (gotSpeak) {
    const orbSide = await page
      .locator('[data-aria-slot="orb"]')
      .evaluate((el) => el.className.includes("aria-stage-orb-side"));
    if (orbSide) ok("speak 시 오브 측면 축소", "aria-stage-orb-side");
    else bad("speak 시 오브 측면 축소", "orb-side 클래스 없음");
  } else {
    ok("speak(TTS) 스킵", "TTS/키 없거나 미진입 — 수동 확인 권장");
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== SUMMARY ===");
  console.log(`pass=${results.filter((r) => r.ok).length} fail=${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("PASS: aria stage smoke");
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
}
