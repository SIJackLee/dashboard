#!/usr/bin/env node
/**
 * P2-2 재현: DELIN 글로 묻기 후 URL/로그인 전이 여부
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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE URL/service_role 필요");
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await ensureTestPasswords(admin);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const askCalls = [];
  page.on("response", async (res) => {
    if (!res.url().includes("/api/voice-report/ask")) return;
    let body = "";
    try {
      body = (await res.text()).slice(0, 400);
    } catch {
      /* ignore */
    }
    askCalls.push({
      status: res.status(),
      url: res.url(),
      body,
    });
  });

  const report = { at: new Date().toISOString(), base: BASE, steps: [] };

  try {
    await login(page, {
      base: BASE,
      email: TEST_ACCOUNTS.admin.email,
      password: passwordForEmail(TEST_ACCOUNTS.admin.email),
    });
    report.steps.push({ step: "login", url: page.url() });

    await page.goto(`${BASE}/farm?lsind=FARM01&item=P00&view=aria`, {
      waitUntil: "load",
    });
    await page.waitForTimeout(2500);
    report.steps.push({
      step: "aria_loaded",
      url: page.url(),
      hasLogout: /로그아웃/.test(await page.locator("body").innerText()),
      hasLoginForm: /비밀번호/.test(await page.locator("body").innerText()) &&
        /로그인/.test(await page.locator("body").innerText()),
    });

    await page.getByTestId("delin-text-ask-toggle").click();
    await page.waitForTimeout(400);
    await page.locator('textarea[aria-label="텍스트 질문"]').fill(
      "지금 농장 상태 간단히 알려줘",
    );
    await page.getByRole("button", { name: "보내기" }).click();

    // poll URL for 15s
    const urlTrail = [];
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      urlTrail.push({ t: i + 1, url: page.url() });
    }
    const body = await page.locator("body").innerText();
    report.askCalls = askCalls;
    report.urlTrail = urlTrail;
    report.after = {
      url: page.url(),
      stillOnFarm: /\/farm/.test(page.url()),
      hasLogout: /로그아웃/.test(body),
      looksLikeLoginPage:
        /아이디|비밀번호/.test(body) &&
        /Google로 로그인|카카오로 로그인/.test(body) &&
        !/로그아웃/.test(body),
      hasAnswerSurface: /델린|DELIN|대기|답변|정상|농장/.test(body),
      snippet: body.replace(/\s+/g, " ").slice(0, 700),
    };
    report.ok =
      report.after.stillOnFarm &&
      !report.after.looksLikeLoginPage &&
      askCalls.some((c) => c.status >= 200 && c.status < 300);

    mkdirSync(OUT_DIR, { recursive: true });
    const out = join(OUT_DIR, "p2-2-delin-redirect-report.json");
    writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
    console.log(report.ok ? `P2-2 PASS (no login divert) → ${out}` : `P2-2 FAIL/REPRO → ${out}`);
    console.log(JSON.stringify({
      ok: report.ok,
      afterUrl: report.after.url,
      looksLikeLoginPage: report.after.looksLikeLoginPage,
      askStatuses: askCalls.map((c) => c.status),
      urlChanged: urlTrail.some((u) => !/\/farm/.test(u.url)),
    }, null, 2));
  } finally {
    await browser.close();
  }
  if (!report.ok) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
