import { filterBarnLayoutPrefsForFarm } from "@/lib/data/barn-map";
import type { BarnLayoutPrefs } from "@/lib/data/barn-meta";
import { parseFarmKeyFromQuery, type FarmKey } from "@/lib/data/farm-key";

/** Admin 전국 허브 — 지도·목록·우측 패널 단계 */
export type HubViewPhase = "overview" | "region" | "farm" | "drill";

/** 클라이언트 전달용 barn layout (서버 getBarnLayoutPrefs 결과) */
export type HubBarnLayoutPrefs = {
  layouts: Record<string, { col: number; row: number }>;
  aliases: Record<string, string>;
};

export function hubPhaseFromSido(activeSido: string | null): HubViewPhase {
  return activeSido ? "region" : "overview";
}

/** 데스크톱 3열 — 지역·농장 선택 후 좌측 지도를 미니맵으로 축소 */
export function shouldHubMapMini(
  phase: HubViewPhase,
  isDesktopGrid: boolean
): boolean {
  if (isDesktopGrid) {
    return phase === "region" || phase === "farm" || phase === "drill";
  }
  /** 모바일 — region 필터 시에만 지도 높이 축소 (farm 단계는 top=그리드) */
  return phase === "region";
}

/** 농장 선택 후 farmer형 지도 (데스크톱 우측 / 모바일 top) */
export function shouldHubShowFarmGrid(
  hubFarmId: string | null,
  controllerKey: string
): boolean {
  return Boolean(hubFarmId) && !controllerKey;
}

export function shortSidoDisplay(sido: string): string {
  return sido.replace(/특별자치도|특별자치시|광역시|도$/g, "");
}

/** drill scope — overview 복원 시 stale URL farmId 무시 */
export function effectiveHubFarmId(
  hubFarmId: string | null,
  hubPhase: HubViewPhase,
  urlFarmId: string | undefined,
): string | null {
  if (hubFarmId) return hubFarmId;
  if (hubPhase === "overview") return null;
  return urlFarmId ?? null;
}

/** URL이 farm grid 전용( ctrl/sp/stall 없음)인지 */
export function isGeoHubFarmGridUrl(
  geoHubMode: boolean,
  urlFarmId: string | undefined,
  urlCtrl: string | null | undefined,
  urlSp?: string | null | undefined,
  urlStall?: string | null | undefined
): boolean {
  if (!geoHubMode || !urlFarmId) return false;
  if (urlCtrl) return false;
  if (urlSp) return false;
  if (urlStall) return false;
  return true;
}

/** 데스크톱 mapMini — 목록을 미니맵 하단으로 스택 (2열 그리드) */
export function shouldHubStackListUnderMap(
  mapMini: boolean,
  isDesktopGrid: boolean
): boolean {
  return isDesktopGrid && mapMini;
}

/** buildAutoBarnMap — 선택 farm catalog/layout만 사용 */
export function filterLayoutPrefsForFarm(
  prefs: HubBarnLayoutPrefs,
  farmId: string
): HubBarnLayoutPrefs {
  const farmKey = parseFarmKeyFromFarmId(farmId);
  if (!farmKey) return { layouts: {}, aliases: {} };
  const scoped = filterBarnLayoutPrefsForFarm(
    { ...prefs, legacyBarns: [] } satisfies BarnLayoutPrefs,
    farmKey
  );
  return { layouts: scoped.layouts, aliases: scoped.aliases };
}

function parseFarmKeyFromFarmId(farmId: string): FarmKey | null {
  const slash = farmId.indexOf("/");
  if (slash > 0) {
    return parseFarmKeyFromQuery(
      farmId.slice(0, slash),
      farmId.slice(slash + 1)
    );
  }
  return parseFarmKeyFromQuery(farmId, "P00");
}
