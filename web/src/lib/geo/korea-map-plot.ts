/** 남한(제주·울릉 포함) 플롯용 대략 경계 — 외부 지도 SDK 없이 핀 배치 */
export const KOREA_MAP_BOUNDS = {
  latMin: 33.0,
  latMax: 38.72,
  lngMin: 124.55,
  lngMax: 131.95,
} as const;

export function projectKoreaLatLng(
  lat: number,
  lng: number,
  padPct = 7,
): { x: number; y: number } {
  const { latMin, latMax, lngMin, lngMax } = KOREA_MAP_BOUNDS;
  const nx = (lng - lngMin) / (lngMax - lngMin);
  const ny = (latMax - lat) / (latMax - latMin);
  const span = 100 - padPct * 2;
  return {
    x: padPct + nx * span,
    y: padPct + ny * span,
  };
}

export function isInKoreaPlotBounds(lat: number, lng: number): boolean {
  const { latMin, latMax, lngMin, lngMax } = KOREA_MAP_BOUNDS;
  return lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax;
}
