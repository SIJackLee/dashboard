/**
 * Phase 0 — baseline LIVE read timing (local dev).
 *
 * Usage (from dashboard/web):
 *   npm run measure:live
 *   # or: npx tsx scripts/measure-live-read.ts
 *
 * Requires .env.local with Supabase credentials.
 */
import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const SAMPLES = 10;
const LIST_SOURCE = "v_iot_dashboard_list";
const LEGACY_SOURCE = "v_iot_decoded_latest";
const OVERVIEW_SOURCE = "v_iot_farm_overview";
const FARM_LSIND = "FARM01";
const FARM_ITEM = "P00";

const LIST_COLS =
  "raw_id, lsind_regist_no, item_code, module_uid, controller_key, wire_ver, packet_mode, run_mode, temp_c, humidity_pct, fan_supply_pct, fan_exhaust_pct, fan_intake_pct, mesure_dt, received_at";

const LEGACY_COLS =
  "raw_id, lsind_regist_no, item_code, module_uid, controller_key, wire_ver, packet_mode, run_mode, temp_c, humidity_pct, mesure_dt, decoded_json, received_at";

type QuerySpec = {
  label: string;
  run: (supabase: SupabaseClient) => Promise<void>;
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[idx]!;
}

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key in env");
  }
  return createClient(url, key);
}

async function timed(
  label: string,
  run: (supabase: SupabaseClient) => Promise<void>,
): Promise<number[]> {
  const supabase = client();
  const times: number[] = [];

  for (let i = 0; i < SAMPLES; i++) {
    const t0 = performance.now();
    await run(supabase);
    times.push(performance.now() - t0);
  }

  console.log(`${label}:`);
  console.log(`  p50: ${percentile(times, 50).toFixed(1)} ms`);
  console.log(`  p95: ${percentile(times, 95).toFixed(1)} ms`);
  console.log(
    `  min/max: ${Math.min(...times).toFixed(1)} / ${Math.max(...times).toFixed(1)} ms`,
  );
  console.log("");
  return times;
}

async function main() {
  console.log(`Samples per query: ${SAMPLES}\n`);
  console.log(`Measured at: ${new Date().toISOString()}`);
  console.log(`Farm scope: ${FARM_LSIND}/${FARM_ITEM}\n`);

  const queries: QuerySpec[] = [
    {
      label: "List tier (500)",
      run: async (supabase) => {
        const { error } = await supabase
          .from(LIST_SOURCE)
          .select(LIST_COLS)
          .order("received_at", { ascending: false })
          .limit(500);
        if (error) throw new Error(error.message);
      },
    },
    {
      label: "Legacy full (1500)",
      run: async (supabase) => {
        const { error } = await supabase
          .from(LEGACY_SOURCE)
          .select(LEGACY_COLS)
          .order("received_at", { ascending: false })
          .limit(1500);
        if (error) throw new Error(error.message);
      },
    },
    {
      label: "Overview count",
      run: async (supabase) => {
        const { error } = await supabase
          .from(OVERVIEW_SOURCE)
          .select("*")
          .limit(100);
        if (error) throw new Error(error.message);
      },
    },
    {
      label: "List farm-scoped (500)",
      run: async (supabase) => {
        const { error } = await supabase
          .from(LEGACY_SOURCE)
          .select(LEGACY_COLS)
          .eq("lsind_regist_no", FARM_LSIND)
          .eq("item_code", FARM_ITEM)
          .order("received_at", { ascending: false })
          .limit(500);
        if (error) throw new Error(error.message);
      },
    },
    {
      label: "Detail 1 row",
      run: async (supabase) => {
        const { error } = await supabase
          .from(LEGACY_SOURCE)
          .select(LEGACY_COLS)
          .eq("lsind_regist_no", FARM_LSIND)
          .eq("item_code", FARM_ITEM)
          .order("received_at", { ascending: false })
          .limit(1);
        if (error) throw new Error(error.message);
      },
    },
  ];

  const summary: Record<string, { p50: number; p95: number }> = {};
  for (const q of queries) {
    const times = await timed(q.label, q.run);
    summary[q.label] = {
      p50: Number(percentile(times, 50).toFixed(1)),
      p95: Number(percentile(times, 95).toFixed(1)),
    };
  }

  console.log("JSON summary:");
  console.log(JSON.stringify({ at: new Date().toISOString(), summary }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
