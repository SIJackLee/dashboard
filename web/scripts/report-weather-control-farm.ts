/**
 * FARM01 기상·규칙 리포트 (1회)
 * npx tsx scripts/report-weather-control-farm.ts --farm=FARM01/P00
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { farmKeyId, parseFarmKeyId } from "../src/lib/data/farm-key";
import { getStallTypeName } from "../src/lib/data/stall-type";
import { evaluateWeatherDraft } from "../src/lib/weather-control/evaluate-draft";
import { forecastStats3h } from "../src/lib/weather-control/forecast-stats";
import { pickController } from "../src/lib/weather-control/pick-controller";
import { proposeDropHeat, proposeHumidVent, proposeRiseVent } from "../src/lib/weather-control/propose";
import { buildRuleContext, evaluateRules } from "../src/lib/weather-control/rules";
import type {
  ControllerCandidate,
  SettingsSource,
  ThermoValues,
} from "../src/lib/weather-control/types";
import type { KmaForecastPoint } from "../src/lib/weather/kma-types";

loadEnv({ path: ".env.local" });

const farmArg =
  process.argv.find((a) => a.startsWith("--farm="))?.slice(7) ?? "FARM01/P00";
const farmKey = parseFarmKeyId(farmArg);
if (!farmKey) {
  console.error("invalid farm");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  console.error("missing supabase env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

type ListRow = {
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  controller_key: string;
  eqpmn_no: string | null;
  stall_ty_code: string | null;
  stall_no: string | null;
  temp_c: number | null;
  humidity_pct: number | null;
  setpoint_temp: number | null;
  temp_deviation: number | null;
  min_vent_pct: number | null;
  max_vent_pct: number | null;
  received_at: string;
  packet_mode: string | null;
};

const LIST_COLS =
  "lsind_regist_no, item_code, module_uid, controller_key, eqpmn_no, stall_ty_code, stall_no, temp_c, humidity_pct, setpoint_temp, temp_deviation, min_vent_pct, max_vent_pct, received_at, packet_mode";

function statusFromAge(receivedAt: string): ControllerCandidate["status"] {
  const ageMin = (Date.now() - new Date(receivedAt).getTime()) / 60000;
  if (ageMin <= 15) return "normal";
  if (ageMin <= 60) return "caution";
  return "offline";
}

function buildCommandMap(commands: CmdRow[]) {
  const out: Record<
    string,
    { settings: ThermoValues; source: SettingsSource; updatedAt: string }
  > = {};
  for (const cmd of commands) {
    if (cmd.status === "failed" || cmd.status === "cancelled") continue;
    if (!cmd.controller_key) continue;
    const key = thermoKey(
      cmd.lsind_regist_no,
      cmd.item_code,
      cmd.module_uid,
      cmd.controller_key,
      cmd.channel ?? undefined,
    );
    const settings: ThermoValues = {
      setpointTemp: Number(cmd.setpoint_temp),
      tempDeviation: Number(cmd.temp_deviation),
      minVentPct: cmd.min_vent_pct,
      maxVentPct: cmd.max_vent_pct,
    };
    const source: SettingsSource =
      cmd.status === "pending"
        ? "pending"
        : cmd.status === "applied"
          ? "applied"
          : "sent";
    const updatedAt = cmd.applied_at ?? cmd.sent_at ?? cmd.created_at;
    if (out[key] && out[key].updatedAt >= updatedAt) continue;
    out[key] = { settings, source, updatedAt };
  }
  return out;
}

type CmdRow = {
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  controller_key: string | null;
  min_vent_pct: number;
  max_vent_pct: number;
  setpoint_temp: string | number;
  temp_deviation: string | number;
  status: string;
  created_at: string;
  sent_at: string | null;
  applied_at: string | null;
  channel: string | null;
};

function thermoKey(
  lsind: string,
  item: string,
  moduleUid: number,
  controllerKey: string,
  channel?: string,
): string {
  const base = `${lsind}/${item}:${moduleUid}:${controllerKey}`;
  return channel ? `${base}:${channel}` : base;
}

function buildCandidates(
  rows: ListRow[],
  commandMap: ReturnType<typeof buildCommandMap>,
): ControllerCandidate[] {
  const out: ControllerCandidate[] = [];
  for (const row of rows) {
    if (row.packet_mode !== "live") continue;
    const status = statusFromAge(row.received_at);
    if (status === "offline") continue;
    if (
      row.setpoint_temp == null ||
      row.temp_deviation == null ||
      row.min_vent_pct == null ||
      row.max_vent_pct == null
    ) {
      continue;
    }
    const thermo: ThermoValues = {
      setpointTemp: Number(row.setpoint_temp),
      tempDeviation: Number(row.temp_deviation),
      minVentPct: Number(row.min_vent_pct),
      maxVentPct: Number(row.max_vent_pct),
    };
    const cmdEntry =
      commandMap[
        thermoKey(
          row.lsind_regist_no,
          row.item_code,
          row.module_uid,
          row.controller_key,
        )
      ] ??
      commandMap[
        thermoKey(
          row.lsind_regist_no,
          row.item_code,
          row.module_uid,
          row.controller_key,
          "A",
        )
      ];
    const parts = row.controller_key.split(":");
    out.push({
      farmKey,
      moduleUid: row.module_uid,
      controllerKey: row.controller_key,
      stallTyCode: row.stall_ty_code ?? parts[0] ?? "SP01",
      stallNo: row.stall_no ?? parts[1] ?? "01",
      eqpmnNo: row.eqpmn_no ?? parts[2] ?? "01",
      label: row.controller_key,
      tempC: row.temp_c != null ? Number(row.temp_c) : null,
      humidityPct: row.humidity_pct != null ? Number(row.humidity_pct) : null,
      status,
      current: cmdEntry?.settings ?? thermo,
      settingsSource: cmdEntry?.source ?? "live",
      liveReceivedAt: row.received_at,
    });
  }
  return out;
}

function fmtThermo(t: ThermoValues): string {
  return `목표 ${t.setpointTemp}°C · 편차 ±${t.tempDeviation}°C · 환기 ${t.minVentPct}~${t.maxVentPct}%`;
}

async function main() {
  const { data: wx } = await supabase
    .from("farm_weather_snapshot")
    .select("*")
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode)
    .maybeSingle();

  const { data: listRows } = await supabase
    .from("v_iot_dashboard_list")
    .select(LIST_COLS)
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode);

  const { data: cmdRows } = await supabase
    .from("ctrl_thermo_command")
    .select(
      "lsind_regist_no, item_code, module_uid, controller_key, stall_ty_code, stall_no, eqpmn_no, min_vent_pct, max_vent_pct, setpoint_temp, temp_deviation, status, created_at, sent_at, applied_at, channel",
    )
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode)
    .order("created_at", { ascending: false })
    .limit(200);

  const commands = (cmdRows ?? []) as CmdRow[];
  const candidates = buildCandidates(
    (listRows ?? []) as ListRow[],
    buildCommandMap(commands),
  );

  const now = new Date();
  const tempC = wx?.temp_c != null ? Number(wx.temp_c) : null;
  const humidityPct =
    wx?.humidity_pct != null ? Number(wx.humidity_pct) : null;
  const forecastPoints = (wx?.forecast_points ?? []) as KmaForecastPoint[];
  const forecast = forecastStats3h(forecastPoints, now);
  const picked = pickController(candidates);

  let draft = null;
  if (wx?.fetch_ok && tempC != null) {
    draft = evaluateWeatherDraft({
      weather: {
        tempC,
        humidityPct,
        forecastPoints,
        observedAt: wx.observed_at,
      },
      candidates,
    });
  }

  console.log(`\n=== ${farmKeyId(farmKey)} 기상·규칙 리포트 (${now.toISOString()}) ===\n`);

  console.log("## 1. 외기 (KMA 스냅샷)");
  console.log("| 항목 | 값 |");
  console.log("|------|-----|");
  console.log(`| 관측 시각 | ${wx?.observed_at ?? "—"} |`);
  console.log(`| 외기 온도 | ${tempC ?? "—"}°C |`);
  console.log(`| 외기 습도 | ${humidityPct ?? "—"}% |`);
  console.log(`| 수집 상태 | ${wx?.fetch_ok ? "정상" : "실패"} |`);

  console.log("\n## 2. 3시간 예보 (규칙 입력)");
  console.log("| 시각 (KST) | 기온 | 습도 |");
  console.log("|------------|------|------|");
  for (const p of forecastPoints) {
    const kst = new Date(p.at).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    console.log(
      `| ${kst} | ${p.tempC ?? "—"}°C | ${p.humidityPct ?? "—"}% |`,
    );
  }
  console.log(
    `\n**3시간 구간 집계:** 최고 ${forecast.maxTempC ?? "—"}°C · 최저 ${forecast.minTempC ?? "—"}°C`,
  );

  console.log("\n## 3. 규칙 판정 (자동 선택 컨트롤러 기준)");
  if (!picked) {
    console.log("online 컨트롤러 없음 — 판정 불가");
    return;
  }

  const display = `${getStallTypeName(picked.stallTyCode)} ${picked.stallNo}번 ${picked.eqpmnNo}번`;
  const ctx = buildRuleContext(
    { tempC: tempC ?? 0, humidityPct },
    picked,
    forecast,
  );
  const ceiling = picked.current.setpointTemp + picked.current.tempDeviation;
  const headroom = (picked.tempC ?? 0) > 0 ? ceiling - (picked.tempC ?? 0) : null;

  console.log(`\n**자동 선택:** ${display} (내부 ${picked.tempC}°C · 습도 ${picked.humidityPct}%)`);
  console.log(`**현재 설정:** ${fmtThermo(picked.current)}`);
  console.log(`**온도 여유:** 목표+편차 ${ceiling}°C 대비 내부 ${headroom?.toFixed(1) ?? "—"}°C`);

  console.log("\n| 규칙 | 조건 | 현재값 | 충족 |");
  console.log("|------|------|--------|------|");

  const humidPass =
    (ctx.externalHumidityPct ?? 0) >= 70 || (ctx.internalHumidityPct ?? 0) >= 75;
  console.log(
    `| 고습 환기 | 외기≥70% 또는 내부≥75% | 외기 ${ctx.externalHumidityPct}% · 내부 ${ctx.internalHumidityPct}% | ${humidPass ? "✅" : "❌"} |`,
  );

  const rise =
    ctx.forecastMax3h != null ? ctx.forecastMax3h - ctx.externalTempC : null;
  const risePass =
    rise != null &&
    rise >= 3 &&
    ctx.internalTempC != null &&
    ctx.internalTempC >= ctx.externalTempC - 4;
  console.log(
    `| 상승 환기 | 3h 상승≥3°C · 내부≥외기−4°C | 상승 ${rise?.toFixed(1) ?? "—"}°C (${ctx.externalTempC}→${ctx.forecastMax3h}) · 내부 ${ctx.internalTempC}°C | ${risePass ? "✅" : "❌"} |`,
  );

  const drop =
    ctx.forecastMin3h != null ? ctx.externalTempC - ctx.forecastMin3h : null;
  const dropPass =
    ctx.forecastMin3h != null &&
    ctx.forecastMin3h <= ctx.externalTempC - 3 &&
    ctx.current.setpointTemp > 18 &&
    ctx.internalTempC != null &&
    ctx.internalTempC - ctx.forecastMin3h < 2;
  console.log(
    `| 하강 난방 | 3h 하강≥3°C · 실내−예보최저<2°C | 하강 ${drop?.toFixed(1) ?? "—"}°C (${ctx.externalTempC}→${ctx.forecastMin3h}) · 실내 ${ctx.internalTempC}°C | ${dropPass ? "✅" : "❌"} |`,
  );

  console.log("\n## 4. 권장 결과");
  if (!draft) {
    console.log("\n**권장 없음** — 위 규칙 중 어느 것도 충족하지 않습니다.\n");
    console.log("참고: 충족 시 권장 Δ");
    console.log(`- 고습: ${fmtThermo(proposeHumidVent(picked.current))}`);
    console.log(`- 상승: ${fmtThermo(proposeRiseVent(picked.current))}`);
    console.log(`- 하강: ${fmtThermo(proposeDropHeat(picked.current))}`);
    return;
  }

  const rule = evaluateRules(ctx)!;
  console.log("\n| | 현재 | 권장 |");
  console.log("|--|------|------|");
  console.log(
    `| 목표온도 | ${picked.current.setpointTemp}°C | **${draft.proposed.setpointTemp}°C** |`,
  );
  console.log(
    `| 온도편차 | ±${picked.current.tempDeviation}°C | ±${draft.proposed.tempDeviation}°C |`,
  );
  console.log(
    `| 최저환기 | ${picked.current.minVentPct}% | **${draft.proposed.minVentPct}%** |`,
  );
  console.log(
    `| 최고환기 | ${picked.current.maxVentPct}% | **${draft.proposed.maxVentPct}%** |`,
  );
  console.log(`\n**적용 규칙:** ${draft.reasonKo}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
