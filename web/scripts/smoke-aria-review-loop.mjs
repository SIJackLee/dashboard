#!/usr/bin/env node
/**
 * ARIA 검수 루프 — 다양 질문 → 기대 route/depth 대조 → 맞음/틀림 표시
 * Usage: node scripts/smoke-aria-review-loop.mjs
 *        node scripts/smoke-aria-review-loop.mjs --mark-only
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
const MARK_ONLY = process.argv.includes("--mark-only");

/** @type {{ q: string, route: string, depth?: number }[]} */
const CASES = [
  { q: "안녕", route: "CHAT" },
  { q: "날씨 어때", route: "CHAT" },
  { q: "지금 어때", route: "CHAT" },
  { q: "상황 어때", route: "FARM", depth: 1 },
  { q: "뭐가 문제야", route: "FARM", depth: 2 },
  { q: "어느 컨트롤러", route: "FARM", depth: 3 },
  { q: "진단해줘", route: "FARM", depth: 4 },
  { q: "설정 추천", route: "CTRL" },
  { q: "알람 상한 낮춰줘", route: "CTRL" },
  { q: "환기 어떻게", route: "CTRL" },
];

function expectKey(q) {
  return CASES.find((c) => c.q === q) ?? null;
}

function judge(row) {
  const exp = expectKey(row.question);
  if (!exp) return null;
  if (row.route !== exp.route) {
    return { ok: false, reason: `route ${row.route}≠${exp.route}` };
  }
  if (exp.depth != null && row.depth !== exp.depth) {
    return { ok: false, reason: `depth D${row.depth}≠D${exp.depth}` };
  }
  return { ok: true, reason: "route/depth match" };
}

async function ask(page, question, attempt = 1) {
  const res = await page.request.post(`${BASE}/api/voice-report/ask`, {
    data: {
      question,
      withTts: false,
      currentLsind: "FARM01",
      currentItem: "P00",
    },
    headers: { "Content-Type": "application/json" },
  });
  const raw = await res.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    if (attempt < 4) {
      await page.waitForTimeout(2000 * attempt);
      return ask(page, question, attempt + 1);
    }
    return { question, ok: false, error: `non_json_${res.status()}` };
  }
  if (!body.ok) {
    const msg = String(body.message ?? body.error ?? "");
    if (attempt < 5 && (/잠시|rate|limit/i.test(msg) || res.status() === 429)) {
      await page.waitForTimeout(8000);
      return ask(page, question, attempt + 1);
    }
    if (attempt < 3 && res.status() >= 500) {
      await page.waitForTimeout(2000 * attempt);
      return ask(page, question, attempt + 1);
    }
    return {
      question,
      ok: false,
      error: body.message ?? body.error ?? res.status(),
    };
  }
  return {
    question,
    ok: true,
    route: body.ariaRoute ?? null,
    depth: body.ariaSession?.depth ?? null,
    text: String(body.text ?? "").slice(0, 100),
  };
}

function parseDepth(raw) {
  const t = raw.trim();
  if (t.startsWith("D") && t.length > 1) return Number(t.slice(1));
  return null;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const askResults = [];
const marks = [];

try {
  await login(page, {
    base: BASE,
    email: TEST_ACCOUNTS.admin.email,
    password: passwordForEmail(TEST_ACCOUNTS.admin.email),
  });

  if (!MARK_ONLY) {
    console.log("=== ASK (간격 7s, rate limit 회피) ===");
    for (const c of CASES) {
      const r = await ask(page, c.q);
      askResults.push(r);
      const live =
        r.ok &&
        r.route === c.route &&
        (c.depth == null || r.depth === c.depth);
      console.log(
        `${live ? "OK " : "!! "} ${c.q} → ${r.route ?? "ERR"} D${r.depth ?? "-"} | expect ${c.route}${c.depth != null ? ` D${c.depth}` : ""}${r.text ? ` | ${r.text}` : r.error ? ` | ${r.error}` : ""}`,
      );
      await page.waitForTimeout(7000);
    }
  }

  await page.goto(`${BASE}/admin/ops#aria-logs`, {
    waitUntil: "load",
    timeout: 30000,
  });
  await page.getByRole("heading", { name: "ARIA 턴 로그" }).waitFor({
    state: "visible",
    timeout: 20000,
  });
  await page.waitForTimeout(1500);

  const region = page.locator('[data-audit-region="aria-turn-logs"]');
  await page.getByRole("button", { name: "검수 전체" }).click();
  await page.waitForTimeout(1500);

  // 테이블 행 (데스크톱)
  let rows = region.locator("tbody tr");
  let n = await rows.count();
  if (n === 0) {
    rows = region.locator("ul > li");
    n = await rows.count();
  }
  console.log(`\n=== REVIEW (${n}행) ===`);

  for (let i = 0; i < n; i++) {
    const row = rows.nth(i);
    // 이미 검수된 행은 「검수 취소」가 있음 → 스킵
    if ((await row.getByRole("button", { name: "검수 취소" }).count()) > 0) {
      continue;
    }

    let question;
    let route;
    let depth;
    const tds = row.locator("td");
    if ((await tds.count()) >= 4) {
      question = (await tds.nth(3).innerText()).trim();
      route = (await tds.nth(1).innerText()).trim();
      depth = parseDepth(await tds.nth(2).innerText());
    } else {
      const text = await row.innerText();
      const qLine = text.split("\n").find((l) => l.startsWith("Q. "));
      question = qLine ? qLine.replace(/^Q\.\s*/, "").trim() : "";
      const routeMatch = text.match(/\b(CHAT|FARM|CTRL)\b/);
      route = routeMatch?.[1] ?? "";
      const dMatch = text.match(/\bD([1-4])\b/);
      depth = dMatch ? Number(dMatch[1]) : null;
    }

    const verdict = judge({ question, route, depth });
    if (!verdict) {
      console.log(`skip  ${question} (${route} D${depth ?? "-"})`);
      continue;
    }

    const btnName = verdict.ok ? "맞음으로 표시" : "틀림으로 표시";
    await row.getByRole("button", { name: btnName }).click();
    await page.waitForTimeout(700);
    marks.push({
      question,
      route,
      depth,
      feedback: verdict.ok ? "ok" : "bad",
      reason: verdict.reason,
    });
    console.log(
      `${verdict.ok ? "ok " : "bad"} ${question} | ${route} D${depth ?? "-"} | ${verdict.reason}`,
    );
  }

  const badAsk = askResults.filter((r) => {
    const exp = expectKey(r.question);
    if (!exp || !r.ok) return true;
    if (r.route !== exp.route) return true;
    if (exp.depth != null && r.depth !== exp.depth) return true;
    return false;
  });
  const badMarks = marks.filter((m) => m.feedback === "bad");

  console.log("\n=== SUMMARY ===");
  if (!MARK_ONLY) {
    console.log(`asked=${askResults.length} ask_mismatch=${badAsk.length}`);
  }
  console.log(`marked=${marks.length} marked_bad=${badMarks.length}`);
  for (const m of badMarks) {
    console.log(`  BAD ${m.question}: ${m.reason}`);
  }
} finally {
  await browser.close();
}
