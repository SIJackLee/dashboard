import {
  compareFarmKey,
  stallCatalogKey,
  type FarmKey,
} from "@/lib/data/farm-key";

export type StallCatalogEntry = {
  farmKey: FarmKey;
  moduleUid: number;
  stallNo: string;
  stallTyCode: string | null;
  controllerCount: number;
};

type StallReading = {
  farmKey: FarmKey;
  moduleUid: number;
  stallNo: string | null;
  stallTyCode: string | null;
};

/** decoded 에서 stallNo 가 있는 축사 목록 (설정·지도용) */
export function buildStallCatalog(readings: StallReading[]): StallCatalogEntry[] {
  const map = new Map<string, StallCatalogEntry>();
  for (const r of readings) {
    if (!r.stallNo) continue;
    const key = stallCatalogKey(r.farmKey, r.moduleUid, r.stallNo);
    const existing = map.get(key);
    if (existing) {
      existing.controllerCount += 1;
      if (!existing.stallTyCode && r.stallTyCode) {
        existing.stallTyCode = r.stallTyCode;
      }
    } else {
      map.set(key, {
        farmKey: r.farmKey,
        moduleUid: r.moduleUid,
        stallNo: r.stallNo,
        stallTyCode: r.stallTyCode,
        controllerCount: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    const farmCmp = compareFarmKey(a.farmKey, b.farmKey);
    if (farmCmp !== 0) return farmCmp;
    return a.moduleUid !== b.moduleUid
      ? a.moduleUid - b.moduleUid
      : a.stallNo.localeCompare(b.stallNo, undefined, { numeric: true });
  });
}
