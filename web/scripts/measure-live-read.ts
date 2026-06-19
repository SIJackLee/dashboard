/**
 * Phase 0 — baseline LIVE read timing (local dev).
 *
 * Usage (from dashboard/web):
 *   npx tsx scripts/measure-live-read.ts
 *
 * Requires .env.local with Supabase credentials.
 */
import { createClient } from "@supabase/supabase-js";

const SAMPLES = 10;
const LIST_SOURCE = "v_iot_dashboard_list";
const LEGACY_SOURCE = "v_iot_decoded_latest";

const LIST_COLS =
  "raw_id, lsind_regist_no, item_code, module_uid, controller_key, wire_ver, packet_mode, run_mode, temp_c, humidity_pct, fan_supply_pct, fan_exhaust_pct, fan_intake_pct, mesure_dt, received_at";

const LEGACY_COLS =
  "raw_id, lsind_regist_no, item_code, module_uid, controller_key, wire_ver, packet_mode, run_mode, temp_c, humidity_pct, mesure_dt, decoded_json, received_at";

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[idx]!;
}

async function timedSelect(
  label: string,
  source: string,
  cols: string,
  limit: number,
): Promise<number[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key in env");
  }

  const supabase = createClient(url, key);
  const times: number[] = [];

  for (let i = 0; i < SAMPLES; i++) {
    const t0 = performance.now();
    const { error } = await supabase
      .from(source)
      .select(cols)
      .order("received_at", { ascending: false })
      .limit(limit);
    const ms = performance.now() - t0;
    if (error) throw new Error(`${label} sample ${i + 1}: ${error.message}`);
    times.push(ms);
  }

  return times;
}

async function main() {
  console.log(`Samples per query: ${SAMPLES}\n`);

  for (const [label, source, cols, limit] of [
    ["List tier (500)", LIST_SOURCE, LIST_COLS, 500],
    ["Legacy full (1500)", LEGACY_SOURCE, LEGACY_COLS, 1500],
    ["Overview count", "v_iot_farm_overview", "*", 100],
  ] as const) {
    const times = await timedSelect(label, source, cols, limit);
    console.log(`${label}:`);
    console.log(`  p50: ${percentile(times, 50).toFixed(1)} ms`);
    console.log(`  p95: ${percentile(times, 95).toFixed(1)} ms`);
    console.log(`  min/max: ${Math.min(...times).toFixed(1)} / ${Math.max(...times).toFixed(1)} ms`);
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
