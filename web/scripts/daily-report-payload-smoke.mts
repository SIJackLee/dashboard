/**
 * P0 검수: 컨트롤러 집계 일보 페이로드에 시계열 포인트가 있는지 확인.
 * Usage: node --import tsx scripts/daily-report-payload-smoke.mts
 * (or: npx tsx scripts/daily-report-payload-smoke.mts)
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.SMOKE_EMAIL ?? "admin@test.com";
  const password = process.env.SMOKE_PASSWORD ?? "admin1";
  if (!url || !anon) {
    console.error("missing env NEXT_PUBLIC_SUPABASE_*");
    process.exit(1);
  }

  const sb = createClient(url, anon);
  const { error: authErr } = await sb.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error("auth failed", authErr.message);
    process.exit(1);
  }

  // Dynamic import after env — uses cookies? server-only uses getAccessToken from cookies.
  // So call RPC directly like the app does, then mirror aggregation counts.
  const from = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const to = new Date().toISOString();
  const { data, error } = await sb.rpc("farm_trend_history_by_controller", {
    p_lsind: "FARM01",
    p_item: "P00",
    p_from: from,
    p_to: to,
    p_bucket: "15 minutes",
  });
  if (error) {
    console.error("rpc failed", error.message);
    process.exit(1);
  }
  const rows = data ?? [];
  const byStall = new Map();
  for (const r of rows) {
    const k = `${r.stall_ty_code}::${r.stall_no}`;
    byStall.set(k, (byStall.get(k) ?? 0) + 1);
  }
  console.log(
    JSON.stringify(
      {
        ok: rows.length >= 10,
        ctrlRows24h: rows.length,
        stalls: Object.fromEntries(byStall),
        sample: rows.slice(0, 2),
      },
      null,
      2,
    ),
  );
  if (rows.length < 10) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
