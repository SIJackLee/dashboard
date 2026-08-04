#!/usr/bin/env node
/**
 * ARIA UI 빠른 스모크 — TTS off + 「상황 어때」
 * Usage: node scripts/smoke-aria-ui-ask.mjs  (dev 서버 필요)
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

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const t0 = Date.now();

  try {
    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.admin.email,
      password: passwordForEmail(TEST_ACCOUNTS.admin.email),
    });

    await page.goto(ARIA, { waitUntil: "load", timeout: 30000 });
    await page.getByRole("heading", { name: /DELIN|델린|ARIA/ }).waitFor({
      state: "visible",
      timeout: 20000,
    });

    // 옵션 패널을 펼친 뒤 TTS(읽어주기) 끄기
    const optionsToggle = page.getByTestId("delin-options-toggle");
    await optionsToggle.waitFor({ state: "visible", timeout: 15000 });
    await optionsToggle.click();
    const tts = page.getByRole("checkbox", { name: /읽어주기/ });
    await tts.waitFor({ state: "visible", timeout: 10000 });
    if (await tts.isChecked()) {
      await tts.uncheck();
    }
    if (await tts.isChecked()) {
      throw new Error("TTS 체크를 끄지 못했습니다");
    }

    // 텍스트 입력: 「글로 묻기」 펼친 뒤 textarea + 보내기
    const textToggle = page.getByTestId("delin-text-ask-toggle");
    await textToggle.waitFor({ state: "visible", timeout: 15000 });
    await textToggle.click();
    const box = page.getByLabel("텍스트 질문");
    await box.waitFor({ state: "visible", timeout: 10000 });
    await box.fill("상황 어때");
    await page.getByRole("button", { name: "보내기" }).click();

    await page.getByText("분석 중").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});

    const deadline = Date.now() + 25000;
    let answer = "";
    while (Date.now() < deadline) {
      const body = await page.locator("body").innerText();
      if (/분석 중/.test(body)) {
        await page.waitForTimeout(400);
        continue;
      }
      // 답변 영역: 자막/본문에 농장·이상 관련 문장
      if (
        /농장|이상상황|이상|위험|주의|온라인|활성|컨트롤러/.test(body) &&
        !/말로 묻거나/.test(body.split("\n").find((l) => /농장|이상/.test(l)) ?? "")
      ) {
        const lines = body
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        answer =
          lines.find(
            (l) =>
              /(농장|이상상황|이상|위험|주의|온라인|활성)/.test(l) &&
              l.length > 12 &&
              !/말로 묻거나|텍스트로 요약|질문을 입력|글로 묻기|사운드 체크/.test(l),
          ) ?? "";
        if (answer) break;
      }
      await page.waitForTimeout(400);
    }

    const ms = Date.now() - t0;
    if (!answer) {
      const snippet = (await page.locator("body").innerText()).slice(0, 800);
      console.error("FAIL: 답변 미확인");
      console.error(snippet);
      process.exit(1);
    }

    console.log("PASS");
    console.log(`elapsed_ms=${ms}`);
    console.log(`tts=off`);
    console.log(`question=상황 어때`);
    console.log(`answer=${answer}`);
    process.exit(0);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
