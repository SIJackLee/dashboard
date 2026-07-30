#!/usr/bin/env node
/**
 * Density regression — 맵 카드 수치 스케일 가드 (갭2 회귀 방지)
 * 배포 기준(origin)에는 text-[1.75rem] 리터럴이 남아 있어
 * 인라인 rem 전수 금지는 하지 않는다. (맵 축소만 차단)
 *
 * Usage: node scripts/verify-ui-density.mjs
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");
const cssPath = join(root, "src/app/globals.css");
const pageUiPath = join(root, "src/lib/ui/dashboard-page-ui.ts");

/** 맵 카드 전용 — 목록 readout으로 축소 금지 */
const MAP_VALUE_TOKENS = [
  "--density-map-value:",
  "--density-map-value-md:",
  "--density-map-value-compact:",
  "--density-map-value-compact-md:",
];

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

const errors = [];

const css = readFileSync(cssPath, "utf8");
for (const token of MAP_VALUE_TOKENS) {
  if (!css.includes(token)) {
    errors.push({
      file: "src/app/globals.css",
      line: 0,
      text: `missing ${token.trim()}`,
      hint: "맵 카드 수치 토큰 필수 — docs/UI_DENSITY.md (그리드 축소 회귀 금지)",
    });
  }
}

const pageUi = readFileSync(pageUiPath, "utf8");
const gridDefault = pageUi.match(
  /gridCellValueDefault:\s*\n?\s*"([^"]+)"/,
);
const gridCompact = pageUi.match(
  /gridCellValueCompact:\s*\n?\s*"([^"]+)"/,
);
if (!gridDefault?.[1]?.includes("--density-map-value)")) {
  errors.push({
    file: "src/lib/ui/dashboard-page-ui.ts",
    line: 0,
    text: "gridCellValueDefault must use --density-map-value",
    hint: "do not point map EnvChip at dashboardReadout.value/valueLg (too small)",
  });
}
if (!gridCompact?.[1]?.includes("--density-map-value-compact)")) {
  errors.push({
    file: "src/lib/ui/dashboard-page-ui.ts",
    line: 0,
    text: "gridCellValueCompact must use --density-map-value-compact",
    hint: "do not point map EnvChip at dashboardReadout.value (too small)",
  });
}
if (/gridCellValueDefault:\s*dashboardReadout\.(value|valueLg)/.test(pageUi)) {
  errors.push({
    file: "src/lib/ui/dashboard-page-ui.ts",
    line: 0,
    text: "gridCellValueDefault aliases dashboardReadout",
    hint: "맵 카드는 --density-map-value* 전용 — readout 재사용 금지",
  });
}
if (/gridCellValueCompact:\s*dashboardReadout\.(value|valueLg)/.test(pageUi)) {
  errors.push({
    file: "src/lib/ui/dashboard-page-ui.ts",
    line: 0,
    text: "gridCellValueCompact aliases dashboardReadout",
    hint: "맵 카드는 --density-map-value-compact* 전용 — readout 재사용 금지",
  });
}

const files = walk(srcRoot);

if (errors.length) {
  console.error("verify-ui-density: FAILED\n");
  for (const e of errors) {
    const loc = e.line ? `${e.file}:${e.line}` : e.file;
    console.error(`  ${loc}  ${e.text}`);
    console.error(`    → ${e.hint}`);
  }
  console.error(`\n${errors.length} issue(s). docs/UI_DENSITY.md`);
  process.exit(1);
}

console.log(
  `verify-ui-density: ok (${files.length} files; map-value scale guard)`,
);
