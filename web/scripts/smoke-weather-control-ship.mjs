#!/usr/bin/env node
/**
 * Phase E — 기상 CTRL 출고 스모크 (unit + backend + optional UI)
 *
 * Usage:
 *   node scripts/smoke-weather-control-ship.mjs
 *   node scripts/smoke-weather-control-ship.mjs --ui   (dev 서버 + Playwright)
 */
import { spawnSync } from "child_process";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const withUi = process.argv.includes("--ui");

function runTsx(label, relPath, extraArgs = []) {
  process.stdout.write(`→ ${label}\n`);
  const r = spawnSync(process.execPath, [tsxCli, join(root, relPath), ...extraArgs], {
    cwd: root,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error(`FAIL ${label} (exit ${r.status ?? "?"})`);
    process.exit(1);
  }
}

function runNode(label, relPath, extraArgs = []) {
  process.stdout.write(`→ ${label}\n`);
  const r = spawnSync(process.execPath, [join(root, relPath), ...extraArgs], {
    cwd: root,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error(`FAIL ${label} (exit ${r.status ?? "?"})`);
    process.exit(1);
  }
}

runTsx("weather-ctrl-enabled.test", "src/lib/weather-control/weather-ctrl-enabled.test.ts");
runTsx("unpack-recommendation.test", "src/lib/weather-control/unpack-recommendation.test.ts");
runTsx("forecast-stats.test", "src/lib/weather-control/forecast-stats.test.ts");
runTsx("rules.test", "src/lib/weather-control/rules.test.ts");
runTsx("propose.test", "src/lib/weather-control/propose.test.ts");
runTsx("pick-controller.test", "src/lib/weather-control/pick-controller.test.ts");
runTsx("smoke-weather-control-eval", "scripts/smoke-weather-control-eval.ts", [
  "--farm=FARM01/P00",
]);

if (withUi) {
  runNode("smoke-weather-control-ui", "scripts/smoke-weather-control-ui.mjs");
}

console.log("\nsmoke-weather-control-ship: ok");
