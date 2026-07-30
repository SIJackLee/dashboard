/**
 * A안 PDF QA: RPC 버킷 해상도·페이로드 추정 크기·(가능 시) 실서버 페이로드와 비교.
 * Usage: npx tsx scripts/daily-report-qa-a.mts
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

const PERIODS = [
  { id: "24h", bucket: "15 minutes", expectBuckets: 96, durationMs: 24 * 3600_000 },
  { id: "7d", bucket: "1 hour", expectBuckets: 168, durationMs: 7 * 24 * 3600_000 },
  { id: "30d", bucket: "1 hour", expectBuckets: 720, durationMs: 30 * 24 * 3600_000 },
] as const;

const LSIND = process.env.SMOKE_LSIND ?? "FARM01";
const ITEM = process.env.SMOKE_ITEM ?? "P00";

type RpcRow = {
  bucket_at: string;
  stall_ty_code: string | null;
  stall_no: string | null;
  controller_key: string | null;
};

function estimatePayloadBytes(opts: {
  barnCount: number;
  buckets: Record<string, number>;
  controllersPerBarn: number;
}): number {
  // rough: 5 series × buckets × ~8B number + category strings + KPI/controllers
  let n = 800; // header
  for (let b = 0; b < opts.barnCount; b++) {
    n += 400; // kpi + meta
    n += opts.controllersPerBarn * 120;
    for (const id of ["24h", "7d", "30d"] as const) {
      const buckets = opts.buckets[id] ?? 0;
      n += buckets * (5 * 8 + 12); // 5 metrics + category label
    }
    n += 8 * 60; // detailRows
  }
  return n;
}

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
  const tAuth0 = performance.now();
  const { error: authErr } = await sb.auth.signInWithPassword({ email, password });
  const authMs = Math.round(performance.now() - tAuth0);
  if (authErr) {
    console.error("auth failed", authErr.message);
    process.exit(1);
  }

  const periodStats: Record<
    string,
    {
      rpcMs: number;
      rowCount: number;
      uniqueBuckets: number;
      stalls: number;
      controllers: number;
      expectBuckets: number;
      okAxis: boolean;
    }
  > = {};

  const stallSet = new Set<string>();
  const ctrlSet = new Set<string>();

  for (const p of PERIODS) {
    const to = new Date();
    const from = new Date(to.getTime() - p.durationMs);
    const t0 = performance.now();
    const { data, error } = await sb.rpc("farm_trend_history_by_controller", {
      p_lsind: LSIND,
      p_item: ITEM,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_bucket: p.bucket,
    });
    const rpcMs = Math.round(performance.now() - t0);
    if (error) {
      console.error(`rpc ${p.id} failed`, error.message);
      process.exit(1);
    }
    const rows = (data ?? []) as RpcRow[];
    const buckets = new Set(rows.map((r) => r.bucket_at));
    for (const r of rows) {
      const stall = `${r.stall_ty_code ?? ""}::${r.stall_no ?? ""}`;
      if (r.stall_ty_code && r.stall_no) stallSet.add(stall);
      if (r.controller_key) ctrlSet.add(r.controller_key);
    }
    periodStats[p.id] = {
      rpcMs,
      rowCount: rows.length,
      uniqueBuckets: buckets.size,
      stalls: new Set(
        rows
          .filter((r) => r.stall_ty_code && r.stall_no)
          .map((r) => `${r.stall_ty_code}::${r.stall_no}`),
      ).size,
      controllers: new Set(
        rows.map((r) => r.controller_key).filter(Boolean),
      ).size,
      expectBuckets: p.expectBuckets,
      // axis is continuous in app (96/168/720); RPC may return fewer filled slots
      okAxis: buckets.size > 0 && buckets.size <= p.expectBuckets + 2,
    };
  }

  const barnCount = Math.max(stallSet.size, 1);
  const controllersPerBarn = Math.max(
    1,
    Math.round(ctrlSet.size / barnCount),
  );
  const bucketsFull = { "24h": 96, "7d": 168, "30d": 720 };
  const bucketsDisplayOld = { "24h": 24, "7d": 28, "30d": 30 };
  const estFull = estimatePayloadBytes({
    barnCount,
    buckets: bucketsFull,
    controllersPerBarn,
  });
  const estOld = estimatePayloadBytes({
    barnCount,
    buckets: bucketsDisplayOld,
    controllersPerBarn,
  });

  // Synthetic payload JSON size (full axis null-filled like app)
  const synthBarn = () => {
    const series = (n: number) => ({
      categories: Array.from({ length: n }, (_, i) => String(i)),
      temp: Array.from({ length: n }, () => 25.5),
      humidity: Array.from({ length: n }, () => 60),
      motorA: Array.from({ length: n }, () => 40),
      motorB: Array.from({ length: n }, () => 30),
      motorC: Array.from({ length: n }, () => 20),
    });
    return {
      stallTyCode: "SP01",
      stallLabel: "임신사",
      stallNo: "1",
      kpi: {
        tempNow: 25,
        humNow: 60,
        motorA: 40,
        motorB: 30,
        motorC: 20,
        tMin24: 20,
        tMax24: 30,
        online: controllersPerBarn,
        total: controllersPerBarn,
        judge: "정상",
      },
      controllers: Array.from({ length: controllersPerBarn }, (_, i) => ({
        controllerKey: `c${i}`,
        eqpmnNo: String(i + 1),
        tempC: 25,
        humidityPct: 60,
        motorA: 40,
        motorB: 30,
        motorC: 20,
        status: "ok",
      })),
      periods: {
        "24h": series(96),
        "7d": series(168),
        "30d": series(720),
      },
      detailRows: Array.from({ length: 8 }, (_, i) => ({
        label: String(i),
        temp: 25,
        humidity: 60,
        motorA: 40,
        motorB: 30,
      })),
    };
  };
  const synthPayload = {
    farmKey: { lsindRegistNo: LSIND, itemCode: ITEM },
    reportDate: "2026-07-27",
    generatedAt: "2026-07-27 14:00",
    overview: {
      barnCount,
      controllerCount: ctrlSet.size,
      onlineCount: ctrlSet.size,
      offlineCount: 0,
      alarmCount: 0,
    },
    barns: Array.from({ length: barnCount }, () => synthBarn()),
  };
  const json = JSON.stringify(synthPayload);
  const jsonBytes = Buffer.byteLength(json, "utf8");

  // PDF page count heuristic (cover + index chunks + 2 pages/barn)
  const indexPages = Math.max(1, Math.ceil(barnCount / 24));
  const pdfPages = 1 + indexPages + barnCount * 2;

  // Canvas stroke cost: points drawn per barn (3 charts × periods on pages)
  // Page A: 24h × ~3 charts; Page B: 7d+30d × ~3 charts
  const strokesPerBarn =
    96 * 3 + // 24h temp/hum/motor(~2 lines avg as 3)
    168 * 3 +
    720 * 3;
  const totalStrokePoints = strokesPerBarn * barnCount;

  const report = {
    farm: `${LSIND}:${ITEM}`,
    authMs,
    commitExpectation: {
      pdfSeries: "RPC axis 96/168/720 (no GRAPH_BARS downsample)",
      dashboardDisplay: "GRAPH_BARS 24/28/30",
    },
    periods: periodStats,
    inventory: {
      stallsSeen: stallSet.size,
      controllersSeen: ctrlSet.size,
      controllersPerBarnApprox: controllersPerBarn,
    },
    payload: {
      synthJsonKB: Math.round((jsonBytes / 1024) * 10) / 10,
      estimateFullKB: Math.round((estFull / 1024) * 10) / 10,
      estimateOldDisplayKB: Math.round((estOld / 1024) * 10) / 10,
      sizeRatioVsOldDisplay: Math.round((estFull / estOld) * 10) / 10,
    },
    pdfHeuristic: {
      pages: pdfPages,
      strokePointsApprox: totalStrokePoints,
      note: "browser canvas+jspdf; heavy part is 30d×720 on page B",
    },
    verdict: {
      rpcOk: Object.values(periodStats).every((s) => s.okAxis && s.rowCount > 0),
      payloadHeavy: jsonBytes > 2.5 * 1024 * 1024,
      payloadWarn: jsonBytes > 800 * 1024,
      recommend: "OK for FARM-scale if synthJsonKB < 800; watch 30d chart density",
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.verdict.rpcOk) process.exit(2);
  if (report.verdict.payloadHeavy) process.exit(3);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
