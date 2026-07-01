#!/usr/bin/env node
/**
 * UI route verification — Admin / Operator / Viewer + unauthenticated.
 * Usage: npx --yes playwright@1.50.0 install chromium && node scripts/ui-route-verify.mjs
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ensureTestPasswords, passwordForEmail, TEST_ACCOUNTS } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";

const ACCOUNTS = {
  admin: TEST_ACCOUNTS.admin.email,
  operator: TEST_ACCOUNTS.operator.email,
  viewer: TEST_ACCOUNTS.viewer.email,
};

async function ensurePasswords(adminClient) {
  await ensureTestPasswords(adminClient);
}

async function logoutIfNeeded(page) {
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
  await logoutIfNeeded(page);
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  if (!page.url().includes("/login")) {
    throw new Error(`Expected /login before sign-in, got ${page.url()}`);
  }
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(passwordForEmail(email));
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}

async function pageAudit(page) {
  await page.waitForLoadState("load");
  await page.waitForSelector('nav[aria-label="앱 메뉴"], h1', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  return page.evaluate(() => {
    const url = location.pathname + location.search;
    const t = document.body?.innerText ?? "";
    const nav = [
      ...document.querySelectorAll(
        'nav[aria-label="앱 메뉴"] a, nav[aria-label="모바일 하단 메뉴"] a, aside a'
      ),
    ].map((a) => ({
      label: a.textContent?.trim() ?? "",
      active: a.className.includes("emerald-50"),
    }));
    return {
      url,
      finalUrl: location.href.replace(location.origin, ""),
      h1: document.querySelector("h1")?.textContent?.trim() ?? "",
      is404: /404|could not be found/i.test(t),
      hasGeo: !!document.querySelector('[aria-label="전체 농장 지리 지도"]'),
      hasOpsNav: nav.some((n) => n.label === "운영"),
      opsActive: nav.find((n) => n.label === "운영")?.active ?? false,
      monitorActive: nav.find((n) => n.label === "모니터링")?.active ?? false,
      settingsActive: nav.find((n) => n.label === "설정")?.active ?? false,
      role: (t.match(/관리자|운영자|뷰어/) ?? [])[0] ?? "",
      settingsTabs: [...document.querySelectorAll("button")]
        .map((b) => b.textContent?.trim())
        .filter((x) => x === "표시" || x === "농장" || x === "알람"),
      monitorTabCurrent: [...document.querySelectorAll('nav[aria-label="모니터링 탭"] button')]
        .filter((b) => b.getAttribute("aria-current") === "page")
        .map((b) => b.textContent?.trim()),
      opsTabCurrent: [...document.querySelectorAll('nav[aria-label="운영 탭"] button')]
        .filter((b) => b.getAttribute("aria-current") === "page")
        .map((b) => b.textContent?.trim()),
    };
  });
}

function expect(audit, rules) {
  const errors = [];
  if (rules.urlIncludes) {
    for (const s of rules.urlIncludes) {
      if (!audit.finalUrl.includes(s)) errors.push(`URL missing "${s}" (got ${audit.finalUrl})`);
    }
  }
  if (rules.urlExcludes) {
    for (const s of rules.urlExcludes) {
      if (audit.finalUrl.includes(s)) errors.push(`URL should not include "${s}"`);
    }
  }
  if (rules.mustHaveText) {
    for (const s of rules.mustHaveText) {
      // checked via re-fetch in page - use h1/role as proxy where possible
    }
  }
  if (rules.no404 && audit.is404) errors.push("404 page");
  if (rules.hasGeo === true && !audit.hasGeo) errors.push("expected geo map");
  if (rules.hasGeo === false && audit.hasGeo) errors.push("unexpected geo map");
  if (rules.hasOpsNav === true && !audit.hasOpsNav) errors.push("missing 운영 nav");
  if (rules.hasOpsNav === false && audit.hasOpsNav) errors.push("unexpected 운영 nav");
  if (rules.opsActive === true && !audit.opsActive) errors.push("운영 nav not active");
  if (rules.monitorActive === true && !audit.monitorActive) errors.push("모니터링 nav not active");
  if (rules.settingsActive === true && !audit.settingsActive) errors.push("설정 nav not active");
  if (rules.role && audit.role !== rules.role) errors.push(`role expected ${rules.role}, got ${audit.role}`);
  if (rules.settingsTabs) {
    const a = [...audit.settingsTabs].sort().join(",");
    const e = [...rules.settingsTabs].sort().join(",");
    if (a !== e) errors.push(`settings tabs expected [${e}] got [${a}]`);
  }
  if (rules.monitorTab && !rules.monitorTab.some((t) => audit.monitorTabCurrent.includes(t))) {
    errors.push(`monitor tab expected one of ${rules.monitorTab.join("|")} got ${audit.monitorTabCurrent}`);
  }
  if (rules.opsTab && !rules.opsTab.some((t) => audit.opsTabCurrent.includes(t))) {
    errors.push(`ops tab expected one of ${rules.opsTab.join("|")} got ${audit.opsTabCurrent}`);
  }
  return errors;
}

const CASES = {
  unauthenticated: [
    { path: "/farm", rules: { urlIncludes: ["/login"], no404: true } },
    { path: "/admin/ops", rules: { urlIncludes: ["/login"], no404: true } },
    { path: "/", rules: { urlIncludes: ["/login"], no404: true } },
  ],
  admin: [
    { path: "/farm", rules: { urlIncludes: ["/farm"], hasGeo: true, hasOpsNav: true, monitorActive: true, role: "관리자", monitorTab: ["현황"] } },
    { path: "/farm?tab=ops", rules: { urlIncludes: ["tab=ops"], hasGeo: false, monitorActive: true, monitorTab: ["컨트롤러"] } },
    { path: "/farm?tab=devices", rules: { urlIncludes: ["tab=ops"], hasGeo: false, monitorActive: true, monitorTab: ["컨트롤러"] } },
    { path: "/farm?tab=alarms", rules: { urlIncludes: ["tab=ops"], monitorActive: true, monitorTab: ["컨트롤러"] } },
    { path: "/farm?tab=invalid", rules: { urlIncludes: ["tab=invalid"], hasGeo: true, monitorTab: ["현황"] } },
    { path: "/farm?lsind=FARM01&item=P00", rules: { urlIncludes: ["lsind=FARM01"], hasGeo: false, monitorTab: ["현황"] } },
    { path: "/farm?lsind=FARM01&item=P00&tab=ops", rules: { urlIncludes: ["tab=ops", "lsind=FARM01"], monitorTab: ["컨트롤러"] } },
    { path: "/farm?lsind=FARM01&item=P00&tab=devices", rules: { urlIncludes: ["tab=ops", "lsind=FARM01"], monitorTab: ["컨트롤러"] } },
    { path: "/farm?lsind=FARM01&item=P00&tab=alarms", rules: { urlIncludes: ["tab=ops"], monitorTab: ["컨트롤러"] } },
    { path: "/farm?view=overview", rules: { urlIncludes: ["/farm"], urlExcludes: ["view=overview"] } },
    { path: "/controllers", rules: { urlIncludes: ["tab=ops"], monitorTab: ["컨트롤러"] } },
    { path: "/controllers?lsind=FARM01&item=P00", rules: { urlIncludes: ["lsind=FARM01", "tab=ops"] } },
    { path: "/alarms", rules: { urlIncludes: ["tab=ops"], monitorTab: ["컨트롤러"] } },
    { path: "/settings", rules: { urlIncludes: ["/settings"], settingsActive: true, settingsTabs: ["표시", "알람"], role: "관리자" } },
    { path: "/settings?tab=alarm", rules: { urlIncludes: ["tab=alarm"], settingsTabs: ["표시", "알람"] } },
    { path: "/settings?tab=farm", rules: { urlIncludes: ["tab=farm"], settingsTabs: ["표시", "알람"] } },
    { path: "/admin/ops", rules: { urlIncludes: ["/admin/ops"], opsActive: true, opsTab: ["시스템"] } },
    { path: "/admin/ops?tab=users", rules: { urlIncludes: ["tab=users"], opsActive: true, opsTab: ["사용자"] } },
    { path: "/admin/ops?tab=farms", rules: { urlIncludes: ["tab=farms"], opsActive: true, opsTab: ["농장 위치"] } },
    { path: "/admin/ops?tab=bad", rules: { urlIncludes: ["tab=bad"], opsActive: true, opsTab: ["시스템"] } },
    { path: "/admin/health", rules: { urlIncludes: ["/admin/ops"], opsActive: true } },
    { path: "/admin/users", rules: { urlIncludes: ["tab=users"], opsActive: true } },
    { path: "/admin/health/farm/FARM01--P00", rules: { urlIncludes: ["/admin/health/farm/FARM01--P00"], opsActive: true, no404: true } },
    { path: "/admin/health/group/col-a", rules: { urlIncludes: ["/admin/health/group/col-a"], opsActive: true, no404: true } },
    { path: "/admin/health/collector-mqtt", rules: { urlIncludes: ["/admin/health/collector-mqtt"], opsActive: true, no404: true } },
    { path: "/play", rules: { urlIncludes: ["/farm"], urlExcludes: ["/play"] } },
    { path: "/pending", rules: { urlIncludes: ["/farm"], urlExcludes: ["/pending"] } },
  ],
  operator: [
    { path: "/farm", rules: { urlIncludes: ["/farm"], hasGeo: false, hasOpsNav: false, role: "운영자", monitorTab: ["현황"] } },
    { path: "/farm?tab=ops", rules: { urlIncludes: ["tab=ops"], hasOpsNav: false, monitorTab: ["컨트롤러"] } },
    { path: "/farm?tab=devices", rules: { urlIncludes: ["tab=ops"], hasOpsNav: false, monitorTab: ["컨트롤러"] } },
    { path: "/farm?tab=alarms", rules: { urlIncludes: ["tab=ops"], hasOpsNav: false, monitorTab: ["컨트롤러"] } },
    { path: "/settings", rules: { settingsTabs: ["표시", "농장", "알람"], hasOpsNav: false, role: "운영자" } },
    { path: "/settings?tab=farm", rules: { urlIncludes: ["tab=farm"], settingsTabs: ["표시", "농장", "알람"] } },
    { path: "/admin/ops", rules: { urlIncludes: ["/farm"], urlExcludes: ["/admin"], hasOpsNav: false } },
    { path: "/admin/health", rules: { urlIncludes: ["/farm"], hasOpsNav: false } },
    { path: "/controllers", rules: { urlIncludes: ["tab=ops"], hasOpsNav: false } },
  ],
  viewer: [
    { path: "/farm", rules: { role: "뷰어", hasOpsNav: false } },
    { path: "/settings?tab=farm", rules: { urlIncludes: ["tab=farm"], role: "뷰어", hasOpsNav: false } },
    { path: "/admin/ops", rules: { urlIncludes: ["/farm"], hasOpsNav: false } },
  ],
};

async function runSuite(page, suiteName, cases, loginEmail) {
  const results = [];
  if (loginEmail) {
    await login(page, loginEmail);
  } else {
    await logoutIfNeeded(page);
  }

  for (const c of cases) {
    await page.goto(`${BASE}${c.path}`, { waitUntil: "load", timeout: 45000 });
    try {
      await page.waitForLoadState("networkidle", { timeout: 8000 });
    } catch {
      /* dev HMR / streaming */
    }
    const snapshot = await pageAudit(page);
    const errors = expect(snapshot, c.rules);
    results.push({
      suite: suiteName,
      path: c.path,
      pass: errors.length === 0,
      errors,
      audit: snapshot,
    });
  }
  return results;
}

async function clickMonitoringTab(page, label) {
  const tab = page.locator('nav[aria-label="모니터링 탭"] button', { hasText: label });
  if ((await tab.count()) === 0) return false;
  await tab.click();
  await page.waitForTimeout(900);
  return true;
}

async function runAlarmBellCheck(page) {
  const pageErrors = [];
  const onPageError = (err) => pageErrors.push(String(err));
  page.on("pageerror", onPageError);
  try {
    await page.getByRole("button", { name: /^알림/ }).click({ timeout: 15000 });
    await page.waitForTimeout(600);
  } catch (e) {
    pageErrors.push(String(e));
  }
  const bellText = await page.evaluate(() => document.body.innerText);
  page.off("pageerror", onPageError);

  const errors = [];
  if (!bellText.includes("센서 알림")) errors.push("missing 센서 알림 section");
  if (!bellText.includes("기상 특보")) errors.push("missing 기상 특보 section");
  if (!bellText.includes("출처: 기상청")) errors.push("missing 출처: 기상청");
  for (const e of pageErrors) {
    if (e.includes("MenuGroupContext") || e.includes("Timeout")) errors.push(e);
  }

  return {
    suite: "interaction",
    path: "alarm bell menu open",
    pass: errors.length === 0,
    errors,
    audit: {
      hasSensorSection: bellText.includes("센서 알림"),
      hasWeatherSection: bellText.includes("기상 특보"),
    },
  };
}

async function runInteractions(page, role) {
  const results = [];
  if (role === "admin") {
    await page.goto(`${BASE}/farm?tab=ops`, { waitUntil: "load" });
    let snap = await pageAudit(page);
    results.push({
      suite: "interaction",
      path: "admin national hub (ops + geo)",
      pass: snap.hasGeo && snap.finalUrl.includes("tab=ops"),
      errors: snap.hasGeo ? [] : ["expected geo on admin national ops hub"],
      audit: snap,
    });

    await page.goto(`${BASE}/farm?tab=ops&lsind=FARM01&item=P00`, { waitUntil: "load" });
    results.push(await runAlarmBellCheck(page));

    snap = await pageAudit(page);
    results.push({
      suite: "interaction",
      path: "admin scoped ops hub",
      pass: snap.finalUrl.includes("lsind=FARM01"),
      errors: snap.finalUrl.includes("lsind=FARM01")
        ? []
        : ["missing farm scope in URL"],
      audit: snap,
    });

    await page.goto(`${BASE}/farm`, { waitUntil: "load" });
    if (await clickMonitoringTab(page, "컨트롤러")) {
      await clickMonitoringTab(page, "현황");
      snap = await pageAudit(page);
      results.push({
        suite: "interaction",
        path: "monitoring tab cycle (when visible)",
        pass: snap.monitorTabCurrent.includes("현황") || snap.hasGeo,
        errors:
          snap.monitorTabCurrent.includes("현황") || snap.hasGeo
            ? []
            : ["expected 현황 tab or geo map after cycle"],
        audit: snap,
      });
    }

    await page.getByRole("link", { name: "운영" }).click();
    await page.waitForTimeout(900);
    snap = await pageAudit(page);
    results.push({
      suite: "interaction",
      path: "sidebar 운영 click",
      pass: snap.finalUrl.includes("/admin/ops") && snap.opsActive,
      errors: [],
      audit: snap,
    });

    await page.goto(`${BASE}/admin/health/farm/FARM01--P00`, { waitUntil: "load" });
    snap = await pageAudit(page);
    results.push({
      suite: "interaction",
      path: "health drill-down sidebar",
      pass: snap.opsActive && snap.finalUrl.includes("/admin/health/farm/"),
      errors: snap.opsActive ? [] : ["운영 nav should stay active on drill-down"],
      audit: snap,
    });
  }

  if (role === "operator") {
    await page.goto(`${BASE}/farm`, { waitUntil: "load" });
    let snap = await pageAudit(page);
    results.push({
      suite: "interaction",
      path: "operator no ops nav",
      pass: !snap.hasOpsNav && !snap.hasGeo,
      errors: snap.hasOpsNav ? ["operator should not see 운영"] : [],
      audit: snap,
    });

    await page.goto(`${BASE}/farm?tab=ops`, { waitUntil: "load" });
    results.push(await runAlarmBellCheck(page));
  }

  return results;
}

async function main() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  await ensurePasswords(adminClient);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const all = [];
  all.push(...(await runSuite(page, "unauthenticated", CASES.unauthenticated, null)));
  all.push(...(await runSuite(page, "admin", CASES.admin, ACCOUNTS.admin)));
  try {
    all.push(...(await runInteractions(page, "admin")));
  } catch (e) {
    all.push({
      suite: "interaction",
      path: "admin interactions (uncaught)",
      pass: false,
      errors: [String(e)],
      audit: {},
    });
  }
  all.push(...(await runSuite(page, "operator", CASES.operator, ACCOUNTS.operator)));
  try {
    all.push(...(await runInteractions(page, "operator")));
  } catch (e) {
    all.push({
      suite: "interaction",
      path: "operator interactions (uncaught)",
      pass: false,
      errors: [String(e)],
      audit: {},
    });
  }
  all.push(...(await runSuite(page, "viewer", CASES.viewer, ACCOUNTS.viewer)));

  await browser.close();

  const failed = all.filter((r) => !r.pass);
  const outPath = join(dirname(fileURLToPath(import.meta.url)), "ui-route-verify-results.json");
  writeFileSync(outPath, JSON.stringify({ at: new Date().toISOString(), total: all.length, failed: failed.length, results: all }, null, 2));

  console.log(`Total: ${all.length}, PASS: ${all.length - failed.length}, FAIL: ${failed.length}`);
  for (const f of failed) {
    console.log(`FAIL [${f.suite}] ${f.path}`);
    for (const e of f.errors) console.log(`  - ${e}`);
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
