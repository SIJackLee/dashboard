#!/usr/bin/env node
/**
 * Elevation regression — hover shadow 승격 · 본문 shadow-lg 금지 (H1)
 * @see docs/UI_ELEVATION.md · dashboardElevation
 *
 * Usage: node scripts/verify-ui-elevation.mjs
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");

/** 호버로 elevation 올리기 금지 */
const HOVER_SHADOW = /hover:shadow-(?:sm|md|lg|xl|2xl)\b/;

/**
 * shadow-lg + bg-card 동시 → 본문 카드에 강한 그림자 (overlay만 허용)
 * 허용: bg-popover, ui-motion-toast, dashboardElevation
 */
const CARD_SHADOW_LG =
  /(?=.*\bbg-card\b)(?=.*\bshadow-lg\b)|(?=.*\bshadow-lg\b)(?=.*\bbg-card\b)/;

/** overlay 허용 경로 (shadow-lg 단독은 OK — 여기선 card+lg만 탐지) */

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(srcRoot);
const errors = [];

for (const file of files) {
  const rel = relative(srcRoot, file).replace(/\\/g, "/");
  if (rel === "lib/ui/dashboard-page-ui.ts") continue;

  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (HOVER_SHADOW.test(line)) {
      errors.push({
        file: relative(root, file),
        line: i + 1,
        kind: "hover-shadow",
        text: line.trim().slice(0, 120),
        hint: "use dashboardElevation.interactiveHover (ring) — docs/UI_ELEVATION.md",
      });
    }
    if (CARD_SHADOW_LG.test(line) && !line.includes("dashboardElevation")) {
      errors.push({
        file: relative(root, file),
        line: i + 1,
        kind: "card-shadow-lg",
        text: line.trim().slice(0, 120),
        hint: "bg-card + shadow-lg 금지 — overlay용 dashboardElevation.overlayStrong",
      });
    }
  }
}

if (errors.length) {
  console.error("verify-ui-elevation: FAILED\n");
  for (const e of errors) {
    console.error(`  ${e.file}:${e.line} [${e.kind}] ${e.text}`);
    console.error(`    → ${e.hint}`);
  }
  console.error(`\n${errors.length} issue(s). docs/UI_ELEVATION.md`);
  process.exit(1);
}

console.log(`verify-ui-elevation: ok (${files.length} files)`);
