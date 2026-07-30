#!/usr/bin/env node
/**
 * UI color regression guards (T5)
 * - Tailwind sky-* / rose-* utilities 금지 → channel-* / primary / status
 * - 차트·상태 레거시 hex 금지 (allowlist 제외)
 *
 * Usage: node scripts/verify-ui-colors.mjs
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");

/** Tailwind channel 회귀 — sky/rose/violet/orange → channel|primary|status */
const BAN_LEGACY_HUE =
  /(?:^|[\s"'`:[])(?:bg|text|border|ring|stroke|fill|from|to|via|outline|decoration|accent|caret|divide|shadow)-?(?:sky|rose|violet|orange)-\d/;

/** 차트·브랜드 레거시 hex (소문자 정규화 후 비교) */
const BAN_HEX = [
  { hex: "#ef4444", hint: "use var(--channel-temp) / var(--status-danger) / TREND_CHART_COLORS" },
  { hex: "#0ea5e9", hint: "use var(--channel-hum) / TREND_CHART_COLORS.humidity" },
  { hex: "#10b981", hint: "use var(--primary) / var(--status-ok)" },
  { hex: "#22c55e", hint: "use var(--primary)" },
];

/**
 * hex 스캔 허용 — 보간·벤더 고정색 등
 * (경로: src 기준 posix)
 */
const HEX_ALLOWLIST = new Set([
  "components/login/oauth-buttons.tsx", // 카카오 브랜드 #FEE500
]);

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

function stripLineComment(line) {
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  if (/https?:\/\//.test(line.slice(0, idx + 8))) return line;
  return line.slice(0, idx);
}

const files = walk(srcRoot);
const errors = [];

for (const file of files) {
  const rel = relative(srcRoot, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const allowHex = HEX_ALLOWLIST.has(rel);

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (/^\s*\/\*\*?|^\s*\*|^\s*\*\//.test(raw) && /금지|forbid|legacy|allowlist/i.test(raw)) {
      continue;
    }
    const line = stripLineComment(raw);

    if (BAN_LEGACY_HUE.test(line)) {
      errors.push({
        file: relative(root, file),
        line: i + 1,
        kind: "legacy-hue-utility",
        text: raw.trim().slice(0, 120),
        hint: "use channel-temp|hum|motor|info or primary/status (docs/UI_MOTION.md); amber=warn only",
      });
    }

    if (!allowHex) {
      const lower = line.toLowerCase();
      for (const { hex, hint } of BAN_HEX) {
        if (lower.includes(hex)) {
          errors.push({
            file: relative(root, file),
            line: i + 1,
            kind: "legacy-hex",
            text: raw.trim().slice(0, 120),
            hint,
          });
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error("verify-ui-colors: FAILED\n");
  for (const e of errors) {
    console.error(`  ${e.file}:${e.line} [${e.kind}] ${e.text}`);
    console.error(`    → ${e.hint}`);
  }
  console.error(`\n${errors.length} issue(s). See docs/UI_MOTION.md (T5).`);
  process.exit(1);
}

console.log(
  `verify-ui-colors: ok (${files.length} files; sky/rose/violet/orange + legacy hex guards)`,
);
