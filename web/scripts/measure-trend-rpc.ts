/**
 * Trend RPC baseline — 30d @ 15m canonical fetch (local dev).
 *
 * Usage (from dashboard/web):
 *   npm run measure:trend
 *   # or: npx tsx scripts/measure-trend-rpc.ts
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

const SAMPLES = 5;
const FARM_LSIND = "FARM01";
const FARM_ITEM = "P00";
const BUCKET_15M = "15 minutes";
const DAYS_30_MS = 30 * 24 * 60 * 60_000;

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

function periodRange(nowMs: number): { fromIso: string; toIso: string } {
  const toMs = nowMs;
  const fromMs = toMs - DAYS_30_MS;
  return {
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(toMs).toISOString(),
  };
}

async function timedRpc(
  label: string,
  run: (supabase: SupabaseClient) => Promise<number>,
): Promise<{ p50: number; p95: number; rows: number }> {
  const supabase = client();
  const times: number[] = [];
  let lastRows = 0;

  for (let i = 0; i < SAMPLES; i++) {
    const t0 = performance.now();
    lastRows = await run(supabase);
    times.push(performance.now() - t0);
  }

  const p50 = percentile(times, 50);
  const p95 = percentile(times, 95);
  console.log(`${label}:`);
  console.log(`  rows: ${lastRows}`);
  console.log(`  p50: ${p50.toFixed(1)} ms`);
  console.log(`  p95: ${p95.toFixed(1)} ms`);
  console.log(
    `  min/max: ${Math.min(...times).toFixed(1)} / ${Math.max(...times).toFixed(1)} ms`,
  );
  console.log("");
  return { p50: Number(p50.toFixed(1)), p95: Number(p95.toFixed(1)), rows: lastRows };
}

async function main() {
  const nowMs = Date.now();
  const { fromIso, toIso } = periodRange(nowMs);

  console.log(`Samples per RPC: ${SAMPLES}\n`);
  console.log(`Measured at: ${new Date().toISOString()}`);
  console.log(`Farm scope: ${FARM_LSIND}/${FARM_ITEM}`);
  console.log(`Window: 30d · bucket: ${BUCKET_15M}\n`);

  const summary: Record<string, unknown> = {};

  summary.stall = await timedRpc("farm_trend_history (stall avg)", async (supabase) => {
    const { data, error } = await supabase.rpc("farm_trend_history", {
      p_lsind: FARM_LSIND,
      p_item: FARM_ITEM,
      p_from: fromIso,
      p_to: toIso,
      p_bucket: BUCKET_15M,
    });
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data.length : 0;
  });

  summary.controller = await timedRpc(
    "farm_trend_history_by_controller",
    async (supabase) => {
      const { data, error } = await supabase.rpc(
        "farm_trend_history_by_controller",
        {
          p_lsind: FARM_LSIND,
          p_item: FARM_ITEM,
          p_from: fromIso,
          p_to: toIso,
          p_bucket: BUCKET_15M,
        },
      );
      if (error) throw new Error(error.message);
      return Array.isArray(data) ? data.length : 0;
    },
  );

  console.log("JSON summary:");
  console.log(
    JSON.stringify(
      {
        at: new Date().toISOString(),
        farm: `${FARM_LSIND}/${FARM_ITEM}`,
        bucket: BUCKET_15M,
        expectBucketsPerSeries: 2880,
        summary,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
