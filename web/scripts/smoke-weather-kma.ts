/**
 * KMA 초단기 실황·예보 smoke — API 키 필요
 * 실행: npx tsx scripts/smoke-weather-kma.ts --lat=37.5665 --lng=126.978
 */
import { config as loadEnv } from "dotenv";
import { resolveUltraFcstBase, resolveUltraNcstBase } from "../src/lib/weather/kma-base-time";
import { fetchKmaReading, latLngToGrid } from "../src/lib/weather/kma-client";

loadEnv({ path: ".env.local" });

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const lat = Number(arg("lat", "37.5665"));
const lng = Number(arg("lng", "126.978"));
const key = process.env.KMA_DATA_API_KEY?.trim();

if (!key) {
  console.error("KMA_DATA_API_KEY missing (.env.local or env)");
  process.exit(1);
}

const grid = latLngToGrid(lat, lng);
const ncstBase = resolveUltraNcstBase();
const fcstBase = resolveUltraFcstBase();

console.log({ lat, lng, grid, ncstBase, fcstBase });

async function main() {
  const res = await fetchKmaReading(lat, lng, key!);
  if (!res.ok) {
    console.error("fetch failed:", res.error, res.reading);
    process.exit(1);
  }

  console.log({
    tempC: res.reading.tempC,
    humidityPct: res.reading.humidityPct,
    windMs: res.reading.windMs,
    precipMm: res.reading.precipMm,
    forecastCount: res.reading.forecastPoints.length,
    forecastSample: res.reading.forecastPoints.slice(0, 3),
    resultCode: res.reading.resultCode,
  });

  console.log("smoke-weather-kma ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
