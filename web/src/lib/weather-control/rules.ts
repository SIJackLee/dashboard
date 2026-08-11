import {
  proposeDropHeat,
  proposeHumidVent,
  proposeRiseVent,
  thermoValuesEqual,
} from "@/lib/weather-control/propose";
import type {
  WeatherRuleContext,
  WeatherRuleDraft,
  WeatherRuleId,
} from "@/lib/weather-control/types";

function matchHumid(ctx: WeatherRuleContext): WeatherRuleDraft | null {
  const extHum = ctx.externalHumidityPct ?? 0;
  const intHum = ctx.internalHumidityPct ?? 0;
  if (extHum < 70 && intHum < 75) return null;
  if (ctx.current.maxVentPct >= 90) return null;

  const proposed = proposeHumidVent(ctx.current);
  if (thermoValuesEqual(proposed, ctx.current)) return null;

  return {
    ruleId: "wx_humid_vent",
    reasonKo: "외기·축사 습도가 높아 최고환기량을 소폭 올이는 것을 권장합니다.",
    reasonFacts: {
      externalHumidity: extHum,
      internalHumidity: intHum,
    },
    proposed,
  };
}

function matchRiseVent(ctx: WeatherRuleContext): WeatherRuleDraft | null {
  const ext = ctx.externalTempC;
  const max3h = ctx.forecastMax3h;
  if (max3h == null) return null;

  const rise = max3h - ext;
  if (rise < 3) return null;

  const internal = ctx.internalTempC;
  if (internal == null || internal < ext - 4) return null;
  if (ctx.current.maxVentPct >= 90) return null;

  const proposed = proposeRiseVent(ctx.current);
  if (thermoValuesEqual(proposed, ctx.current)) return null;

  return {
    ruleId: "wx_rise_vent",
    reasonKo:
      "앞으로 외기가 더 더워질 예정이고 축사 여유가 적어 환기 하·상한을 소폭 올이는 것을 권장합니다.",
    reasonFacts: {
      externalNow: ext,
      forecastMax3h: max3h,
      internalTemp: internal,
      rise3h: rise,
    },
    proposed,
  };
}

function matchDropHeat(ctx: WeatherRuleContext): WeatherRuleDraft | null {
  const ext = ctx.externalTempC;
  const min3h = ctx.forecastMin3h;
  if (min3h == null) return null;
  if (min3h > ext - 3) return null;
  if (ctx.current.setpointTemp <= 18) return null;

  const internal = ctx.internalTempC;
  if (internal == null || internal - min3h >= 2) return null;

  const proposed = proposeDropHeat(ctx.current);
  if (thermoValuesEqual(proposed, ctx.current)) return null;

  return {
    ruleId: "wx_drop_heat",
    reasonKo:
      "앞으로 외기가 식을 예정이고 실내가 함께 내려갈 여지가 있어 목표온도를 1°C 낮추는 것을 권장합니다.",
    reasonFacts: {
      externalNow: ext,
      forecastMin3h: min3h,
      internalTemp: internal,
      drop3h: ext - min3h,
    },
    proposed,
  };
}

const MATCHERS: Record<
  WeatherRuleId,
  (ctx: WeatherRuleContext) => WeatherRuleDraft | null
> = {
  wx_humid_vent: matchHumid,
  wx_rise_vent: matchRiseVent,
  wx_drop_heat: matchDropHeat,
};

export function evaluateRules(
  ctx: WeatherRuleContext,
  priority: WeatherRuleId[] = ["wx_humid_vent", "wx_rise_vent", "wx_drop_heat"],
): WeatherRuleDraft | null {
  for (const ruleId of priority) {
    const hit = MATCHERS[ruleId](ctx);
    if (hit) return hit;
  }
  return null;
}

export function buildRuleContext(
  weather: { tempC: number; humidityPct: number | null },
  controller: {
    tempC: number | null;
    humidityPct: number | null;
    current: import("@/lib/weather-control/types").ThermoValues;
  },
  forecast: { maxTempC: number | null; minTempC: number | null },
): WeatherRuleContext {
  return {
    externalTempC: weather.tempC,
    externalHumidityPct: weather.humidityPct,
    internalTempC: controller.tempC,
    internalHumidityPct: controller.humidityPct,
    forecastMax3h: forecast.maxTempC,
    forecastMin3h: forecast.minTempC,
    current: controller.current,
  };
}
