import assert from "node:assert/strict";
import { buildRuleContext, evaluateRules } from "@/lib/weather-control/rules";

const current = {
  setpointTemp: 24,
  tempDeviation: 2,
  minVentPct: 30,
  maxVentPct: 60,
};

const riseCtx = buildRuleContext(
  { tempC: 27, humidityPct: 55 },
  { tempC: 27.2, humidityPct: 58, current },
  { maxTempC: 31, minTempC: 28 },
);
const rise = evaluateRules(riseCtx);
assert.equal(rise?.ruleId, "wx_rise_vent");
assert.equal(rise?.proposed.maxVentPct, 70);

const dropCtx = buildRuleContext(
  { tempC: 27, humidityPct: 55 },
  { tempC: 26, humidityPct: 58, current },
  { maxTempC: 27, minTempC: 23 },
);
const drop = evaluateRules(dropCtx);
assert.equal(drop?.ruleId, "wx_drop_heat");
assert.equal(drop?.proposed.setpointTemp, 23);

const humidCtx = buildRuleContext(
  { tempC: 25, humidityPct: 72 },
  { tempC: 26, humidityPct: 60, current },
  { maxTempC: 26, minTempC: 25 },
);
const humid = evaluateRules(humidCtx);
assert.equal(humid?.ruleId, "wx_humid_vent");

const noMatch = buildRuleContext(
  { tempC: 22, humidityPct: 50 },
  { tempC: 21, humidityPct: 50, current },
  { maxTempC: 23, minTempC: 22 },
);
assert.equal(evaluateRules(noMatch), null);

console.log("rules.test.ts ok");
