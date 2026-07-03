import "server-only";

import {
  KOREA_REGIONS,
  matchSidoPrefix,
} from "@/lib/geo/korea-regions";
import { isValidMapCoord } from "@/lib/geo/map-coords";

export type GeocodeFarmAddressResult =
  | {
      ok: true;
      lat: number;
      lng: number;
      addressText: string;
      sido: string;
      sigungu: string;
      addressDetail: string | null;
      geocodeSource: "geocode_api" | "region_lookup_fallback";
    }
  | { ok: false; error: string };

type KakaoAddressDocument = {
  address_name?: string;
  x?: string;
  y?: string;
  region_1depth_name?: string;
  region_2depth_name?: string;
  region_3depth_name?: string;
  address?: {
    address_name?: string;
    region_1depth_name?: string;
    region_2depth_name?: string;
    region_3depth_name?: string;
  };
  road_address?: {
    address_name?: string;
    region_1depth_name?: string;
    region_2depth_name?: string;
    region_3depth_name?: string;
  };
};

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

/**
 * Kakao 미사용 시 시·군·구 catalog centroid 매칭.
 * 도로명·지번 상세는 addressDetail로 보존, 좌표는 sigungu 중심.
 */
function geocodeFromRegionCatalog(query: string): GeocodeFarmAddressResult | null {
  const trimmed = normalizeQuery(query);
  if (!trimmed) return null;

  const matched = matchSidoPrefix(trimmed);
  if (!matched) return null;

  const { sido, rest } = matched;
  const regions = KOREA_REGIONS.filter((r) => r.sido === sido);
  const byLength = [...regions].sort(
    (a, b) => b.sigungu.length - a.sigungu.length
  );

  for (const region of byLength) {
    if (!rest.startsWith(region.sigungu)) continue;
    const detail = rest.slice(region.sigungu.length).trim() || null;
    return {
      ok: true,
      lat: region.lat,
      lng: region.lng,
      addressText: trimmed,
      sido,
      sigungu: region.sigungu,
      addressDetail: detail,
      geocodeSource: "region_lookup_fallback",
    };
  }

  return null;
}

async function geocodeViaKakao(query: string): Promise<GeocodeFarmAddressResult | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) return null;

  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", query);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${apiKey}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) return null;

  const body = (await res.json()) as {
    documents?: KakaoAddressDocument[];
  };
  const doc = body.documents?.[0];
  if (!doc) return null;

  const lng = Number(doc.x);
  const lat = Number(doc.y);
  if (!isValidMapCoord(lat, lng)) return null;

  const addr = doc.road_address ?? doc.address;
  const sido =
    addr?.region_1depth_name?.trim() ||
    doc.region_1depth_name?.trim() ||
    "";
  const sigungu =
    addr?.region_2depth_name?.trim() ||
    doc.region_2depth_name?.trim() ||
    "";
  const addressText =
    doc.address_name?.trim() ||
    addr?.address_name?.trim() ||
    query;
  const region3 =
    addr?.region_3depth_name?.trim() ||
    doc.region_3depth_name?.trim() ||
    null;

  if (!sido || !sigungu) return null;

  return {
    ok: true,
    lat,
    lng,
    addressText,
    sido,
    sigungu,
    addressDetail: region3,
    geocodeSource: "geocode_api",
  };
}

export async function geocodeFarmAddress(
  query: string
): Promise<GeocodeFarmAddressResult> {
  const normalized = normalizeQuery(query);
  if (normalized.length < 4) {
    return { ok: false, error: "address_too_short" };
  }

  try {
    const kakao = await geocodeViaKakao(normalized);
    if (kakao?.ok) return kakao;
  } catch {
    /* fallback below */
  }

  const catalog = geocodeFromRegionCatalog(normalized);
  if (catalog?.ok) return catalog;

  return { ok: false, error: "geocode_not_found" };
}
