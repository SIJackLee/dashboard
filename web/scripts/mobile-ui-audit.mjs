#!/usr/bin/env node
/**
 * Mobile UI audit — 375×812, all roles, layout heuristics.
 * Usage: node scripts/mobile-ui-audit.mjs
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ensureTestPasswords, passwordForEmail, TEST_ACCOUNTS } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const VIEWPORT = { width: 375, height: 812 };

const ACCOUNTS = {
  admin: TEST_ACCOUNTS.admin.email,
  operator: TEST_ACCOUNTS.operator.email,
  viewer: TEST_ACCOUNTS.viewer.email,
};

const ROUTES = {
  admin: [
    { path: "/farm", label: "모니터링·현황(전국)" },
    { path: "/farm?tab=ops", label: "모니터링·컨트롤러(전국 허브)" },
    { path: "/farm?lsind=FARM01&item=P00", label: "모니터링·현황(농장)" },
    { path: "/farm?lsind=FARM01&item=P00&tab=ops", label: "모니터링·컨트롤러(농장)" },
    { path: "/settings", label: "설정(레거시)" },
    { path: "/admin/ops", label: "운영·시스템" },
    { path: "/admin/ops?tab=users", label: "운영·사용자" },
    { path: "/admin/ops?tab=farms", label: "운영·농장 위치" },
    { path: "/admin/ops?tab=commands", label: "운영·명령 이력" },
    { path: "/admin/health/farm/FARM01--P00", label: "레거시 health→ops redirect" },
    { path: "/admin/health/group/col-a", label: "레거시 health group→ops redirect" },
    { path: "/admin/health/collector-mqtt", label: "레거시 health node→ops redirect" },
  ],
  operator: [
    { path: "/farm", label: "모니터링·현황" },
    { path: "/farm?tab=ops", label: "모니터링·컨트롤러" },
    { path: "/settings", label: "설정" },
    { path: "/settings?tab=alarm", label: "설정·알람" },
  ],
  viewer: [
    { path: "/farm", label: "모니터링·현황" },
    { path: "/farm?tab=ops", label: "모니터링·컨트롤러" },
    { path: "/settings?tab=farm", label: "설정·농장" },
  ],
  unauthenticated: [{ path: "/login", label: "로그인" }],
};

async function ensurePasswords(adminClient) {
  await ensureTestPasswords(adminClient);
}

async function logout(page) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/farm`, { waitUntil: "load" });
  if (page.url().includes("/login")) return;
  const logout = page.getByRole("button", { name: "로그아웃" });
  if (await logout.count()) {
    await logout.click();
    await page.waitForURL((u) => u.pathname.startsWith("/login"), { timeout: 15000 });
  }
}

async function login(page, email) {
  await logout(page);
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(passwordForEmail(email));
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}

function auditPage() {
  const vw = window.innerWidth;
  const issues = [];

  /** display:none / zero box / aria-hidden — lg 전용 DOM 제외 */
  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.closest("[data-audit-desktop-only]")) return false;
    let node = el;
    while (node && node !== document.documentElement) {
      if (!(node instanceof HTMLElement)) break;
      if (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true") {
        return false;
      }
      const cs = getComputedStyle(node);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") {
        return false;
      }
      node = node.parentElement;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /** TopBar·Bottom Nav·탭 nav — 44px 터치 타겟은 정상 */
  const SHELL_ROOTS = [
    "header",
    '[aria-label="모바일 앱 메뉴"]',
    '[aria-label="모니터링 탭"]',
    '[aria-label="컨트롤러 설정 서브 탭"]',
    '[aria-label="운영 탭"]',
    '[aria-label="시스템 하위 뷰"]',
  ];

  /** 모바일 farm map 카드 — 터치 타겟 크기 허용 */
  const CONTENT_EXCLUDE = ['[data-audit-region="farm-map-list"]'];

  function isInShell(el) {
    return SHELL_ROOTS.some((sel) => el.closest(sel));
  }

  function isExcludedContent(el) {
    return CONTENT_EXCLUDE.some((sel) => el.closest(sel));
  }

  const docScrollW = document.documentElement.scrollWidth;
  if (docScrollW > vw + 2) {
    issues.push({
      code: "HORIZONTAL_OVERFLOW",
      severity: "high",
      detail: `문서 가로 스크롤 ${docScrollW}px > viewport ${vw}px`,
    });
  }

  const largeTextEls = [...document.querySelectorAll("*")].filter((el) => {
    if (!(el instanceof HTMLElement) || !isVisible(el)) return false;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    return fs >= 24;
  });
  if (largeTextEls.length > 8) {
    issues.push({
      code: "OVERSIZED_TEXT",
      severity: "medium",
      detail: `24px+ 텍스트 요소 ${largeTextEls.length}개 (PC 스케일 잔존 가능)`,
    });
  }

  const clipped = [];
  for (const el of document.querySelectorAll("button, a, span, p, td, th")) {
    if (!(el instanceof HTMLElement) || !isVisible(el)) continue;
    const t = el.textContent?.trim() ?? "";
    if (t.length < 2 || t.length > 40) continue;
    if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0) {
      clipped.push(t.slice(0, 30));
    }
  }
  const uniqueClipped = [...new Set(clipped)].slice(0, 5);
  if (uniqueClipped.length >= 3) {
    issues.push({
      code: "TEXT_CLIPPED",
      severity: "medium",
      detail: `잘린 텍스트 예: ${uniqueClipped.join(" | ")}`,
    });
  }

  const allVisibleButtons = [...document.querySelectorAll("button")].filter(isVisible);
  const shellButtons = allVisibleButtons.filter(isInShell);
  /** PC 스케일: 본문 영역에서 높이 52px+ 또는 글자 18px+ */
  /** Leaflet 지도 컨트롤 — PC 스케일 오탐 제외 */
  function isMapControl(el) {
    return !!el.closest(".leaflet-control, .leaflet-bar, [aria-label='전체 농장 지리 지도']");
  }

  const contentPcButtons = allVisibleButtons.filter((b) => {
    if (isInShell(b) || isExcludedContent(b) || isMapControl(b)) return false;
    const h = b.offsetHeight;
    const fs = parseFloat(getComputedStyle(b).fontSize);
    const label = (b.textContent?.trim() ?? "").length;
    if (label === 0 || label > 24) return false;
    return h >= 56 || fs >= 20;
  });

  if (contentPcButtons.length >= 4) {
    issues.push({
      code: "OVERSIZED_BUTTONS",
      severity: "low",
      detail: `본문 PC 스케일 버튼 ${contentPcButtons.length}개 (56px+ 또는 20px+ 글자)`,
    });
  }

  const tables = document.querySelectorAll("table");
  for (const table of tables) {
    if (!(table instanceof HTMLElement) || !isVisible(table)) continue;
    if (table.scrollWidth > vw - 16) {
      issues.push({
        code: "TABLE_OVERFLOW",
        severity: "medium",
        detail: "테이블이 뷰포트보다 넓음 (카드형 전환 필요)",
      });
      break;
    }
  }

  return {
    url: location.pathname + location.search,
    title: document.title,
    h1: document.querySelector("h1")?.textContent?.trim() ?? "",
    role: (document.body.innerText.match(/관리자|운영자|뷰어/) ?? [])[0] ?? "",
    viewportW: vw,
    docScrollW,
    issueCount: issues.length,
    issues,
    metrics: {
      visibleButtons: allVisibleButtons.length,
      shellButtons: shellButtons.length,
      contentPcButtons: contentPcButtons.length,
      largeTextNodes: largeTextEls.length,
    },
    hasGeoMap: !!document.querySelector('[aria-label="전체 농장 지리 지도"]'),
    hasMobileBottomNav: !!document.querySelector('[aria-label="모바일 앱 메뉴"]'),
    hasMobileSplitShell: !!document.querySelector('[class*="min-h-[calc(100dvh"]'),
  };
}

async function auditRoute(page, role, route, shotDir) {
  const target = `${BASE}${route.path}`;
  try {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("ERR_ABORTED") && !msg.includes("NS_BINDING_ABORTED")) {
      throw err;
    }
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  }
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
    /* dev */
  }
  await page.waitForTimeout(800);

  const data = await page.evaluate(auditPage);
  const slug = route.path.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 60);
  const shotPath = join(shotDir, `${role}_${slug}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });

  const finalUrl = page.url().replace(BASE, "");
  const redirectIssues = [];
  if (route.path.startsWith("/admin/health") && !finalUrl.startsWith("/admin/ops")) {
    redirectIssues.push({
      code: "LEGACY_HEALTH_REDIRECT",
      severity: "high",
      detail: `expected /admin/ops redirect, got ${finalUrl}`,
    });
  }
  if (route.path === "/admin/users" && !finalUrl.startsWith("/admin/ops/users")) {
    redirectIssues.push({
      code: "LEGACY_USERS_REDIRECT",
      severity: "high",
      detail: `expected /admin/ops/users redirect, got ${finalUrl}`,
    });
  }

  return {
    role,
    label: route.label,
    path: route.path,
    finalUrl,
    screenshot: shotPath,
    ...data,
    issues: [...(data.issues ?? []), ...redirectIssues],
    issueCount: (data.issueCount ?? 0) + redirectIssues.length,
  };
}

async function main() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  await ensurePasswords(adminClient);

  const outDir = join(dirname(fileURLToPath(import.meta.url)), "mobile-audit-output");
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  const results = [];

  for (const route of ROUTES.unauthenticated) {
    await logout(page);
    results.push(await auditRoute(page, "unauthenticated", route, outDir));
  }

  for (const [role, email] of Object.entries(ACCOUNTS)) {
    await login(page, email);
    for (const route of ROUTES[role]) {
      results.push(await auditRoute(page, role, route, outDir));
    }
  }

  await browser.close();

  const reportPath = join(outDir, "report.json");

  const withIssues = results.filter((r) => r.issueCount > 0);
  const clean = results.length - withIssues.length;
  const bySeverity = { high: 0, medium: 0, low: 0 };
  for (const r of withIssues) {
    for (const i of r.issues) {
      bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
    }
  }

  const report = {
    at: new Date().toISOString(),
    viewport: VIEWPORT,
    summary: {
      total: results.length,
      clean,
      withIssues: withIssues.length,
      passRate: `${Math.round((clean / results.length) * 100)}%`,
      issuesBySeverity: bySeverity,
      acceptance: {
        target: "issueCount === 0 for all routes",
        oversizedButtonsThreshold: "contentPcButtons >= 4 (height >= 56px or font >= 20px)",
      },
    },
    results,
  };

  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`Audited ${results.length} pages — ${clean} clean, ${withIssues.length} with issues`);
  for (const r of withIssues) {
    const m = r.metrics ?? {};
    console.log(`\n[${r.role}] ${r.label} (${r.path})`);
    console.log(
      `  metrics: visibleBtn=${m.visibleButtons ?? "?"} shell=${m.shellButtons ?? "?"} pcScale=${m.contentPcButtons ?? "?"}`
    );
    for (const i of r.issues) console.log(`  ${i.severity}: ${i.code} — ${i.detail}`);
  }
  console.log(`\nReport: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
