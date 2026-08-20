import polygonClipping from "polygon-clipping";
import type { MultiPolygon, Polygon } from "polygon-clipping";

import {
  barnPlanRingFromCoords,
  dropClosedRingDuplicate,
  ringAreaM2,
  type BarnPlanLatLng,
} from "@/lib/farm/barn-plan-boundary";

/** 건물과 겹치는 면적이 이 값 이상이면 부지 필지. */
const CADASTRAL_SEED_OVERLAP_M2 = 80;
/** 맞닿은 빈 구획은 이 면적 이하만 붙인다. */
const CADASTRAL_FILLER_MAX_AREA_M2 = 800;
/** 한 변만 닿는 이웃은 제외. 두 변 이상 맞닿아야 같은 부지로 본다. */
const CADASTRAL_FILLER_MIN_SHARED_EDGES = 2;

function toPolygon(ring: BarnPlanLatLng[]): Polygon | null {
  const pts = dropClosedRingDuplicate(ring);
  if (pts.length < 3) return null;
  const coords: [number, number][] = pts.map((p) => [p.lng, p.lat]);
  const first = coords[0]!;
  coords.push([first[0], first[1]]);
  return [coords];
}

function pairsToRing(ring: [number, number][]): BarnPlanLatLng[] {
  return dropClosedRingDuplicate(
    ring.map(([lng, lat]) => ({ lat, lng })),
  ).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

function multiPolygonAreaM2(mp: MultiPolygon): number {
  let sum = 0;
  for (const poly of mp) {
    const outer = poly[0];
    if (!outer) continue;
    sum += ringAreaM2(pairsToRing(outer));
    for (let i = 1; i < poly.length; i += 1) {
      const hole = poly[i];
      if (!hole) continue;
      sum -= ringAreaM2(pairsToRing(hole));
    }
  }
  return Math.max(0, sum);
}

function unionMulti(rings: BarnPlanLatLng[][]): MultiPolygon | null {
  const polys = rings
    .map((ring) => toPolygon(ring))
    .filter((poly): poly is Polygon => Boolean(poly));
  if (polys.length === 0) return null;
  if (polys.length === 1) return [polys[0]!];
  try {
    return polygonClipping.union(polys[0]!, ...polys.slice(1));
  } catch {
    return null;
  }
}

function largestOuterRing(mp: MultiPolygon): BarnPlanLatLng[] | null {
  let best: BarnPlanLatLng[] | null = null;
  let bestArea = -1;
  for (const poly of mp) {
    const outer = poly[0];
    if (!outer) continue;
    const ring = pairsToRing(outer);
    const fitted = barnPlanRingFromCoords(ring);
    if (!fitted) continue;
    const area = ringAreaM2(fitted);
    if (area > bestArea) {
      best = fitted;
      bestArea = area;
    }
  }
  return best;
}

/** 맞닿은 변 개수(방향 무시, 좌표 6자리). */
export function sharedUndirectedEdgeCount(
  a: BarnPlanLatLng[],
  b: BarnPlanLatLng[],
): number {
  const keyOf = (p: BarnPlanLatLng, q: BarnPlanLatLng) => {
    const ka = `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;
    const kb = `${q.lng.toFixed(6)},${q.lat.toFixed(6)}`;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  const edges = new Set<string>();
  const aPts = dropClosedRingDuplicate(a);
  for (let i = 0; i < aPts.length; i += 1) {
    const p = aPts[i]!;
    const q = aPts[(i + 1) % aPts.length]!;
    if (p.lat === q.lat && p.lng === q.lng) continue;
    edges.add(keyOf(p, q));
  }
  let n = 0;
  const bPts = dropClosedRingDuplicate(b);
  const seen = new Set<string>();
  for (let i = 0; i < bPts.length; i += 1) {
    const p = bPts[i]!;
    const q = bPts[(i + 1) % bPts.length]!;
    if (p.lat === q.lat && p.lng === q.lng) continue;
    const key = keyOf(p, q);
    if (seen.has(key)) continue;
    seen.add(key);
    if (edges.has(key)) n += 1;
  }
  return n;
}

/** 같은 주소 건물이 걸친 필지 + 두 변 이상 맞닿은 작은 구획. */
export function pickCadastralSiteRings(
  lots: BarnPlanLatLng[][],
  buildings: BarnPlanLatLng[][],
): BarnPlanLatLng[][] {
  if (lots.length === 0 || buildings.length === 0) return [];
  const bldUnion = unionMulti(buildings);
  if (!bldUnion || bldUnion.length === 0) return [];

  const seedIdx: number[] = [];
  for (let i = 0; i < lots.length; i += 1) {
    const poly = toPolygon(lots[i]!);
    if (!poly) continue;
    let overlap = 0;
    try {
      overlap = multiPolygonAreaM2(polygonClipping.intersection(poly, bldUnion));
    } catch {
      overlap = 0;
    }
    if (overlap >= CADASTRAL_SEED_OVERLAP_M2) seedIdx.push(i);
  }
  if (seedIdx.length === 0) return [];

  const selected = new Set(seedIdx);
  for (let i = 0; i < lots.length; i += 1) {
    if (selected.has(i)) continue;
    const lot = lots[i]!;
    const area = ringAreaM2(lot);
    if (area <= 0 || area > CADASTRAL_FILLER_MAX_AREA_M2) continue;
    let shared = 0;
    for (const s of seedIdx) {
      shared += sharedUndirectedEdgeCount(lot, lots[s]!);
    }
    if (shared >= CADASTRAL_FILLER_MIN_SHARED_EDGES) selected.add(i);
  }
  return [...selected].sort((a, b) => a - b).map((i) => lots[i]!);
}

/** 필지 다각형을 합쳐 바깥 테두리. */
export function unionBarnPlanRings(
  rings: BarnPlanLatLng[][],
): BarnPlanLatLng[] | null {
  if (rings.length === 0) return null;
  if (rings.length === 1) return barnPlanRingFromCoords(rings[0]!);
  const united = unionMulti(rings);
  if (!united || united.length === 0) return null;
  return largestOuterRing(united);
}
