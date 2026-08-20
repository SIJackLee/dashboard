import "server-only";

import {
  KOREA_REGIONS,
  matchSidoPrefix,
} from "@/lib/geo/korea-regions";
import { isValidMapCoord } from "@/lib/geo/map-coords";
import {
  attemptPrecision,
  geocodeQueryFallbacks,
  isStreetLevelAddress,
  kakaoAddressQueries,
  normalizeGeocodeQuery,
} from "@/lib/geo/geocode-query";

export type GeocodeFarmAddressResult =
  | {
      ok: true;
      lat: number;
      lng: number;
      addressText: string;
      sido: string;
      sigungu: string;
      addressDetail: string | null;
      geocodeSource: "geocode_api" | "region_lookup_fallback" | "nominatim";
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
  return normalizeGeocodeQuery(query);
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

type KakaoKeywordDocument = {
  x?: string;
  y?: string;
  address_name?: string;
  road_address_name?: string;
};

function kakaoAuthHeaders(): HeadersInit | null {
  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) return null;
  return { Authorization: `KakaoAK ${apiKey}` };
}

async function geocodeViaKakaoAddressOnce(
  query: string,
  headers: HeadersInit,
): Promise<GeocodeFarmAddressResult | null> {
  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", query);
  url.searchParams.set("analyze_type", "similar");

  const res = await fetch(url.toString(), {
    headers,
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

async function geocodeViaKakaoAddress(
  query: string,
): Promise<GeocodeFarmAddressResult | null> {
  const headers = kakaoAuthHeaders();
  if (!headers) return null;
  for (const attempt of kakaoAddressQueries(query)) {
    const hit = await geocodeViaKakaoAddressOnce(attempt, headers);
    if (hit) return hit;
  }
  return null;
}

async function geocodeViaKakaoKeyword(
  query: string,
): Promise<GeocodeFarmAddressResult | null> {
  const headers = kakaoAuthHeaders();
  if (!headers) return null;

  for (const attempt of kakaoAddressQueries(query)) {
    const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
    url.searchParams.set("query", attempt);
    url.searchParams.set("size", "1");

    const res = await fetch(url.toString(), {
      headers,
      next: { revalidate: 0 },
    });
    if (!res.ok) continue;

    const body = (await res.json()) as { documents?: KakaoKeywordDocument[] };
    const doc = body.documents?.[0];
    if (!doc) continue;

    const lng = Number(doc.x);
    const lat = Number(doc.y);
    if (!isValidMapCoord(lat, lng)) continue;

    const addressText =
      doc.road_address_name?.trim() ||
      doc.address_name?.trim() ||
      attempt;
    const catalog =
      geocodeFromRegionCatalog(addressText) ??
      geocodeFromRegionCatalog(query);
    if (!catalog?.ok) continue;

    return {
      ok: true,
      lat,
      lng,
      addressText,
      sido: catalog.sido,
      sigungu: catalog.sigungu,
      addressDetail: catalog.addressDetail,
      geocodeSource: "geocode_api",
    };
  }
  return null;
}

async function geocodeViaKakao(query: string): Promise<GeocodeFarmAddressResult | null> {
  const fromAddress = await geocodeViaKakaoAddress(query);
  if (fromAddress) return fromAddress;
  const catalog = geocodeFromRegionCatalog(query);
  if (catalog?.ok && !catalog.addressDetail) return null;
  return geocodeViaKakaoKeyword(query);
}

async function geocodeViaNominatim(
  query: string,
): Promise<GeocodeFarmAddressResult | null> {
  const wantStreet = isStreetLevelAddress(query);
  for (const attempt of geocodeQueryFallbacks(query)) {
    if (wantStreet && attemptPrecision(attempt) !== "street") continue;

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", attempt);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "kr");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "SungilDashboard/1.0 (farm-plan geocode)",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) continue;

    const body = (await res.json()) as Array<{
      lat?: string;
      lon?: string;
    }>;
    const hit = body[0];
    if (!hit) continue;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!isValidMapCoord(lat, lng)) continue;

    const catalog = geocodeFromRegionCatalog(query);
    return {
      ok: true,
      lat,
      lng,
      addressText: query,
      sido: catalog && catalog.ok ? catalog.sido : "",
      sigungu: catalog && catalog.ok ? catalog.sigungu : "",
      addressDetail: catalog && catalog.ok ? catalog.addressDetail : null,
      geocodeSource: "nominatim",
    };
  }
  return null;
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

  try {
    const nominatim = await geocodeViaNominatim(normalized);
    if (nominatim?.ok) return nominatim;
  } catch {
    /* catalog last */
  }

  const catalog = geocodeFromRegionCatalog(normalized);
  if (catalog?.ok && !catalog.addressDetail) return catalog;

  return { ok: false, error: "geocode_not_found" };
}
