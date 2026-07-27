#!/usr/bin/env node
/**
 * motion-tokens.ts ↔ globals.css 토큰 동기 검증
 * Usage: node scripts/verify-motion-tokens.mjs
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokensPath = join(root, "src/lib/ui/motion-tokens.ts");
const cssPath = join(root, "src/app/globals.css");

const tokensSrc = readFileSync(tokensPath, "utf8");
const cssSrc = readFileSync(cssPath, "utf8");

/** motionDuration 객체에서 ms 추출 */
function parseMotionDuration(src) {
  const block = src.match(/export const motionDuration = \{([\s\S]*?)\} as const/);
  if (!block) throw new Error("motionDuration block not found");
  const out = {};
  for (const m of block[1].matchAll(/(\w+):\s*(\d+)/g)) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

function parseCssDurations(src, prefix) {
  const rootBlock = src.match(/:root\s*\{([\s\S]*?)\n\}/);
  const scope = rootBlock?.[1] ?? src;
  const out = {};
  const re = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\w+):\\s*(\\d+)ms`, "g");
  for (const m of scope.matchAll(re)) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

function parseCssEasing(src) {
  const rootBlock = src.match(/:root\s*\{([\s\S]*?)\n\}/);
  const scope = rootBlock?.[1] ?? src;
  const out = {};
  for (const m of scope.matchAll(/--motion-ease-(\w+):\s*(cubic-bezier\([^)]+\))/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

function parseMotionEasing(src) {
  const block = src.match(/export const motionEasing = \{([\s\S]*?)\} as const/);
  if (!block) throw new Error("motionEasing block not found");
  const out = {};
  for (const m of block[1].matchAll(/(\w+):\s*"(cubic-bezier\([^"]+\))"/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

const duration = parseMotionDuration(tokensSrc);
const easing = parseMotionEasing(tokensSrc);

const cssMotionDuration = parseCssDurations(cssSrc, "--motion-duration");
const cssTailwindDuration = parseCssDurations(
  cssSrc.match(/@theme inline \{([\s\S]*?)\n\}/)?.[1] ?? cssSrc,
  "--duration-motion",
);
const cssEasing = parseCssEasing(cssSrc);

const durationKeys = ["fast", "normal", "moderate", "emphasis", "exit"];
const viewKey = "view";

const errors = [];

for (const key of durationKeys) {
  const tsMs = duration[key];
  const cssMs = cssMotionDuration[key];
  const twMs = cssTailwindDuration[key];
  if (tsMs !== cssMs) {
    errors.push(`--motion-duration-${key}: TS=${tsMs} CSS=${cssMs}`);
  }
  if (tsMs !== twMs) {
    errors.push(`--duration-motion-${key}: TS=${tsMs} Tailwind=${twMs}`);
  }
}

if (duration.viewCrossfade !== cssMotionDuration[viewKey]) {
  errors.push(
    `--motion-duration-view: TS=${duration.viewCrossfade} CSS=${cssMotionDuration[viewKey]}`,
  );
}
if (duration.viewCrossfade !== cssTailwindDuration[viewKey]) {
  errors.push(
    `--duration-motion-view: TS=${duration.viewCrossfade} Tailwind=${cssTailwindDuration[viewKey]}`,
  );
}

for (const key of Object.keys(easing)) {
  if (easing[key] !== cssEasing[key]) {
    errors.push(`--motion-ease-${key}: TS≠CSS`);
  }
}

const requiredSurfaces = [
  "ui-motion-enter-fade",
  "ui-motion-exit-fade",
  "ui-motion-enter-slide-up",
  "ui-motion-panel-expand",
  "ui-motion-stagger-in",
];

for (const cls of requiredSurfaces) {
  if (!cssSrc.includes(`.${cls}`)) {
    errors.push(`Missing L2 surface class: .${cls}`);
  }
}

if (errors.length > 0) {
  console.error("verify-motion-tokens: FAILED\n");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("verify-motion-tokens: ok");
console.log(
  `  durations: ${durationKeys.join(", ")}, view=${duration.viewCrossfade}ms`,
);
console.log(`  easing keys: ${Object.keys(easing).join(", ")}`);
console.log(`  L2 surfaces: ${requiredSurfaces.length} present`);
