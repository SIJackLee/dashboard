#!/usr/bin/env node
/**
 * Unit test runner — all src *.test.ts via tsx (node:assert style).
 * Usage: node scripts/run-unit-tests.mjs
 */
import { readdirSync, statSync } from "fs";
import { createRequire } from "module";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");
const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
    } else if (name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(srcRoot).sort();
if (files.length === 0) {
  console.error("run-unit-tests: no *.test.ts under src/");
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const rel = relative(root, file);
  process.stdout.write(`→ ${rel}\n`);
  const r = spawnSync(process.execPath, [tsxCli, file], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) {
    failed += 1;
    console.error(`FAIL ${rel} (exit ${r.status ?? "?"})`);
  }
}

if (failed) {
  console.error(`\nrun-unit-tests: ${failed}/${files.length} failed`);
  process.exit(1);
}
console.log(`\nrun-unit-tests: ok (${files.length} files)`);
