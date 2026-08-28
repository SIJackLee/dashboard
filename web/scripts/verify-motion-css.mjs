#!/usr/bin/env node
/**
 * globals.css farm-chart surface 가드레일 (bundle D)
 * - farm-chart-* 규칙에 리터럴 Nms duration 금지 → --motion-duration-* 사용
 * - farm-chart-* 에 infinite animation 금지 (정적 pulse만 허용)
 * - ARIA / soft-refresh / login / tour 는 ALLOWLIST
 *
 * Usage: node scripts/verify-motion-css.mjs
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = join(root, "src/app/globals.css");
const css = readFileSync(cssPath, "utf8");

/** 문서화된 예외 — 무한/비토큰 duration 허용 (UI_MOTION.md) */
const ALLOW_INFINITE = [
  /\.ui-motion-soft-refresh-bar\b/,
  /\.login-splash-dot\b/,
  /\.farm-tour-accent\b/,
  /farm-tour-accent-pulse/,
  /\.health-dag-|health-dag-edge-flow/,
];

const errors = [];

/** .farm-chart-* { ... } 블록에서 animation: ... Nms 탐지 */
const ruleRe =
  /\.((?:farm-chart)[a-z0-9-]*)\s*\{([^{}]*(?:\{[^{}]*\}[^{]*)*)\}/g;

for (const m of css.matchAll(ruleRe)) {
  const name = m[1];
  const body = m[2];
  if (/animation\s*:[^;]*\binfinite\b/.test(body)) {
    errors.push({
      kind: "farm-chart-infinite",
      text: `.${name} uses animation: … infinite`,
    });
  }
  // animation: name 320ms …  — var(--motion-duration-*) 아닌 리터럴
  for (const am of body.matchAll(/animation\s*:\s*([^;]+);/g)) {
    const decl = am[1];
    if (/\binfinite\b/.test(decl)) continue;
    if (/\d+(?:\.\d+)?m?s\b/.test(decl) && !/--motion-duration-/.test(decl)) {
      errors.push({
        kind: "farm-chart-literal-ms",
        text: `.${name}: ${decl.trim().slice(0, 100)}`,
      });
    }
  }
}

/** farm-chart 키프레임 밖 — 전역 infinite 중 비허용 */
for (const m of css.matchAll(
  /^([^\n{]*)\{[^{}]*animation\s*:[^;]*\binfinite\b[^}]*\}/gm,
)) {
  const head = m[1].trim();
  if (!head || head.startsWith("@") || head.includes("keyframes")) continue;
  if (!head.includes("farm-chart")) continue;
  errors.push({
    kind: "farm-chart-infinite",
    text: `${head} … infinite`,
  });
}

/** 참고: 문서 예외 클래스가 CSS에 존재하는지 (누락 시 경고만) */
for (const re of ALLOW_INFINITE) {
  if (!re.test(css)) {
    console.warn(
      `verify-motion-css: warn — allowlisted pattern missing in CSS: ${re}`,
    );
  }
}

/**
 * H2 amplitude — @keyframes farm-chart-* 내
 * - rotate() 금지
 * - 리터럴 scale/scaleY: < 0.85 또는 > 1.08 금지 (토큰 var 사용)
 */
const SCALE_MIN = 0.85;
const SCALE_MAX = 1.08;
const kfRe = /@keyframes\s+(farm-chart-[a-z0-9-]+)\s*\{([\s\S]*?)\n\}/g;
for (const m of css.matchAll(kfRe)) {
  const name = m[1];
  const body = m[2];
  if (/\brotate\s*\(/.test(body)) {
    errors.push({
      kind: "farm-chart-rotate",
      text: `@keyframes ${name} uses rotate() — H2 amplitude diet`,
    });
  }
  for (const sm of body.matchAll(/scale(?:X|Y|Z)?\s*\(\s*(-?[\d.]+)\s*\)/g)) {
    const v = Number(sm[1]);
    if (!Number.isFinite(v)) continue;
    if (v < SCALE_MIN || v > SCALE_MAX) {
      errors.push({
        kind: "farm-chart-scale",
        text: `@keyframes ${name}: scale(${v}) outside [${SCALE_MIN}, ${SCALE_MAX}] — use --motion-chart-scale-*`,
      });
    }
  }
}

if (!/--motion-chart-scale-from:/.test(css) || !/--motion-chart-scale-exit:/.test(css)) {
  errors.push({
    kind: "farm-chart-amplitude-token",
    text: "missing --motion-chart-scale-from|exit in :root",
  });
}

if (errors.length > 0) {
  console.error("verify-motion-css: FAILED\n");
  for (const e of errors) {
    console.error(`  [${e.kind}] ${e.text}`);
  }
  console.error(
    `\nChart surfaces: --motion-duration-*, no infinite, H2 amplitude (docs/UI_MOTION.md). ${errors.length} issue(s).`,
  );
  process.exit(1);
}

console.log(
  "verify-motion-css: ok (farm-chart duration/infinite/amplitude guards)",
);
