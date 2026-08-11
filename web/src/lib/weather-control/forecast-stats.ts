import type { KmaForecastPoint } from "@/lib/weather/kma-types";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

export function forecastStats3h(
  points: KmaForecastPoint[],
  now: Date = new Date(),
): { maxTempC: number | null; minTempC: number | null } {
  const end = now.getTime() + THREE_HOURS_MS;
  let maxTempC: number | null = null;
  let minTempC: number | null = null;

  for (const p of points) {
    const at = new Date(p.at).getTime();
    if (at < now.getTime() - 60_000 || at > end) continue;
    if (p.tempC == null) continue;
    maxTempC = maxTempC == null ? p.tempC : Math.max(maxTempC, p.tempC);
    minTempC = minTempC == null ? p.tempC : Math.min(minTempC, p.tempC);
  }

  return { maxTempC, minTempC };
}
