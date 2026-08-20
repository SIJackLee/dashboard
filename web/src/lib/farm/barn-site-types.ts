import { normalizeStallTyCode } from "@/lib/data/stall-type";
import type { BarnModelBanks } from "@/lib/farm/barn-model-dim";

/** 복도식 칸 수. FillCard 평면과 같은 모양. */
export type BarnSiteRoomPlan = {
  left: number;
  right: number;
  mid?: number;
};

/** 동 안 방 한 칸. bank=열(0부터), index=복도 방향 칸. */
export type BarnSiteRoomRef = {
  bank: number;
  index: number;
};

/**
 * 구역 — LIVE 축사유형 + 축사번호.
 * 한 건물에 여러 구역이 있을 수 있다.
 */
export type BarnSiteZone = {
  stallTyCode: string;
  stallNo: string;
  plan: BarnSiteRoomPlan;
  rooms?: BarnSiteRoomRef[];
};

export type BarnSiteFill = {
  banks: BarnModelBanks;
  roomCount: number;
  penAlongM: number;
  penDepthM: number;
  aisleWM: number;
};

/** 건물 — 현장의 한 덩어리. LIVE 평균을 내지 않는다. */
export type BarnSiteBuilding = {
  id: string;
  name?: string;
  x: number;
  z: number;
  rotDeg: number;
  zones: BarnSiteZone[];
  fill?: BarnSiteFill;
};

export const BARN_SITE_PREFS_VERSION = 1;

export type BarnSitePrefs = {
  v: typeof BARN_SITE_PREFS_VERSION;
  buildings: BarnSiteBuilding[];
};

export function emptyBarnSitePrefs(): BarnSitePrefs {
  return { v: BARN_SITE_PREFS_VERSION, buildings: [] };
}

export function barnSiteZoneKey(
  stallTyCode: string | null | undefined,
  stallNo: string | null | undefined,
): string | null {
  const ty = normalizeStallTyCode(stallTyCode);
  const raw = (stallNo ?? "").trim();
  if (!ty || ty === "UNK" || !raw) return null;
  const n = Number(raw);
  const no = Number.isFinite(n) ? String(n) : raw;
  return `${ty}#${no}`;
}

export function barnSiteRoomKey(bank: number, index: number): string {
  return `${bank}:${index}`;
}

export function zoneKeyOf(zone: Pick<BarnSiteZone, "stallTyCode" | "stallNo">): string | null {
  return barnSiteZoneKey(zone.stallTyCode, zone.stallNo);
}

export function defaultBarnSiteRoomPlan(): BarnSiteRoomPlan {
  return { left: 1, right: 1 };
}

const DEFAULT_TYPE_PLAN: Record<string, BarnSiteRoomPlan> = {
  SP02: { left: 8, right: 8 },
  SP03: { left: 3, right: 3 },
  SP05: { left: 3, right: 3 },
  SP06: { left: 3, right: 3 },
  SP07: { left: 4, right: 4 },
};

/** 유형 표준 열·칸. FillCard와 같은 복도식. */
export function defaultBarnSiteRoomPlanForType(
  stallTyCode: string,
): BarnSiteRoomPlan {
  return (
    DEFAULT_TYPE_PLAN[normalizeStallTyCode(stallTyCode)] ?? { left: 3, right: 3 }
  );
}
