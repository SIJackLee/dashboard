import { forecastStats3h } from "./forecast-stats.ts";
import { pickController } from "./pick-controller.ts";
import { buildRuleContext, evaluateRules } from "./rules.ts";
import { thermoValuesEqual } from "./propose.ts";
import type {
  ControllerCandidate,
  WeatherRecommendationDraft,
  WeatherSnapshotInput,
} from "./types.ts";

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
