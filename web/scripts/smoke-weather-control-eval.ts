/**
 * Phase B smoke — config · snapshot · rules dry-run · optional edge invoke
 *
 * npx tsx scripts/smoke-weather-control-eval.ts --farm=FARM01/P00
 * npx tsx scripts/smoke-weather-control-eval.ts --farm=FARM01/P00 --invoke
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { parseFarmKeyId } from "../src/lib/data/farm-key";
import { evaluateWeatherDraft } from "../src/lib/weather-control/evaluate-draft";
import { isWeatherStale } from "../src/lib/weather/weather-stale";
import type {
  ControllerCandidate,
  SettingsSource,
  ThermoValues,
} from "../src/lib/weather-control/types";
import type { KmaForecastPoint } from "../src/lib/weather/kma-types";

loadEnv({ path: ".env.local" });

const farmArg =
  process.argv.find((a) => a.startsWith("--farm="))?.slice(7) ?? "FARM01/P00";
const invoke = process.argv.includes("--invoke");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const farmKey = parseFarmKeyId(farmArg);
if (!farmKey) {
  console.error("invalid --farm");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

const LIST_COLS =
  "lsind_regist_no, item_code, module_uid, controller_key, eqpmn_no, stall_ty_code, stall_no, temp_c, humidity_pct, setpoint_temp, temp_deviation, min_vent_pct, max_vent_pct, received_at, packet_mode";

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
    const existing = out[key];
    if (existing && existing.updatedAt >= updatedAt) continue;
    out[key] = { settings, source, updatedAt };
  }
  return out;
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

    const farm = {
      lsindRegistNo: row.lsind_regist_no,
      itemCode: row.item_code,
    };
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
      farmKey: farm,
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

async function invokeEdgeFetch(): Promise<unknown> {
  const { data: iotCfg } = await supabase
    .from("iot_decode_config")
    .select("cron_secret")
    .eq("id", 1)
    .single();

  const cronSecret = iotCfg?.cron_secret?.trim();
  if (!cronSecret) {
    throw new Error("iot_decode_config.cron_secret unavailable");
  }

  const res = await fetch(`${url}/functions/v1/fetch-farm-weather`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`edge ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  const { data: config } = await supabase
    .from("weather_control_config")
    .select("enabled, farm_keys, target_controller_key, pending_ttl_minutes")
    .eq("id", 1)
    .maybeSingle();

  console.log("config:", config);

  const { data: weather } = await supabase
    .from("farm_weather_snapshot")
    .select(
      "observed_at, temp_c, humidity_pct, fetch_ok, forecast_points, updated_at",
    )
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode)
    .maybeSingle();

  console.log("weather:", {
    observedAt: weather?.observed_at,
    tempC: weather?.temp_c,
    humidityPct: weather?.humidity_pct,
    fetchOk: weather?.fetch_ok,
    stale: weather?.observed_at
      ? isWeatherStale(weather.observed_at, 20)
      : null,
    forecastCount: Array.isArray(weather?.forecast_points)
      ? weather.forecast_points.length
      : 0,
  });

  if (invoke) {
    console.log("invoke fetch-farm-weather…");
    const edge = await invokeEdgeFetch();
    const farmResult = (edge as { farms?: Array<{ evaluate?: unknown }> })
      .farms?.[0];
    console.log("edge:", edge);
    if (farmResult?.evaluate) {
      console.log("evaluate:", farmResult.evaluate);
    }
  }

  const { data: pending } = await supabase
    .from("weather_control_recommendation")
    .select(
      "id, status, rule_id, controller_key, reason_ko, expires_at, created_at",
    )
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log("pending:", pending);

  if (
    !weather?.fetch_ok ||
    weather.temp_c == null ||
    isWeatherStale(weather.observed_at, 20)
  ) {
    console.log("dry-eval skipped: weather unavailable or stale");
    return;
  }

  const { data: listRows } = await supabase
    .from("v_iot_dashboard_list")
    .select(LIST_COLS)
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode);

  const { data: cmdRows } = await supabase
    .from("ctrl_thermo_command")
    .select(
      "lsind_regist_no, item_code, module_uid, controller_key, min_vent_pct, max_vent_pct, setpoint_temp, temp_deviation, status, created_at, sent_at, applied_at, channel",
    )
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode)
    .order("created_at", { ascending: false })
    .limit(200);

  const candidates = buildCandidates(
    (listRows ?? []) as ListRow[],
    buildCommandMap((cmdRows ?? []) as CmdRow[]),
  );

  const draft = evaluateWeatherDraft({
    weather: {
      tempC: Number(weather.temp_c),
      humidityPct:
        weather.humidity_pct != null ? Number(weather.humidity_pct) : null,
      forecastPoints: (weather.forecast_points ?? []) as KmaForecastPoint[],
      observedAt: weather.observed_at,
    },
    candidates,
    targetControllerKey: config?.target_controller_key ?? null,
    pendingTtlMinutes: config?.pending_ttl_minutes ?? 30,
  });

  console.log("dry-eval:", draft
    ? {
        ruleId: draft.ruleId,
        controllerKey: draft.controller.controllerKey,
        reasonKo: draft.reasonKo,
        proposed: draft.proposed,
      }
    : null);
  console.log("candidateCount:", candidates.length);
  console.log("smoke-weather-control-eval ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
