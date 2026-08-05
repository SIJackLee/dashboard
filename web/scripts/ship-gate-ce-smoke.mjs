#!/usr/bin/env node
/**
 * 출고마다 C/E 보조: LIVE 표본 값 + ARIA 탭 스모크
 * Usage: node scripts/ship-gate-ce-smoke.mjs  (dev 서버 실행 중)
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { writeFileSync, mkdirSync } from "fs";
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
const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "mobile-audit-output",
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && key, "SUPABASE URL/service_role 필요");
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await ensureTestPasswords(admin);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const report = { ok: false, at: new Date().toISOString(), base: BASE };

  try {
    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.admin.email,
      password: passwordForEmail(TEST_ACCOUNTS.admin.email),
    });

    // C — list view LIVE sample
    await page.goto(`${BASE}/farm?lsind=FARM01&item=P00&view=list`, {
      waitUntil: "load",
    });
    await page.waitForTimeout(3000);
    const listText = await page.locator("body").innerText();
    assert(/임신사/.test(listText), "C: 임신사 없음");
    const tempMatch = listText.match(/(-?\d+(?:\.\d+)?)\s*℃/);
    const humMatch = listText.match(/(\d+(?:\.\d+)?)\s*%/);
    report.dataSample = {
      hasBarns: true,
      tempC: tempMatch ? Number(tempMatch[1]) : null,
      humidityOrMotorPct: humMatch ? Number(humMatch[1]) : null,
      hasZeroOrDash: /(?:^|\s)(?:–|-|—|\b0\b)/m.test(listText),
      snippet: listText.replace(/\s+/g, " ").slice(0, 400),
    };
    assert(
      report.dataSample.tempC != null || /통신|오프라인|단절|지연/.test(listText),
      "C: 온도값 또는 단절/지연 상태 문구 없음",
    );

    // E — ARIA tab
    await page.goto(`${BASE}/farm?lsind=FARM01&item=P00&view=aria`, {
      waitUntil: "load",
    });
    await page.waitForTimeout(2500);
    const ariaText = await page.locator("body").innerText();
    const ariaHidden =
      /준비 중|곧 제공|비활성|숨김|DELIN.*off/i.test(ariaText) &&
      !/질의|질문|음성|델린|ARIA/i.test(ariaText);
    report.delin = {
      pageLoaded: true,
      bodyHasInternalIds: /farmKey|alarmItems|FARM01\/P00|lsindRegistNo/.test(
        ariaText,
      ),
      hasUiChrome: /델린|DELIN|ARIA|질의|질문|차트/.test(ariaText),
      likelyDisabled: ariaHidden,
      snippet: ariaText.replace(/\s+/g, " ").slice(0, 500),
    };
    assert(!report.delin.bodyHasInternalIds, "E: 내부 ID/필드명 노출");

    if (report.delin.hasUiChrome && !report.delin.likelyDisabled) {
      const textAsk = page.getByRole("button", { name: /글로 묻기/ }).first();
      if (await textAsk.isVisible().catch(() => false)) {
        await textAsk.click();
        await page.waitForTimeout(500);
      }
      const input = page
        .locator(
          'textarea[placeholder*="질문"], textarea, input[placeholder*="질문"]',
        )
        .first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill("지금 농장 상태 간단히 알려줘");
        const send = page
          .locator(
            'button:has-text("보내"), button:has-text("전송"), button[type="submit"]',
          )
          .first();
        if (await send.isVisible().catch(() => false)) {
          await send.click();
          await page.waitForTimeout(10000);
          const after = await page.locator("body").innerText();
          report.delin.asked = true;
          report.delin.appliedHallucination =
            /적용했습니다|명령을 전송했습니다/.test(after);
          report.delin.internalIdsAfter =
            /farmKey|alarmItems|lsindRegistNo/.test(after);
          assert(!report.delin.appliedHallucination, "E: CTRL 적용 환각");
          assert(!report.delin.internalIdsAfter, "E: 답변 내부 ID 노출");
          report.delin.afterSnippet = after.replace(/\s+/g, " ").slice(0, 600);
        } else {
          report.delin.asked = false;
          report.delin.note = "전송 버튼 없음 — UI 스모크만";
        }
      } else {
        report.delin.asked = false;
        report.delin.note = "입력창 없음 — companion/게이트 확인";
      }
    }

    report.ok = true;
  } finally {
    await browser.close();
    mkdirSync(OUT_DIR, { recursive: true });
    const out = join(OUT_DIR, "ship-gate-ce-report.json");
    writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
    console.log(report.ok ? `PASS CE → ${out}` : `FAIL CE → ${out}`);
    console.log(JSON.stringify(report, null, 2));
  }
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
