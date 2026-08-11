/** Phase B 재검증용 — snapshot age > maxAgeMin 이면 stale */
export function isWeatherStale(
  observedAt: string,
  maxAgeMin = 20,
  now: Date = new Date(),
): boolean {
  const ageMs = now.getTime() - new Date(observedAt).getTime();
  return ageMs > maxAgeMin * 60 * 1000;
}
