#!/usr/bin/env node
/**
 * prefers-reduced-motion — CSS 정적 검수 + (선택) Playwright 런타임 스냅샷.
 *
 * Usage:
 *   node scripts/motion-reduced-audit.mjs
 *   UI_VERIFY_BASE=http://localhost:3000 node scripts/motion-reduced-audit.mjs
 *   STRICT_MOTION_RUNTIME=1 …  — BASE 필수 + 런타임 실패 시 exit 1
 */
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = join(root, "src/app/globals.css");
const outDir = join(root, "tmp");
const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";
const STRICT = process.env.STRICT_MOTION_RUNTIME === "1";

const DURATION_KEYS = [
  "fast",
  "normal",
  "moderate",
  "emphasis",
  "exit",
  "view",
];

const REQUIRED_REDUCE_SELECTORS = [
  ".ui-motion-enter-fade",
  ".ui-motion-exit-fade",
  ".ui-motion-panel-expand",
  ".ui-motion-stagger-in",
];

function assertStaticCss() {
  const css = readFileSync(cssPath, "utf8");
  const reduceBlocks = [
    ...css.matchAll(
      /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{([\s\S]*?)\n\}/g,
    ),
  ];
  if (reduceBlocks.length === 0) {
    throw new Error(
      "No @media (prefers-reduced-motion: reduce) block in globals.css",
    );
  }

  const reduceText = reduceBlocks.map((m) => m[1]).join("\n");
  const errors = [];

  for (const key of DURATION_KEYS) {
    const re = new RegExp(`--motion-duration-${key}:\\s*0ms`);
    if (!re.test(reduceText)) {
      errors.push(`reduce media missing --motion-duration-${key}: 0ms`);
    }
  }

  for (const sel of REQUIRED_REDUCE_SELECTORS) {
    if (!reduceText.includes(sel)) {
      errors.push(`reduce media should disable ${sel}`);
    }
  }

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
}

async function probeBase() {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(2500) });
    return (
      res.ok || res.status === 307 || res.status === 308 || res.status === 404
    );
  } catch {
    return false;
  }
}

function isZeroDuration(v) {
  return v === "0ms" || v === "0s" || v === "0";
}

async function runtimeAudit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const collect = async (reducedMotion) => {
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion });
    await page.goto(`${BASE}/login`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(300);

    const result = await page.evaluate((keys) => {
      const style = getComputedStyle(document.documentElement);
      const durations = {};
      for (const k of keys) {
        durations[k] = style.getPropertyValue(`--motion-duration-${k}`).trim();
      }

      let reduceRuleCount = 0;
      let rootVarRuleCount = 0;
      for (const sheet of document.styleSheets) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of rules) {
          if (
            rule instanceof CSSStyleRule &&
            (rule.selectorText === ":root" || rule.selectorText === "html")
          ) {
            if (rule.style.getPropertyValue("--motion-duration-fast")) {
              rootVarRuleCount += 1;
            }
          }
          if (
            rule instanceof CSSMediaRule &&
            /prefers-reduced-motion:\s*reduce/.test(rule.media.mediaText)
          ) {
            reduceRuleCount += 1;
          }
        }
      }

      return {
        durations,
        reduceMediaMatches: window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches,
        reduceRuleCount,
        rootVarRuleCount,
        href: location.href,
      };
    }, DURATION_KEYS);

    await page.close();
    return result;
  };

  const withMotion = await collect("no-preference");
  const without = await collect("reduce");

  const runtimeErrors = [];
  const warnings = [];

  if (!without.reduceMediaMatches) {
    runtimeErrors.push(
      "emulateMedia(reduce) but matchMedia(prefers-reduced-motion: reduce) is false",
    );
  }
  if (withMotion.reduceMediaMatches) {
    runtimeErrors.push(
      "emulateMedia(no-preference) but reduce media unexpectedly matches",
    );
  }
  if (without.reduceRuleCount < 1 && withMotion.reduceRuleCount < 1) {
    warnings.push(
      "CSSOM: prefers-reduced-motion reduce rules not readable (cross-origin sheet?)",
    );
  }

  for (const key of DURATION_KEYS) {
    const v = without.durations[key];
    if (v && !isZeroDuration(v)) {
      runtimeErrors.push(
        `reduced --motion-duration-${key}=${JSON.stringify(v)} (want 0ms)`,
      );
    } else if (!v) {
      warnings.push(
        `reduced --motion-duration-${key} empty on :root (token may load after paint)`,
      );
    }
  }

  const anyPositive = DURATION_KEYS.some((k) => {
    const v = withMotion.durations[k];
    return v && !isZeroDuration(v);
  });
  if (!anyPositive) {
    warnings.push(
      "no-preference: --motion-duration-* empty on :root at audit time",
    );
  }

  mkdirSync(outDir, { recursive: true });
  const snapshot = {
    base: BASE,
    at: new Date().toISOString(),
    noPreference: withMotion,
    reduce: without,
    ok: runtimeErrors.length === 0,
    errors: runtimeErrors,
    warnings,
  };
  const outPath = join(outDir, "motion-reduced-audit.json");
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

  await browser.close();

  if (runtimeErrors.length) {
    throw new Error(runtimeErrors.join("\n") + `\nWrote ${outPath}`);
  }
  if (warnings.length) {
    console.log("motion-reduced-audit: runtime warnings:");
    for (const w of warnings) console.log(`  - ${w}`);
  }
  return outPath;
}

async function main() {
  assertStaticCss();
  console.log("motion-reduced-audit: static CSS ok");

  const up = await probeBase();
  if (!up) {
    const msg = `runtime skipped (BASE unreachable: ${BASE})`;
    if (STRICT) {
      console.error(`motion-reduced-audit: FAILED — ${msg}`);
      process.exit(1);
    }
    console.log(`motion-reduced-audit: ${msg}`);
    return;
  }

  try {
    const outPath = await runtimeAudit();
    console.log(`motion-reduced-audit: runtime ok → ${outPath}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (STRICT) {
      console.error("motion-reduced-audit: FAILED");
      console.error(msg);
      process.exit(1);
    }
    console.log(
      `motion-reduced-audit: runtime skipped (${msg.split("\n")[0]})`,
    );
  }
}

main().catch((err) => {
  console.error("motion-reduced-audit: FAILED");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
