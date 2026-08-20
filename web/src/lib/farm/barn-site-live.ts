import type { BarnReading } from "@/lib/data/iot";
import {
  compareStallNo,
  stallKeyFromReading,
} from "@/lib/data/reading-hierarchy";
import {
  normalizeStallTyCode,
  stallTyCodeSortKey,
} from "@/lib/data/stall-type";
import {
  barnSiteZoneKey,
  type BarnSitePrefs,
  type BarnSiteZone,
} from "@/lib/farm/barn-site-types";
import { zonesForBuilding } from "@/lib/farm/barn-site-prefs";

export type LiveZoneRef = {
  stallTyCode: string;
  stallNo: string;
};

/** LIVE 축사유형+축사번호. 미지정 번호는 제외. */
export function listLiveZones(
  readings: Pick<BarnReading, "stallTyCode" | "stallNo">[],
): LiveZoneRef[] {
  const seen = new Set<string>();
  const out: LiveZoneRef[] = [];
  for (const r of readings) {
    const stallNo = stallKeyFromReading(r);
    if (stallNo.startsWith("__")) continue;
    const key = barnSiteZoneKey(r.stallTyCode, stallNo);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      stallTyCode: normalizeStallTyCode(r.stallTyCode),
      stallNo,
    });
  }
  out.sort((a, b) => {
    const byType =
      stallTyCodeSortKey(a.stallTyCode) - stallTyCodeSortKey(b.stallTyCode);
    if (byType !== 0) return byType;
    return compareStallNo(a.stallNo, b.stallNo);
  });
  return out;
}

/** LIVE에 있는 유형+축사번호. 건물 평균 없음. */
export function liveZoneKeySet(
  readings: Pick<BarnReading, "stallTyCode" | "stallNo">[],
): Set<string> {
  const keys = new Set<string>();
  for (const r of readings) {
    const key = barnSiteZoneKey(r.stallTyCode, stallKeyFromReading(r));
    if (key) keys.add(key);
  }
  return keys;
}

export function readingsForZone<
  T extends Pick<BarnReading, "stallTyCode" | "stallNo">,
>(
  readings: T[],
  stallTyCode: string | null | undefined,
  stallNo: string | null | undefined,
): T[] {
  const ty = normalizeStallTyCode(stallTyCode);
  const no = (stallNo ?? "").trim();
  if (!ty || ty === "UNK" || !no) return [];
  return readings.filter(
    (r) =>
      normalizeStallTyCode(r.stallTyCode) === ty && stallKeyFromReading(r) === no,
  );
}

export type BarnSiteZoneReadings<T> = {
  zone: BarnSiteZone;
  readings: T[];
};

/** 건물 안 구역별 LIVE. 합산·평균 함수 없음. */
export function readingsByZoneForBuilding<
  T extends Pick<BarnReading, "stallTyCode" | "stallNo">,
>(
  site: BarnSitePrefs,
  buildingId: string,
  readings: T[],
): BarnSiteZoneReadings<T>[] {
  return zonesForBuilding(site, buildingId).map((zone) => ({
    zone,
    readings: readingsForZone(readings, zone.stallTyCode, zone.stallNo),
  }));
}
