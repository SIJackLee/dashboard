import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { FarmKey } from "@/lib/data/farm-key";
import { getStallTypeName } from "@/lib/data/stall-type";
import {
  dismissPendingRecommendation,
  fetchPendingRecommendation,
} from "@/lib/weather-control/recommendation-store";
import type { WeatherNudgeView } from "@/lib/weather-control/weather-nudge-view";
import { isWeatherStale } from "@/lib/weather/weather-stale";

export type { WeatherNudgeView } from "@/lib/weather-control/weather-nudge-view";

function controllerDisplayName(
  stallTyCode: string,
  stallNo: string,
  eqpmnNo: string,
): string {
  const stallName = getStallTypeName(stallTyCode);
  return `${stallName} ${stallNo}번 ${eqpmnNo}번`;
}

function mapRowToView(row: {
  id: string;
  rule_id: string;
  stall_ty_code: string;
  stall_no: string;
  eqpmn_no: string;
  current_setpoint_temp: number;
  current_min_vent_pct: number;
  current_max_vent_pct: number;
  proposed_setpoint_temp: number;
  proposed_min_vent_pct: number;
  proposed_max_vent_pct: number;
  reason_ko: string;
  reason_facts: Record<string, number> | null;
  weather_observed_at: string;
  expires_at: string;
}): WeatherNudgeView {
  const stale =
    isWeatherStale(row.weather_observed_at, 20) ||
    new Date(row.expires_at).getTime() <= Date.now();

  return {
    id: row.id,
    ruleId: row.rule_id,
    controllerLabel: `${row.stall_ty_code} ${row.stall_no}번 ${row.eqpmn_no}번`,
    controllerDisplayName: controllerDisplayName(
      row.stall_ty_code,
      row.stall_no,
      row.eqpmn_no,
    ),
    current: {
      setpointTemp: Number(row.current_setpoint_temp),
      minVentPct: row.current_min_vent_pct,
      maxVentPct: row.current_max_vent_pct,
    },
    proposed: {
      setpointTemp: Number(row.proposed_setpoint_temp),
      minVentPct: row.proposed_min_vent_pct,
      maxVentPct: row.proposed_max_vent_pct,
    },
    reasonKo: row.reason_ko,
    reasonFacts: row.reason_facts ?? {},
    expiresAt: row.expires_at,
    stale,
  };
}

export async function getPendingWeatherRecommendation(
  farmKey: FarmKey,
): Promise<WeatherNudgeView | null> {
  const supabase = await createClient();
  const row = await fetchPendingRecommendation(
    supabase,
    farmKey.lsindRegistNo,
    farmKey.itemCode,
  );
  if (!row) return null;
  const view = mapRowToView(row);
  if (view.stale) return null;
  return view;
}

export async function dismissWeatherRecommendation(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  return dismissPendingRecommendation(supabase, id);
}
