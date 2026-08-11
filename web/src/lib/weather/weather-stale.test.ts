import assert from "node:assert/strict";
import { isWeatherStale } from "@/lib/weather/weather-stale";

const now = new Date("2026-08-11T05:30:00.000Z");
const fresh = "2026-08-11T05:15:00.000Z";
const old = "2026-08-11T04:50:00.000Z";

assert.equal(isWeatherStale(fresh, 20, now), false);
assert.equal(isWeatherStale(old, 20, now), true);
assert.equal(isWeatherStale(fresh, 30, now), false);

console.log("weather-stale.test.ts ok");
