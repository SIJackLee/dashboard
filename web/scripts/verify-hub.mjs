#!/usr/bin/env node
/**
 * 허브 본체 P0 게이트 — URL·keep-alive 유닛만 (브라우저/서버 불필요).
 * Usage: npm run verify:hub
 */
import { createRequire } from "module";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");

const files = [
  "src/lib/farm/farm-hub-url-smoke.test.ts",
  "src/lib/farm/farm-hub-keepalive.test.ts",
];

let failed = 0;
for (const rel of files) {
  const abs = join(root, rel);
  process.stdout.write(`→ ${relative(root, abs)}\n`);
  const r = spawnSync(process.execPath, [tsxCli, abs], {
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
  console.error(`\nverify:hub: ${failed}/${files.length} failed`);
  process.exit(1);
}
console.log(`\nverify:hub: ok (${files.length} files)`);
