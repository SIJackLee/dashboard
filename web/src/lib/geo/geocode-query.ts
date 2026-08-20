export function normalizeGeocodeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export function isStreetLevelAddress(query: string): boolean {
  return /(?:로|길)\s*\d/.test(normalizeGeocodeQuery(query));
}

/** 도로명 실패 시 면·읍·동까지 줄여 검색 */
export function geocodeQueryFallbacks(query: string): string[] {
  const q = normalizeGeocodeQuery(query);
  const out: string[] = [];
  const add = (value: string) => {
    const next = normalizeGeocodeQuery(value);
    if (next.length >= 4 && !out.includes(next)) out.push(next);
  };
  add(q);
  add(q.replace(/\s+\d+(-\d+)?$/, ""));
  const myeon = q.match(/^(.+?(?:시|군|구)\s+\S+(?:읍|면|동))/);
  if (myeon) add(myeon[1]!);
  return out;
}

/** 카카오 주소검색 — 면 생략·시+도로명 번호 */
export function kakaoAddressQueries(query: string): string[] {
  const q = normalizeGeocodeQuery(query);
  const out: string[] = [];
  const add = (value: string) => {
    const next = normalizeGeocodeQuery(value);
    if (next.length >= 4 && !out.includes(next)) out.push(next);
  };
  add(q);
  add(q.replace(/(\S+(?:시|군|구))\s+\S+(?:읍|면|동)\s+/, "$1 "));
  const street = q.match(/(\S+(?:로|길)\s*\d+(?:-\d+)?)/);
  const city = q.match(/(\S+(?:시|군|구))/);
  if (street && city) add(`${city[1]} ${street[1]}`);
  if (street) add(street[1]!);
  return out;
}

export function attemptPrecision(
  attempt: string,
): "street" | "town" | "city" {
  const q = normalizeGeocodeQuery(attempt);
  if (isStreetLevelAddress(q)) return "street";
  if (/(?:읍|면|동)(?:\s|$)/.test(q)) return "town";
  return "city";
}

export function locationAddressQuery(loc: {
  addressText: string;
  sido: string;
  sigungu: string;
  addressDetail: string | null;
}): string {
  const composed = [loc.sido, loc.sigungu, loc.addressDetail]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  const text = loc.addressText.trim();
  return composed.length >= text.length ? composed : text;
}
