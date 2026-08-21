/** 연속지적 PNU 19자리. UI·응답에 노출하지 않음. */

export type CadastralJibun = {
  bCode: string;
  mountainYn?: string | null;
  mainNo: string;
  subNo?: string | null;
};

/** 브이월드 geomFilter. `BOX(minx,miny,maxx,maxy)` — 사이 공백 없이 쉼표. */
export function vworldLonLatBox(
  lng: number,
  lat: number,
  deltaDeg: number,
): string {
  return `BOX(${lng - deltaDeg},${lat - deltaDeg},${lng + deltaDeg},${lat + deltaDeg})`;
}

/** 브이월드 인증키에 등록된 도메인. 운영 URL이 아직 미등록이면 localhost를 이어서 시도. */
export function vworldDomainCandidates(env?: {
  siteUrl?: string | null;
  vworldDomain?: string | null;
}): string[] {
  const listed = [
    env?.vworldDomain ?? process.env.VWORLD_DOMAIN,
    env?.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL,
    "https://smart.autofankorea.com",
    "http://localhost:3000",
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of listed) {
    const domain = raw?.trim().replace(/\/$/, "") ?? "";
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    out.push(domain);
  }
  return out;
}

/** 도로·하천 필지는 부지 참고선에서 제외. */
export function isCadastralSiteNeighbor(jibun: string): boolean {
  const compact = jibun.replace(/\s+/g, "");
  return compact.length > 0 && !/[천도]$/.test(compact);
}

/** 지도에 보이는 짧은 구획 이름. 예: 588-41답 → 41답. */
export function cadastralLotLabel(jibun: string): string {
  const compact = jibun.replace(/\s+/g, "");
  const m = compact.match(/-(\d+[가-힣]+)$/);
  return m?.[1] ?? compact;
}

export function cadastralPnu(jibun: CadastralJibun): string | null {
  const bCode = jibun.bCode.replace(/\D/g, "");
  if (bCode.length !== 10) return null;
  const main = Number(jibun.mainNo);
  const sub = Number(jibun.subNo?.trim() ? jibun.subNo : "0");
  if (!Number.isInteger(main) || main < 0 || main > 9999) return null;
  if (!Number.isInteger(sub) || sub < 0 || sub > 9999) return null;
  const land = jibun.mountainYn?.toUpperCase() === "Y" ? "2" : "1";
  return `${bCode}${land}${String(main).padStart(4, "0")}${String(sub).padStart(4, "0")}`;
}
