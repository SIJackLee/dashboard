import assert from "node:assert/strict";
import {
  proposeDropHeat,
  proposeHumidVent,
  proposeRiseVent,
  thermoValuesEqual,
} from "@/lib/weather-control/propose";

const base = {
  setpointTemp: 24,
  tempDeviation: 2,
  minVentPct: 30,
  maxVentPct: 60,
};

assert.deepEqual(proposeRiseVent(base), {
  setpointTemp: 24,
  tempDeviation: 2,
  minVentPct: 35,
  maxVentPct: 70,
});

assert.deepEqual(proposeDropHeat(base), {
  setpointTemp: 23,
  tempDeviation: 2,
  minVentPct: 30,
  maxVentPct: 60,
});

assert.deepEqual(proposeHumidVent({ ...base, maxVentPct: 85 }), {
  setpointTemp: 24,
  tempDeviation: 2,
  minVentPct: 30,
  maxVentPct: 90,
});

assert.equal(
  thermoValuesEqual(base, { ...base, minVentPct: 30 }),
  true,
);

console.log("propose.test.ts ok");
