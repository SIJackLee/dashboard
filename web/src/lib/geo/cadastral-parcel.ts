import "server-only";

import { dropClosedRingDuplicate, type BarnPlanLatLng, type BarnPlanLot } from "@/lib/farm/barn-plan-boundary";
import { cadastralLotLabel, isCadastralSiteNeighbor, vworldDomainCandidates, vworldLonLatBox } from "@/lib/geo/cadastral-pnu";
import { isValidMapCoord } from "@/lib/geo/map-coords";

export type CadastralLot = BarnPlanLot;

export type CadastralBoundaryResult =
  | { ok: true; lots: CadastralLot[] }
  | { ok: false; error: "parcel_unavailable" | "parcel_not_found" };

type VworldFeature = {
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: {
    pnu?: string;
    jibun?: string;
  };
};

const CADASTRAL_DATA = "LP_PA_CBND_BUBUN";
const LOT_BOX_DEG = 0.002;

function vworldKey(): string | null {
  return process.env.VWORLD_API_KEY?.trim() || null;
}

type VworldGetResult =
  | { ok: true; features: VworldFeature[] }
  | { ok: false };

async function vworldGetFeatures(params: {
  key: string;
  domain: string;
  data: string;
  extra: Record<string, string>;
  size: string;
}): Promise<VworldGetResult> {
  const url = new URL("https://api.vworld.kr/req/data");
  url.searchParams.set("service", "data");
  url.searchParams.set("version", "2.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("format", "json");
  url.searchParams.set("size", params.size);
  url.searchParams.set("page", "1");
  url.searchParams.set("geometry", "true");
  url.searchParams.set("attribute", "true");
  url.searchParams.set("crs", "EPSG:4326");
  url.searchParams.set("data", params.data);
  url.searchParams.set("key", params.key);
  url.searchParams.set("domain", params.domain);
  for (const [k, v] of Object.entries(params.extra)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Referer: params.domain, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return { ok: false };
  const body = (await res.json()) as {
    response?: {
      status?: string;
      result?: { featureCollection?: { features?: VworldFeature[] } };
    };
  };
  if (body.response?.status !== "OK") return { ok: false };
  return {
    ok: true,
    features: body.response.result?.featureCollection?.features ?? [],
  };
}

function lotsFromFeatures(features: VworldFeature[]): CadastralLot[] {
  const lots: CadastralLot[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    const jibun = feature.properties?.jibun ?? "";
    if (!isCadastralSiteNeighbor(jibun)) continue;
    const ring = rawRingFromGeometry(feature.geometry);
    if (!ring) continue;
    const id =
      feature.properties?.pnu?.trim() ||
      `${ring[0]!.lat.toFixed(7)},${ring[0]!.lng.toFixed(7)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    lots.push({
      id,
      ring,
      label: cadastralLotLabel(jibun),
    });
  }
  return lots;
}

export async function lookupCadastralBoundary(
  lat: number,
  lng: number,
): Promise<CadastralBoundaryResult> {
  if (!isValidMapCoord(lat, lng)) {
    return { ok: false, error: "parcel_not_found" };
  }
  const key = vworldKey();
  if (!key) {
    return { ok: false, error: "parcel_unavailable" };
  }

  const box = vworldLonLatBox(lng, lat, LOT_BOX_DEG);
  try {
    for (const domain of vworldDomainCandidates()) {
      const got = await vworldGetFeatures({
        key,
        domain,
        data: CADASTRAL_DATA,
        size: "100",
        extra: { geomFilter: box },
      });
      if (!got.ok) continue;
      const lots = lotsFromFeatures(got.features);
      if (lots.length === 0) return { ok: false, error: "parcel_not_found" };
      return { ok: true, lots };
    }
    return { ok: false, error: "parcel_not_found" };
  } catch {
    return { ok: false, error: "parcel_not_found" };
  }
}

function asLngLatPair(raw: unknown): BarnPlanLatLng | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const lng = Number(raw[0]);
  const lat = Number(raw[1]);
  if (!isValidMapCoord(lat, lng)) return null;
  return { lat, lng };
}

function rawRingFromCoordsArray(raw: unknown): BarnPlanLatLng[] | null {
  if (!Array.isArray(raw)) return null;
  const points: BarnPlanLatLng[] = [];
  for (const row of raw) {
    const p = asLngLatPair(row);
    if (!p) continue;
    const prev = points[points.length - 1];
    if (prev && prev.lat === p.lat && prev.lng === p.lng) continue;
    points.push(p);
  }
  const ring = dropClosedRingDuplicate(points);
  return ring.length >= 3 ? ring : null;
}

function rawRingFromGeometry(
  geometry: VworldFeature["geometry"],
): BarnPlanLatLng[] | null {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  const type = geometry.type ?? "";
  if (type === "Polygon") {
    return rawRingFromCoordsArray(geometry.coordinates[0]);
  }
  if (type === "MultiPolygon") {
    let best: BarnPlanLatLng[] | null = null;
    for (const poly of geometry.coordinates) {
      if (!Array.isArray(poly)) continue;
      const ring = rawRingFromCoordsArray(poly[0]);
      if (!ring) continue;
      if (!best || ring.length > best.length) best = ring;
    }
    return best;
  }
  return null;
}
