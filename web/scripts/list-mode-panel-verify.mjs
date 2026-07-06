#!/usr/bin/env node
/**
 * 목록 모드(컨트롤러/그래프/설정/모터) 전환 시 카드 DOM 유지·패널 애니메이션 검증
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { passwordForEmail } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const FARM_URL =
  "/farm?lsind=FARM01&item=P00&view=list&tab=ops";

async function login(page) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill("admin@test.com");
  await page.locator("#password").fill(passwordForEmail("admin@test.com"));
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}

async function waitForCards(page) {
  await page.waitForSelector("[data-controller-card-key]", { timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelectorAll("[data-controller-card-key]").length >= 8,
    { timeout: 30000 },
  );
}

async function snapshotCardState(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-controller-card-key]")].slice(0, 3);
    return cards.map((el) => ({
      key: el.getAttribute("data-controller-card-key"),
      nodeId: el.getAttribute("data-verify-node-id") || null,
      graphOpen: el.querySelector('.barn-list-panel-shell[data-panel="graph"], [data-panel="graph"]')?.closest(".barn-list-panel-shell")?.getAttribute("data-open") ?? null,
      settingsOpen: el.querySelector('[data-panel="settings"]')?.closest(".barn-list-panel-shell")?.getAttribute("data-open") ?? null,
      motorOpen: el.querySelector('[data-panel="motor"]')?.closest(".barn-list-panel-shell")?.getAttribute("data-open") ?? null,
    }));
  });
}

async function tagCards(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("[data-controller-card-key]")) {
      if (!el.getAttribute("data-verify-node-id")) {
        el.setAttribute("data-verify-node-id", `card-${Math.random().toString(36).slice(2)}`);
      }
    }
  });
}

async function clickMode(page, label) {
  await page.getByRole("tab", { name: label, exact: true }).click({ noWaitAfter: true });
  await page.waitForTimeout(400);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const rscFetches = [];
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("/farm") && (req.resourceType() === "fetch" || u.includes("_rsc"))) {
      rscFetches.push(u);
    }
  });

  try {
    await login(page);
    await page.goto(`${BASE}${FARM_URL}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: "목록" }).click({ noWaitAfter: true }).catch(() => {});
    await waitForCards(page);
    await tagCards(page);

    const before = await snapshotCardState(page);
    const nodeIds = before.map((c) => c.nodeId);

    rscFetches.length = 0;
    await clickMode(page, "그래프");
    const afterGraph = await snapshotCardState(page);
    const graphSameNodes = afterGraph.every((c, i) => c.nodeId === nodeIds[i]);
    const graphPanelsOpen = afterGraph.every((c) => c.graphOpen === "true");

    rscFetches.length = 0;
    await clickMode(page, "설정");
    const afterSettings = await snapshotCardState(page);
    const settingsSameNodes = afterSettings.every((c, i) => c.nodeId === nodeIds[i]);
    const settingsPanelsOpen = afterSettings.every((c) => c.settingsOpen === "true");

    rscFetches.length = 0;
    await clickMode(page, "모터그래프");
    const afterMotor = await snapshotCardState(page);
    const motorSameNodes = afterMotor.every((c, i) => c.nodeId === nodeIds[i]);
    const motorPanelsOpen = afterMotor.every((c) => c.motorOpen === "true");

    rscFetches.length = 0;
    await clickMode(page, "컨트롤러");
    const afterCtrl = await snapshotCardState(page);
    const ctrlSameNodes = afterCtrl.every((c, i) => c.nodeId === nodeIds[i]);

    const result = {
      ok:
        graphSameNodes &&
        settingsSameNodes &&
        motorSameNodes &&
        ctrlSameNodes &&
        graphPanelsOpen &&
        settingsPanelsOpen &&
        motorPanelsOpen,
      graphSameNodes,
      settingsSameNodes,
      motorSameNodes,
      ctrlSameNodes,
      graphPanelsOpen,
      settingsPanelsOpen,
      motorPanelsOpen,
      rscFetchesOnLastToggle: rscFetches.length,
      sample: { before, afterGraph, afterSettings, afterMotor, afterCtrl },
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
