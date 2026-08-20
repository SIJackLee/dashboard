import {
  dropClosedRingDuplicate,
  ringAreaM2,
  type BarnPlanLatLng,
  type BarnPlanLot,
} from "@/lib/farm/barn-plan-boundary";

export const BARN_PLAN_FIELD_CELL_M = 1;
const EARTH_R_M = 6371000;
const PAD_M = 2;

export type BarnPlanMetricPt = { x: number; y: number };

export type BarnPlanField = {
  originLat: number;
  originLng: number;
  widthM: number;
  heightM: number;
  cellM: typeof BARN_PLAN_FIELD_CELL_M;
  ring: BarnPlanMetricPt[];
  areaM2: number;
};

export function metersPerDegree(lat: number): { lat: number; lng: number } {
  const latM = (Math.PI / 180) * EARTH_R_M;
  const lngM = latM * Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return { lat: latM, lng: lngM };
}

function metricRing(ring: BarnPlanLatLng[], origin: BarnPlanLatLng): BarnPlanMetricPt[] {
  const m = metersPerDegree(origin.lat);
  return dropClosedRingDuplicate(ring).map((p) => ({
    x: (p.lng - origin.lng) * m.lng,
    y: (p.lat - origin.lat) * m.lat,
  }));
}

function boundsOf(
  rings: BarnPlanLatLng[][],
): { minLat: number; minLng: number; maxLat: number; maxLng: number } | null {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      minLat = Math.min(minLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLat = Math.max(maxLat, p.lat);
      maxLng = Math.max(maxLng, p.lng);
    }
  }
  if (!Number.isFinite(minLat)) return null;
  return { minLat, minLng, maxLat, maxLng };
}

/** 고른 구획을 하나의 로컬 m 필드로 옮긴다. 지번·지목은 넣지 않는다. */
export function buildBarnPlanField(
  lots: BarnPlanLot[],
  areaRing: BarnPlanLatLng[] | null,
): BarnPlanField | null {
  if (lots.length === 0) return null;
  const outline =
    areaRing && areaRing.length >= 3 ? areaRing : lots[0]?.ring ?? null;
  if (!outline) return null;
  const box = boundsOf([outline, ...lots.map((lot) => lot.ring)]);
  if (!box) return null;

  const origin = { lat: box.minLat, lng: box.minLng };
  const raw = metricRing(outline, origin);
  if (raw.length < 3) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of raw) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  minX -= PAD_M;
  minY -= PAD_M;
  maxX += PAD_M;
  maxY += PAD_M;
  const widthM = Math.max(1, Math.ceil(maxX - minX));
  const heightM = Math.max(1, Math.ceil(maxY - minY));
  const m = metersPerDegree(origin.lat);

  return {
    originLat: origin.lat + minY / m.lat,
    originLng: origin.lng + minX / m.lng,
    widthM,
    heightM,
    cellM: BARN_PLAN_FIELD_CELL_M,
    ring: raw.map((p) => ({ x: p.x - minX, y: p.y - minY })),
    areaM2: ringAreaM2(outline),
  };
}

export type BarnPlanLatLngBox = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

/** 필드 사각형의 위경도. 남서 원점, y는 북. */
export function barnPlanFieldLatLngBox(
  field: Pick<BarnPlanField, "originLat" | "originLng" | "widthM" | "heightM">,
): BarnPlanLatLngBox {
  const m = metersPerDegree(field.originLat);
  return {
    minLat: field.originLat,
    minLng: field.originLng,
    maxLat: field.originLat + field.heightM / m.lat,
    maxLng: field.originLng + field.widthM / m.lng,
  };
}
