#!/usr/bin/env node
/**
 * UI affordance guards — docs/UI_AFFORDANCE.md
 * - 표시 칩 테두리 회귀 (EnvChip)
 * - 레이어 꺼짐 투명 테두리
 * - 허브 명령 CTA emerald 채움
 *
 * Usage: node scripts/verify-ui-affordance.mjs
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
    } else if (/\.(tsx?)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

function stripLineComment(line) {
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  if (/https?:\/\//.test(line.slice(0, idx + 8))) return line;
  return line.slice(0, idx);
}

const errors = [];

function addError(file, line, kind, text, hint) {
  errors.push({
    file: relative(root, file).replace(/\\/g, "/"),
    line,
    kind,
    text: text.trim().slice(0, 120),
    hint,
  });
}

const envChip = join(srcRoot, "components/common/env-chip.tsx");
{
  const text = readFileSync(envChip, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = stripLineComment(lines[i]);
    if (/rounded-(?:md|lg)\s+border\s+bg-background/.test(line)) {
      addError(
        envChip,
        i + 1,
        "display-chip-border",
        lines[i],
        "표시 칩은 dashboardAffordance.dataPocket (docs/UI_AFFORDANCE.md)",
      );
    }
  }
}

const layerToolbar = join(
  srcRoot,
  "components/farm/unified-trend-layer-toolbar.tsx",
);
{
  const text = readFileSync(layerToolbar, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = stripLineComment(lines[i]);
    if (/border-transparent/.test(line)) {
      addError(
        layerToolbar,
        i + 1,
        "ghost-chip-toggle",
        lines[i],
        "꺼진 레이어도 chipToggleIdle 테두리 유지",
      );
    }
  }
}

const farmRoot = join(srcRoot, "components/farm");
const commonPageBtn = join(srcRoot, "components/common/page-action-button.tsx");
for (const file of [...walk(farmRoot), commonPageBtn]) {
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = stripLineComment(lines[i]);
    if (/bg-emerald-600/.test(line)) {
      addError(
        file,
        i + 1,
        "cta-emerald",
        lines[i],
        "명령 CTA는 dashboardAffordance.action (primary)",
      );
    }
  }
}

if (errors.length) {
  console.error(`verify-ui-affordance: ${errors.length} issue(s)\n`);
  for (const e of errors) {
    console.error(`${e.file}:${e.line} [${e.kind}] ${e.text}`);
    console.error(`  → ${e.hint}`);
  }
  process.exit(1);
}

console.log("verify-ui-affordance: ok");
