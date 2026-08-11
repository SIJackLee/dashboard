import assert from "node:assert/strict";
import { forecastStats3h } from "@/lib/weather-control/forecast-stats";

const now = new Date("2026-08-11T01:00:00.000Z");
const points = [
  { at: "2026-08-11T10:00:00+09:00", tempC: 28, humidityPct: 60 },
  { at: "2026-08-11T11:00:00+09:00", tempC: 31, humidityPct: 55 },
  { at: "2026-08-11T15:00:00+09:00", tempC: 33, humidityPct: 50 },
];

const stats = forecastStats3h(points, now);
assert.equal(stats.maxTempC, 31);
assert.equal(stats.minTempC, 28);

console.log("forecast-stats.test.ts ok");
