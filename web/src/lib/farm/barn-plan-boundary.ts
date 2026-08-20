import concaveman from "concaveman";

import { isValidMapCoord } from "@/lib/geo/map-coords";

export type BarnPlanLatLng = { lat: number; lng: number };

export type BarnPlanLot = {
  id: string;
  ring: BarnPlanLatLng[];
  label: string;
};

export const BARN_PLAN_SITE_VERSION = 2;
export const BARN_PLAN_BOUNDARY_MIN = 3;
export const BARN_PLAN_BOUNDARY_MAX = 48;

const EARTH_R_M = 6371000;

export function barnPlanSiteStorageKey(farmId: string): string {
  return `sungil.barn-plan.site.v2:${farmId}`;
}

export function parseBarnPlanLatLng(raw: unknown): BarnPlanLatLng | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { lat?: unknown; lng?: unknown };
  const lat = Number(o.lat);
  const lng = Number(o.lng);
  if (!isValidMapCoord(lat, lng)) return null;
  return { lat, lng };
}

function sameBarnPlanPoint(a: BarnPlanLatLng, b: BarnPlanLatLng): boolean {
  return a.lat === b.lat && a.lng === b.lng;
}

/** GeoJSON 링의 닫는 중복점 제거. */
export function dropClosedRingDuplicate(
  points: BarnPlanLatLng[],
): BarnPlanLatLng[] {
  if (points.length < 2) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (sameBarnPlanPoint(first, last)) return points.slice(0, -1);
  return points;
}

function perpDist(
  p: BarnPlanLatLng,
  a: BarnPlanLatLng,
  b: BarnPlanLatLng,
): number {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) {
    const x = p.lng - a.lng;
    const y = p.lat - a.lat;
    return Math.hypot(x, y);
  }
  const t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy);
  const u = Math.max(0, Math.min(1, t));
  return Math.hypot(p.lng - (a.lng + u * dx), p.lat - (a.lat + u * dy));
}

function simplifyDp(
  points: BarnPlanLatLng[],
  epsilon: number,
): BarnPlanLatLng[] {
  if (points.length <= 2) return points;
  let peak = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i += 1) {
    const d = perpDist(points[i]!, points[0]!, points[end]!);
    if (d > peak) {
      peak = d;
      index = i;
    }
  }
  if (peak <= epsilon) return [points[0]!, points[end]!];
  const left = simplifyDp(points.slice(0, index + 1), epsilon);
  const right = simplifyDp(points.slice(index), epsilon);
  return [...left.slice(0, -1), ...right];
}

/** 꼭짓점 상한에 맞게 필지 링을 줄인다. */
export function simplifyBarnPlanRing(
  points: BarnPlanLatLng[],
  maxVertices = BARN_PLAN_BOUNDARY_MAX,
): BarnPlanLatLng[] {
  const ring = dropClosedRingDuplicate(points);
  if (ring.length <= maxVertices) return ring;
  let epsilon = 1e-6;
  let simplified = ring;
  while (simplified.length > maxVertices && epsilon < 0.05) {
    simplified = dropClosedRingDuplicate(simplifyDp(ring, epsilon));
    epsilon *= 1.8;
  }
  if (simplified.length <= maxVertices) return simplified;
  const out: BarnPlanLatLng[] = [];
  const last = Math.max(1, maxVertices - 1);
  for (let i = 0; i < last; i += 1) {
    const idx = Math.round((i * (simplified.length - 1)) / last);
    const p = simplified[idx]!;
    if (out.length === 0 || !sameBarnPlanPoint(out[out.length - 1]!, p)) {
      out.push(p);
    }
  }
  const tail = simplified[simplified.length - 1]!;
  if (!sameBarnPlanPoint(out[out.length - 1]!, tail)) out.push(tail);
  return out;
}

export function parseBarnPlanBoundary(raw: unknown): BarnPlanLatLng[] | null {
  if (!Array.isArray(raw)) return null;
  const points: BarnPlanLatLng[] = [];
  for (const row of raw) {
    const p = parseBarnPlanLatLng(row);
    if (!p) continue;
    points.push(p);
    if (points.length >= BARN_PLAN_BOUNDARY_MAX) break;
  }
  if (points.length < BARN_PLAN_BOUNDARY_MIN) return null;
  return points;
}

/** 지적·건물 다각형 → 평면 경계. */
export function barnPlanRingFromCoords(
  coords: BarnPlanLatLng[],
): BarnPlanLatLng[] | null {
  const ring = simplifyBarnPlanRing(coords);
  if (ring.length < BARN_PLAN_BOUNDARY_MIN) return null;
  return ring.slice(0, BARN_PLAN_BOUNDARY_MAX);
}

function hullCross(
  o: BarnPlanLatLng,
  a: BarnPlanLatLng,
  b: BarnPlanLatLng,
): number {
  return (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
}

function uniqueBarnPlanPoints(points: BarnPlanLatLng[]): BarnPlanLatLng[] {
  const uniq: BarnPlanLatLng[] = [];
  const seen = new Set<string>();
  for (const p of points) {
    const key = `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(p);
  }
  return uniq;
}

/** 같은 주소의 여러 동을 한 구역으로 묶을 때 사용. */
export function convexBarnPlanRing(
  points: BarnPlanLatLng[],
): BarnPlanLatLng[] | null {
  const uniq = uniqueBarnPlanPoints(points);
  uniq.sort((a, b) => a.lng - b.lng || a.lat - b.lat);
  if (uniq.length < BARN_PLAN_BOUNDARY_MIN) return barnPlanRingFromCoords(uniq);
  const lower: BarnPlanLatLng[] = [];
  for (const p of uniq) {
    while (
      lower.length >= 2 &&
      hullCross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: BarnPlanLatLng[] = [];
  for (let i = uniq.length - 1; i >= 0; i -= 1) {
    const p = uniq[i]!;
    while (
      upper.length >= 2 &&
      hullCross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return barnPlanRingFromCoords([...lower, ...upper]);
}

/** ~25m. 건물 사이 작은 틈은 메우고, 큰 빈 땅은 오목하게 남긴다. */
const CONCAVE_LENGTH_THRESHOLD_DEG = 0.00022;
const CONCAVE_DETAIL = 1.4;

/** 같은 번지 여러 동의 외곽. 실패하면 볼록 껍질. */
export function concaveBarnPlanRing(
  points: BarnPlanLatLng[],
): BarnPlanLatLng[] | null {
  const uniq = uniqueBarnPlanPoints(points);
  if (uniq.length < BARN_PLAN_BOUNDARY_MIN) return barnPlanRingFromCoords(uniq);
  try {
    const hull = concaveman(
      uniq.map((p) => [p.lng, p.lat]),
      CONCAVE_DETAIL,
      CONCAVE_LENGTH_THRESHOLD_DEG,
    );
    const ring = dropClosedRingDuplicate(
      hull.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) })),
    ).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const fitted = barnPlanRingFromCoords(ring);
    if (fitted && fitted.length >= BARN_PLAN_BOUNDARY_MIN) return fitted;
  } catch {
    /* concaveman edge cases */
  }
  return convexBarnPlanRing(uniq);
}

/** 구면 근사 면적(m²). 폐합 링. */
export function ringAreaM2(points: BarnPlanLatLng[]): number {
  if (points.length < BARN_PLAN_BOUNDARY_MIN) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    sum += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs(sum) * (EARTH_R_M * EARTH_R_M) / 2;
}

export function barnPlanRingCentroid(
  points: BarnPlanLatLng[],
): BarnPlanLatLng | null {
  const ring = dropClosedRingDuplicate(points);
  if (ring.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const p of ring) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / ring.length, lng: lng / ring.length };
}

export function pointInBarnPlanRing(
  point: BarnPlanLatLng,
  ring: BarnPlanLatLng[],
): boolean {
  const pts = dropClosedRingDuplicate(ring);
  if (pts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    const hit =
      a.lat > point.lat !== b.lat > point.lat &&
      point.lng <
        ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (hit) inside = !inside;
  }
  return inside;
}

export function formatSiteAreaKo(points: BarnPlanLatLng[]): string {
  const m2 = ringAreaM2(points);
  if (m2 >= 10_000) {
    const ha = m2 / 10_000;
    const digits = ha >= 10 ? 1 : 2;
    return `${ha.toFixed(digits)} ha`;
  }
  if (m2 >= 100) return `${Math.round(m2).toLocaleString("ko-KR")} m²`;
  return `${Math.max(0, Math.round(m2))} m²`;
}

export type BarnPlanSitePrefs = {
  v: typeof BARN_PLAN_SITE_VERSION;
  boundary: BarnPlanLatLng[] | null;
};

export function emptyBarnPlanSitePrefs(): BarnPlanSitePrefs {
  return { v: BARN_PLAN_SITE_VERSION, boundary: null };
}

export function parseBarnPlanSitePrefs(raw: unknown): BarnPlanSitePrefs {
  if (!raw || typeof raw !== "object") return emptyBarnPlanSitePrefs();
  const o = raw as { v?: unknown; boundary?: unknown };
  return {
    v: BARN_PLAN_SITE_VERSION,
    boundary: parseBarnPlanBoundary(o.boundary),
  };
}

export function loadBarnPlanSitePrefs(farmId: string): BarnPlanSitePrefs {
  if (!farmId || typeof window === "undefined") return emptyBarnPlanSitePrefs();
  try {
    const raw = window.localStorage.getItem(barnPlanSiteStorageKey(farmId)) ?? "";
    if (!raw) return emptyBarnPlanSitePrefs();
    return parseBarnPlanSitePrefs(JSON.parse(raw) as unknown);
  } catch {
    return emptyBarnPlanSitePrefs();
  }
}

export function saveBarnPlanSitePrefs(
  farmId: string,
  site: BarnPlanSitePrefs,
): void {
  if (!farmId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      barnPlanSiteStorageKey(farmId),
      JSON.stringify(parseBarnPlanSitePrefs(site)),
    );
  } catch {
    /* quota */
  }
}
