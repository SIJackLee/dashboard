#!/usr/bin/env node
/**
 * className 문자열 스캔 — transition-all / duration-N (motion-* 제외) 금지.
 * Usage: node scripts/verify-motion-classes.mjs
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");

const BAN_TRANSITION_ALL = /(?:^|[\s"'`])transition-all(?:$|[\s"'`])/;
const BAN_DURATION_N = /(?:^|[\s"'`])duration-(?!motion-)\d+(?:$|[\s"'`])/;

/** 주석·문서 언급만 허용하는 파일 (코드 문자열 금지) */
const SKIP_FILES = new Set([
  // 정의 파일 자체에 "금지" 문구가 있을 수 있음 — 코드 값은 허용 토큰만
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

/** 라인에서 // 주석·블록 주석 단순 제거 (오탐 완화) */
function stripLineComment(line) {
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  // URL http:// 보호
  if (/https?:\/\//.test(line.slice(0, idx + 8))) return line;
  return line.slice(0, idx);
}

const files = walk(srcRoot);
const errors = [];

for (const file of files) {
  if (SKIP_FILES.has(relative(srcRoot, file).replace(/\\/g, "/"))) continue;
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    // JSDoc / block comment lines that only document the ban
    if (/^\s*\/\*\*?|^\s*\*|^\s*\*\//.test(raw) && /금지|forbid|ban/i.test(raw)) {
      continue;
    }
    const line = stripLineComment(raw);
    if (BAN_TRANSITION_ALL.test(line)) {
      errors.push({
        file: relative(root, file),
        line: i + 1,
        kind: "transition-all",
        text: raw.trim().slice(0, 120),
      });
    }
    if (BAN_DURATION_N.test(line)) {
      errors.push({
        file: relative(root, file),
        line: i + 1,
        kind: "duration-N",
        text: raw.trim().slice(0, 120),
      });
    }
  }
}

if (errors.length > 0) {
  console.error("verify-motion-classes: FAILED\n");
  for (const e of errors) {
    console.error(`  ${e.file}:${e.line} [${e.kind}] ${e.text}`);
  }
  console.error(
    `\nUse motionClass / duration-motion-* (docs/UI_MOTION.md). ${errors.length} issue(s).`,
  );
  process.exit(1);
}

console.log(`verify-motion-classes: ok (${files.length} files scanned)`);
