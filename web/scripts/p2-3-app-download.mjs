#!/usr/bin/env node
/**
 * P2-3: /app 비밀번호 해제 → 다운로드 응답 검증 (비밀번호는 로그에 남기지 않음)
 * LOCAL: UI_VERIFY_BASE (default localhost:3000)
 * PROD: https://smart.autofankorea.com  (APP_INSTALL_PASSWORD 동일 가정)
 */
import dotenv from "dotenv";
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { writeFileSync, mkdirSync, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "mobile-audit-output",
);

async function probeApp(base, password, label) {
  const result = {
    label,
    base,
    ok: false,
    versionLabel: null,
    unlocked: false,
    downloadStatus: null,
    downloadContentType: null,
    downloadBytes: null,
    downloadFinalUrlHost: null,
    notes: [],
  };
  if (!password) {
    result.notes.push("APP_INSTALL_PASSWORD missing");
    return result;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/app`, { waitUntil: "load" });
    await page.waitForTimeout(1000);
    const body = await page.locator("body").innerText();
    const vm = body.match(/버전\s*(\S+)/);
    result.versionLabel = vm ? vm[1] : null;
    result.configured = !/설치 페이지가 아직 설정되지 않았습니다/.test(body);
    result.hasPasswordForm = await page
      .locator('input[type="password"]')
      .first()
      .isVisible()
      .catch(() => false);

    if (result.hasPasswordForm) {
      await page.locator('input[type="password"]').first().fill(password);
      await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("열기"), button:has-text("잠금")').first().click().catch(async () => {
        // fallback: any submit near form
        await page.locator("form button").first().click();
      });
      await page.waitForTimeout(2000);
    }

    const after = await page.locator("body").innerText();
    result.unlocked = /APK 다운로드/.test(after);
    result.versionLabel =
      (after.match(/버전\s*(\S+)/) || [])[1] || result.versionLabel;

    if (!result.unlocked) {
      result.notes.push("unlock_failed_or_no_download_button");
      result.afterSnippet = after.replace(/\s+/g, " ").slice(0, 300);
      return result;
    }

    // Prefer direct cookie-authenticated fetch of /app/download
    const cookies = await context.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const dlRes = await fetch(`${base}/app/download`, {
      headers: { cookie: cookieHeader },
      redirect: "manual",
    });
    result.downloadStatus = dlRes.status;
    result.downloadContentType = dlRes.headers.get("content-type");
    const loc = dlRes.headers.get("location");
    if (loc) {
      try {
        result.downloadFinalUrlHost = new URL(loc).host;
      } catch {
        result.downloadFinalUrlHost = loc.slice(0, 80);
      }
    }

    if (dlRes.status >= 300 && dlRes.status < 400 && loc) {
      const fileRes = await fetch(loc);
      result.signedFetchStatus = fileRes.status;
      const buf = Buffer.from(await fileRes.arrayBuffer());
      result.downloadBytes = buf.length;
      result.downloadLooksApk =
        buf.length > 1000 &&
        (buf[0] === 0x50 && buf[1] === 0x4b); // ZIP/APK magic
      const outApk = join(OUT_DIR, `p2-3-${label}.apk`);
      writeFileSync(outApk, buf);
      result.savedAs = outApk;
    } else if (dlRes.ok) {
      const buf = Buffer.from(await dlRes.arrayBuffer());
      result.downloadBytes = buf.length;
      result.downloadLooksApk = buf[0] === 0x50 && buf[1] === 0x4b;
    }

    result.ok =
      result.configured &&
      result.unlocked &&
      ((result.downloadStatus === 302 || result.downloadStatus === 307) ||
        result.downloadLooksApk === true) &&
      (result.downloadLooksApk === true ||
        result.signedFetchStatus === 200);
  } catch (e) {
    result.notes.push(String(e?.message ?? e));
  } finally {
    await browser.close();
  }
  return result;
}

async function main() {
  const password = process.env.APP_INSTALL_PASSWORD?.trim();
  const localBase = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
  const prodBase = "https://smart.autofankorea.com";

  mkdirSync(OUT_DIR, { recursive: true });
  const local = await probeApp(localBase, password, "local");
  const prod = await probeApp(prodBase, password, "prod");

  const report = {
    at: new Date().toISOString(),
    local,
    prod,
    ok: Boolean(prod.ok),
    note: "실기기 설치는 담당자 수동. 비밀번호는 보고서에 포함하지 않음.",
  };
  const out = join(OUT_DIR, "p2-3-app-download-report.json");
  writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({
    ok: report.ok,
    local: {
      ok: local.ok,
      version: local.versionLabel,
      unlocked: local.unlocked,
      downloadStatus: local.downloadStatus,
      bytes: local.downloadBytes,
      looksApk: local.downloadLooksApk,
      notes: local.notes,
    },
    prod: {
      ok: prod.ok,
      version: prod.versionLabel,
      unlocked: prod.unlocked,
      downloadStatus: prod.downloadStatus,
      bytes: prod.downloadBytes,
      looksApk: prod.downloadLooksApk,
      host: prod.downloadFinalUrlHost,
      notes: prod.notes,
    },
    out,
  }, null, 2));
  if (!report.ok) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
