import "server-only";

import { sendThermoCommandAction } from "@/app/(dashboard)/controllers/actions";
import { canEditFarmScope } from "@/lib/auth/farm-access";
import { canCommand, getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";
import { farmKeyId } from "@/lib/data/farm-key";
import { getFarmWeatherSnapshot } from "@/lib/data/farm-weather";
import { getThermoCommandHistory } from "@/lib/data/commands";
import { getLiveReadings } from "@/lib/data/iot";
import { isWeatherStale } from "@/lib/weather/weather-stale";
import { buildControllerCandidates } from "@/lib/weather-control/build-candidates";
import { evaluateWeatherDraft } from "@/lib/weather-control/evaluate-draft";
import { thermoValuesEqual } from "@/lib/weather-control/propose";
import type { ThermoValues } from "@/lib/weather-control/types";
import {
  fetchRecommendationById,
  markRecommendationApproved,
} from "@/lib/weather-control/recommendation-store";

/** 승인 시 LIVE·외기 snapshot 허용 age (분) */
export const WEATHER_APPROVE_MAX_AGE_MIN = 15;

export type ApproveWeatherResult =
  | { ok: true; commandId: string }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "forbidden"
        | "not_found"
        | "expired"
        | "stale_conditions"
        | "command_failed"
        | "approve_failed";
      message?: string;
    };

function rowProposed(row: {
  proposed_setpoint_temp: number;
  proposed_temp_deviation: number;
  proposed_min_vent_pct: number;
  proposed_max_vent_pct: number;
}): ThermoValues {
  return {
    setpointTemp: Number(row.proposed_setpoint_temp),
    tempDeviation: Number(row.proposed_temp_deviation),
    minVentPct: row.proposed_min_vent_pct,
    maxVentPct: row.proposed_max_vent_pct,
  };
}

export async function approveWeatherRecommendation(
  id: string,
): Promise<ApproveWeatherResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "unauthorized" };
  }
  if (!canCommand(user)) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const row = await fetchRecommendationById(supabase, id);
  if (!row || row.status !== "pending") {
    return { ok: false, error: "not_found" };
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: "expired" };
  }

  const farmKey = {
    lsindRegistNo: row.lsind_regist_no,
    itemCode: row.item_code,
  };
  if (!canEditFarmScope(user, farmKey)) {
    return { ok: false, error: "forbidden" };
  }

  const weather = await getFarmWeatherSnapshot(farmKey);
  if (
    !weather?.fetchOk ||
    weather.tempC == null ||
    isWeatherStale(weather.observedAt, WEATHER_APPROVE_MAX_AGE_MIN)
  ) {
    return { ok: false, error: "stale_conditions" };
  }

  const readings = await getLiveReadings({ farmKey, slim: true });
  const live = readings.find((r) => r.controllerKey === row.controller_key);
  if (
    !live ||
    live.status === "offline" ||
    isWeatherStale(live.receivedAt, WEATHER_APPROVE_MAX_AGE_MIN)
  ) {
    return { ok: false, error: "stale_conditions" };
  }

  const commands = await getThermoCommandHistory(200, { q: farmKeyId(farmKey) });
  const candidates = buildControllerCandidates(readings, commands);
  const draft = evaluateWeatherDraft({
    weather: {
      tempC: weather.tempC,
      humidityPct: weather.humidityPct,
      forecastPoints: weather.forecastPoints,
      observedAt: weather.observedAt,
    },
    candidates,
    targetControllerKey: row.controller_key,
  });

  const expected = rowProposed(row);
  if (
    !draft ||
    draft.ruleId !== row.rule_id ||
    draft.controller.controllerKey !== row.controller_key ||
    !thermoValuesEqual(draft.proposed, expected)
  ) {
    return { ok: false, error: "stale_conditions" };
  }

  const formData = new FormData();
  formData.set("lsind_regist_no", row.lsind_regist_no);
  formData.set("item_code", row.item_code);
  formData.set("module_uid", String(row.module_uid));
  formData.set("stall_ty_code", row.stall_ty_code);
  formData.set("stall_no", row.stall_no);
  formData.set("eqpmn_no", row.eqpmn_no);
  formData.set("min_vent_pct", String(expected.minVentPct));
  formData.set("max_vent_pct", String(expected.maxVentPct));
  formData.set("setpoint_temp", String(expected.setpointTemp));
  formData.set("temp_deviation", String(expected.tempDeviation));
  formData.set("note", `weather:${row.rule_id}:${row.id}`);

  const cmd = await sendThermoCommandAction(formData);
  if (!cmd.ok) {
    return {
      ok: false,
      error: "command_failed",
      message: cmd.error,
    };
  }

  const marked = await markRecommendationApproved(
    supabase,
    id,
    cmd.id,
    user.id,
  );
  if (!marked.ok) {
    return {
      ok: false,
      error: "approve_failed",
      message: marked.error,
    };
  }

  return { ok: true, commandId: cmd.id };
}
