/**
 * Live facts (service role) → ARIA 시나리오 예상 답변
 * 실행: npx tsx scripts/predict-aria-scenarios.ts
 *
 * Next cookies 없이 Supabase service role로 list tier 조회 후
 * DEFAULT_ALARM_THRESHOLDS로 derive (서버 getAlarmSettings와 동일 기본값).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^([^#=]+)=(.*)$/.exec(line.trim());
    if (!m) continue;
    const k = m[1]!.trim();
    let v = m[2]!.trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main() {
  loadEnvLocal();

  const Module = await import("node:module");
  const M = Module.default as unknown as {
    _load: (request: string, parent: NodeModule, isMain: boolean) => unknown;
  };
  const originalLoad = M._load;
  M._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    return originalLoad(request, parent, isMain);
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const farmKey = { lsindRegistNo: "FARM01", itemCode: "P00" };

  const { data, error } = await sb
    .from("v_iot_dashboard_list")
    .select(
      "lsind_regist_no,item_code,module_uid,controller_key,eqpmn_no,stall_ty_code,stall_no,temp_c,humidity_pct,received_at,wire_ver,packet_mode,run_mode",
    )
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode)
    .limit(500);

  if (error) throw error;

  const {
    deriveAlarmsFromReadings,
    summarizeAlarms,
    DEFAULT_ALARM_SETTINGS,
  } = await import("../src/lib/data/alarms");
  const { STALL_TYPE_NAMES, normalizeStallTyCode } = await import(
    "../src/lib/data/stall-type"
  );
  const { farmShortLabel } = await import("../src/lib/data/farm-summaries");
  const { heuristicCtrlJudge, heuristicFarmJudge } = await import(
    "../src/lib/aria/protocol/parse-judge"
  );
  const { resolveDepthReq, routeByRules } = await import(
    "../src/lib/aria/protocol/route"
  );
  const { unpackCtrlJudge, unpackFarmJudge } = await import(
    "../src/lib/aria/protocol/unpack"
  );
  const { emptyAriaSession } = await import("../src/lib/aria/protocol/types");
  const { formatControllerSlotLabel } = await import(
    "../src/lib/ui/controller-labels"
  );

  type Row = {
    lsind_regist_no: string;
    item_code: string;
    module_uid: number;
    controller_key: string;
    eqpmn_no: string | null;
    stall_ty_code: string | null;
    stall_no: string | null;
    temp_c: number | null;
    humidity_pct: number | null;
    received_at: string;
  };

  const now = Date.now();
  const readings = ((data ?? []) as Row[]).map((r) => {
    const ageMin = (now - new Date(r.received_at).getTime()) / 60000;
    const status =
      ageMin <= 15 ? "normal" : ageMin <= 60 ? "caution" : "offline";
    const eqpmnNo = (r.eqpmn_no ?? "").trim() || "—";
    const stallNo = r.stall_no?.trim() || null;
    const label = formatControllerSlotLabel({
      stallNo,
      eqpmnNo,
    });
    return {
      key: `${r.lsind_regist_no}/${r.item_code}/${r.module_uid}/${r.controller_key}`,
      farmKey,
      moduleUid: Number(r.module_uid),
      controllerKey: r.controller_key,
      eqpmnNo,
      stallNo,
      stallTyCode: r.stall_ty_code,
      label,
      tempC: r.temp_c == null ? null : Number(r.temp_c),
      humidityPct: r.humidity_pct == null ? null : Number(r.humidity_pct),
      fanSupply: null,
      fanExhaust: null,
      fanIntake: null,
      fanSupplySeries: [] as number[],
      fanExhaustSeries: [] as number[],
      fanIntakeSeries: [] as number[],
      mesureDt: null,
      receivedAt: r.received_at,
      status: status as "normal" | "caution" | "offline",
      packetMode: "live" as const,
      channels: [],
    };
  });

  const alarms = deriveAlarmsFromReadings(readings, DEFAULT_ALARM_SETTINGS);
  const alarmSum = summarizeAlarms(alarms);

  const byTy = new Map<
    string,
    {
      stallTyCode: string;
      stallLabel: string;
      controllers: number;
      online: number;
      temps: number[];
      hums: number[];
      alarmCount: number;
    }
  >();

  for (const r of readings) {
    const code = normalizeStallTyCode(r.stallTyCode) || "UNK";
    const label = STALL_TYPE_NAMES[code] ?? (code === "UNK" ? "미분류" : code);
    let g = byTy.get(code);
    if (!g) {
      g = {
        stallTyCode: code,
        stallLabel: label,
        controllers: 0,
        online: 0,
        temps: [],
        hums: [],
        alarmCount: 0,
      };
      byTy.set(code, g);
    }
    g.controllers += 1;
    if (r.status !== "offline") g.online += 1;
    if (r.tempC != null) g.temps.push(r.tempC);
    if (r.humidityPct != null) g.hums.push(r.humidityPct);
  }
  for (const a of alarms) {
    const code = normalizeStallTyCode(a.stallTyCode) || "UNK";
    const g = byTy.get(code);
    if (g) g.alarmCount += 1;
  }

  const avg = (nums: number[]) =>
    nums.length === 0
      ? null
      : Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;

  const stalls = [...byTy.values()]
    .map((g) => ({
      stallTyCode: g.stallTyCode,
      stallLabel: g.stallLabel,
      controllers: g.controllers,
      online: g.online,
      alarmCount: g.alarmCount,
      tempAvgC: avg(g.temps),
      humidityAvgPct: avg(g.hums),
    }))
    .sort((a, b) => a.stallTyCode.localeCompare(b.stallTyCode));

  const online = readings.filter((r) => r.status !== "offline").length;
  const labelByKey = new Map(readings.map((r) => [r.controllerKey, r.label]));

  const alarmItems = [...alarms]
    .sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === "critical" ? -1 : 1;
      }
      return a.occurredAt < b.occurredAt ? 1 : -1;
    })
    .slice(0, 24)
    .map((a) => {
      const code = normalizeStallTyCode(a.stallTyCode) || "UNK";
      const stallLabel =
        STALL_TYPE_NAMES[code] ?? (code === "UNK" ? "미분류" : code);
      return {
        stallLabel,
        stallNo: a.stallNo,
        controllerLabel: labelByKey.get(a.controllerKey) ?? `장비 ${a.eqpmnNo}`,
        controllerKey: a.controllerKey,
        eqpmnNo: a.eqpmnNo,
        alarmType: a.alarmType,
        severity: a.severity,
        detail: a.detail,
      };
    });

  const facts = {
    farmKey,
    farmLabel: farmShortLabel(farmKey),
    totalControllers: readings.length,
    onlineControllers: online,
    offlineControllers: readings.length - online,
    alarmTotal: alarmSum.total,
    alarmCritical: alarmSum.critical,
    alarmWarning: alarmSum.warning,
    stalls,
    alarmItems,
    generatedAt: new Date().toISOString(),
  };

  type Pred = {
    n: number;
    utterance: string;
    route: string;
    depth: number | null;
    factsMode: "skip" | "load";
    text: string;
    note: string;
  };

  const rows: Pred[] = [];

  rows.push({
    n: 1,
    utterance: "안녕",
    route: "CHAT",
    depth: null,
    factsMode: "skip",
    text: "안녕하세요. 저는 ARIA입니다. 농장 현황은 「상황 어때?」처럼 질문해 주세요.",
    note: "휴리스틱 CHAT · facts 미조회",
  });

  rows.push({
    n: 2,
    utterance: "ARIA가 뭐야",
    route: "CHAT",
    depth: null,
    factsMode: "skip",
    text: "ARIA는 Agricultural Reporting & Intelligent Assistant입니다. 농장 이상상황·온도는 「상황 어때?」로 물어봐 주세요.",
    note: "CHAT 예상 톤 (OpenAI 시 가변)",
  });

  for (const [n, q, note] of [
    [3, "상황 어때", "DEPTH hint=1"] as const,
    [4, "뭐가 문제야", "DEPTH hint=2"] as const,
    [5, "어느 컨트롤러", "DEPTH hint=3"] as const,
    [6, "자세히 진단까지", "DEPTH=4 one-shot"] as const,
  ]) {
    const depth = resolveDepthReq(q, null);
    const judge = heuristicFarmJudge(facts, depth, q);
    rows.push({
      n,
      utterance: q,
      route: routeByRules(q),
      depth,
      factsMode: "load",
      text: unpackFarmJudge(judge, facts),
      note,
    });
  }

  {
    const q = "더 알려줘";
    const sess = {
      ...emptyAriaSession(),
      depth: 1 as const,
      lastRoute: "FARM" as const,
    };
    const depth = resolveDepthReq(q, sess);
    const judge = heuristicFarmJudge(facts, depth, q);
    rows.push({
      n: 7,
      utterance: "더 알려줘 (세션 D1 후)",
      route: routeByRules(q),
      depth,
      factsMode: "load",
      text: unpackFarmJudge(judge, facts),
      note: `혼합 턴 C · session+1 → DEPTH ${depth}`,
    });
  }

  for (const [n, q] of [
    [8, "설정 추천"] as const,
    [9, "온도 상한 추천해줘"] as const,
  ]) {
    const judge = heuristicCtrlJudge(facts);
    rows.push({
      n,
      utterance: q,
      route: routeByRules(q),
      depth: null,
      factsMode: "load",
      text: unpackCtrlJudge(judge, facts),
      note: `REC=${judge.rec} delta=${judge.delta}`,
    });
  }

  {
    const bits = facts.stalls
      .map((s) => `${s.stallLabel} 이상 ${s.alarmCount}건`)
      .join(", ");
    rows.push({
      n: 10,
      utterance: "상황 어때 (flag off)",
      route: "LEGACY",
      depth: null,
      factsMode: "load",
      text:
        facts.alarmTotal === 0
          ? `${facts.farmLabel} 기준 이상상황 없음. 온라인 ${facts.onlineControllers}/${facts.totalControllers}. (레거시 경로)`
          : `${facts.farmLabel} 기준 이상상황 ${facts.alarmTotal}건(위험 ${facts.alarmCritical}). ${bits}. (레거시 Chat이 JSON으로 자유 문장 — 문구 가변)`,
      note: "ARIA_PROTOCOL_V1=off",
    });
  }

  const snapshot = {
    farmLabel: facts.farmLabel,
    source: "v_iot_dashboard_list + DEFAULT_ALARM_THRESHOLDS",
    project: "iot-cloud",
    generatedAt: facts.generatedAt,
    totalControllers: facts.totalControllers,
    onlineControllers: facts.onlineControllers,
    offlineControllers: facts.offlineControllers,
    alarmTotal: facts.alarmTotal,
    alarmCritical: facts.alarmCritical,
    alarmWarning: facts.alarmWarning,
    stalls: facts.stalls.map(({ stallLabel, controllers, online, alarmCount, tempAvgC, humidityAvgPct }) => ({
      stallLabel,
      controllers,
      online,
      alarmCount,
      tempAvgC,
      humidityAvgPct,
    })),
    alarmItems: facts.alarmItems.map(
      ({
        stallLabel,
        stallNo,
        controllerLabel,
        alarmType,
        severity,
        detail,
      }) => ({
        stallLabel,
        stallNo,
        controllerLabel,
        alarmType,
        severity,
        detail,
      }),
    ),
  };

  const out = { snapshot, rows };
  const canvasDir = resolve(
    process.env.USERPROFILE ?? "",
    ".cursor/projects/c-Users-jack3-OneDrive-Desktop-SI1/canvases",
  );
  mkdirSync(canvasDir, { recursive: true });
  writeFileSync(
    resolve(canvasDir, "aria-protocol-predictions.payload.json"),
    JSON.stringify(out, null, 2),
    "utf8",
  );
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
