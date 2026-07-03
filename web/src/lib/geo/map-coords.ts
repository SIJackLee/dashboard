/** 지도 좌표 유효성 — farm-location·geocode 공용 */
export function isValidMapCoord(lat: number, lng: number): boolean {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln);
}

export function filterValidMapPoints<T extends { lat: number; lng: number }>(
  points: T[]
): T[] {
  return points.filter((p) => isValidMapCoord(p.lat, p.lng));
}
