import { forecastStats3h } from "@/lib/weather-control/forecast-stats";
import { pickController } from "@/lib/weather-control/pick-controller";
import {
  buildRuleContext,
  evaluateRules,
} from "@/lib/weather-control/rules";
import { thermoValuesEqual } from "@/lib/weather-control/propose";
import type {
  ControllerCandidate,
  WeatherRecommendationDraft,
  WeatherSnapshotInput,
} from "@/lib/weather-control/types";

export type EvaluateDraftInput = {
  weather: WeatherSnapshotInput;
  candidates: ControllerCandidate[];
  targetControllerKey?: string | null;
  pendingTtlMinutes?: number;
  now?: Date;
};

export function evaluateWeatherDraft(
  input: EvaluateDraftInput,
): WeatherRecommendationDraft | null {
  const now = input.now ?? new Date();
  const controller = pickController(
    input.candidates,
    input.targetControllerKey,
  );
  if (!controller) return null;
  if (controller.settingsSource === "pending") return null;

  const forecast = forecastStats3h(input.weather.forecastPoints, now);
  const ctx = buildRuleContext(input.weather, controller, forecast);
  const rule = evaluateRules(ctx);
  if (!rule) return null;
  if (thermoValuesEqual(rule.proposed, controller.current)) return null;

  const ttlMin = input.pendingTtlMinutes ?? 30;
  const expiresAt = new Date(now.getTime() + ttlMin * 60 * 1000).toISOString();

  return {
    ...rule,
    controller,
    weatherObservedAt: input.weather.observedAt,
    externalTempC: input.weather.tempC,
    externalHumidityPct: input.weather.humidityPct,
    expiresAt,
  };
}
