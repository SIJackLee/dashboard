#!/usr/bin/env node
/**
 * Mobile UI interaction smoke — bottom nav, ops tabs, controller pills.
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const TEMP_PW = "UiVerify2026!Temp";
const VIEWPORT = { width: 375, height: 812 };

const failures = [];

function fail(name, detail) {
  failures.push({ name, detail });
  console.error(`FAIL ${name}: ${detail}`);
}

function pass(name) {
  console.log(`OK   ${name}`);
}

async function ensurePasswords(adminClient) {
  for (const email of ["admin@test.com", "farmer@test.com", "viewer@test.com"]) {
    const { data } = await adminClient.auth.admin.listUsers();
    const user = data.users.find((u) => u.email === email);
    if (!user) throw new Error(`Missing user ${email}`);
    await adminClient.auth.admin.updateUserById(user.id, { password: TEMP_PW });
  }
}

async function login(page, email) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(TEMP_PW);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}

async function main() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  await ensurePasswords(adminClient);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  page.on("pageerror", (e) => {
    const msg = e.message;
    if (msg.includes("Invalid LatLng")) return;
    if (msg.includes("_leaflet_pos")) return;
    fail("pageerror", msg);
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("hydration")) {
      fail("console", m.text().slice(0, 200));
    }
  });

  // Admin ops hub
  await login(page, "admin@test.com");
  await page.goto(`${BASE}/farm?tab=ops`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const bottomNav = page.locator('[aria-label="모바일 앱 메뉴"]');
  if ((await bottomNav.count()) === 0) {
    fail("admin-bottom-nav", "모바일 하단 네비 없음");
  } else {
    pass("admin-bottom-nav-visible");
  }

  const opsLink = bottomNav.getByRole("link", { name: "운영" });
  if ((await opsLink.count()) === 0) {
    fail("admin-ops-nav-link", "운영 링크 없음 (admin role 확인)");
  } else {
    await Promise.all([
      page.waitForURL((u) => u.pathname.includes("/admin/ops"), {
        timeout: 15000,
        waitUntil: "domcontentloaded",
      }),
      opsLink.click(),
    ]).catch(() => {
      fail("admin-ops-nav", `운영 탭 이동 실패: ${page.url()}`);
    });
    if (page.url().includes("/admin/ops")) {
      pass("admin-ops-nav-click");
    }
  }

  await page.goto(`${BASE}/farm?tab=ops`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const splitShell = page.locator('[class*="min-h-[calc(100dvh"]');
  if ((await splitShell.count()) === 0) {
    fail("admin-split-shell", "OpsMobileSplitShell 없음");
  } else {
    pass("admin-split-shell-visible");
  }

  const controlTab = page.getByRole("tab", { name: /^제어/ });
  if ((await controlTab.count()) > 0) {
    const selected = await controlTab.first().getAttribute("aria-selected");
    if (selected !== "true") {
      fail("admin-control-tab-default", `제어 탭 기본 선택 아님: aria-selected=${selected}`);
    } else {
      pass("admin-control-tab-default");
    }
    await page.getByRole("tab", { name: /^알림/ }).click();
    await page.waitForTimeout(400);
    await controlTab.first().click();
    await page.waitForTimeout(400);
    pass("admin-alarm-control-tabs");
  }

  const pill = page.getByRole("button", { name: /컨트롤러 02번|C·02/ }).first();
  if ((await pill.count()) > 0) {
    await pill.click();
    await page.waitForTimeout(800);
    const label = page.locator("text=축사 02").first();
    if ((await label.count()) === 0) {
      const body = await page.locator("body").innerText();
      if (!body.includes("축사 02")) {
        fail("admin-pill-stall-sync", "02번 pill 선택 후 축사 02 미표시");
      } else {
        pass("admin-pill-stall-sync");
      }
    } else {
      pass("admin-pill-stall-sync");
    }
  } else {
    pass("admin-pill-skip-single-controller");
  }

  // Farmer ops
  await login(page, "farmer@test.com");
  await page.goto(`${BASE}/farm?tab=ops`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const barnGrid = page.locator(".rounded-xl.border.bg-muted\\/10.p-2").first();
  if ((await barnGrid.count()) === 0) {
    fail("farmer-barn-grid", "OpsMobileBarnGrid 없음");
  } else {
    const box = await barnGrid.boundingBox();
    const scrollH = await barnGrid.evaluate((el) => el.scrollHeight);
    const clientH = await barnGrid.evaluate((el) => el.clientHeight);
    if (clientH > 0 && scrollH > clientH + 8) {
      fail(
        "farmer-barn-grid-scroll",
        `그리드 내부 스크롤 ${scrollH}px > ${clientH}px`
      );
    } else {
      pass("farmer-barn-grid-expanded");
    }
    if (box && box.height < 200 && (await barnGrid.locator("button").count()) > 4) {
      fail("farmer-barn-grid-height", `그리드 높이 ${Math.round(box.height)}px — 타일 잘림 가능`);
    } else {
      pass("farmer-barn-grid-height");
    }
  }

  const controlTabFarmer = page.getByRole("tab", { name: /^제어/ });
  if ((await controlTabFarmer.count()) > 0) {
    const selected = await controlTabFarmer.first().getAttribute("aria-selected");
    if (selected !== "true") {
      fail("farmer-control-tab-default", `제어 탭 기본 선택 아님`);
    } else {
      pass("farmer-control-tab-default");
    }
  }

  // Viewer read-only
  await login(page, "viewer@test.com");
  await page.goto(`${BASE}/farm?tab=ops`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  if (page.url().includes("/login")) {
    fail("viewer-ops-access", "뷰어 ops 접근 불가");
  } else {
    pass("viewer-ops-access");
  }

  await browser.close();

  console.log(`\n--- ${failures.length} failure(s) ---`);
  if (failures.length > 0) {
    process.exit(1);
  }
  console.log("All interaction checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
