import regionsJson from "@/lib/geo/korea-regions.json";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";

export type KoreaRegion = {
  sido: string;
  sigungu: string;
  lat: number;
  lng: number;
};

export const KOREA_REGIONS: KoreaRegion[] = regionsJson as KoreaRegion[];

export function regionsBySido(): Map<string, KoreaRegion[]> {
  const map = new Map<string, KoreaRegion[]>();
  for (const r of KOREA_REGIONS) {
    const list = map.get(r.sido) ?? [];
    list.push(r);
    map.set(r.sido, list);
  }
  return map;
}

export const SIDO_LIST = [...new Set(KOREA_REGIONS.map((r) => r.sido))].sort(
  (a, b) => a.localeCompare(b, "ko")
);

export function findRegion(
  sido: string,
  sigungu: string
): KoreaRegion | undefined {
  return KOREA_REGIONS.find((r) => r.sido === sido && r.sigungu === sigungu);
}

/** farm 번호 기준 결정적 랜덤 (시드·목업용) */
export function pickRegionForFarmNo(farmNo: number): KoreaRegion {
  const idx = (farmNo * 7919 + 42) % KOREA_REGIONS.length;
  return KOREA_REGIONS[idx]!;
}

export function formatAddressText(
  sido: string,
  sigungu: string,
  detail?: string | null
): string {
  const base = `${sido} ${sigungu}`;
  const d = detail?.trim();
  return d ? `${base} ${d}` : base;
}

export function jitterCoord(value: number, farmNo: number, axis: "lat" | "lng"): number {
  const sign = axis === "lat" ? 1 : -1;
  const delta = ((farmNo * 17) % 100) / 10000 * sign;
  return value + delta;
}

/** lsind+itemCode 기준 결정적 지터 — 동일 lsind 다른 축종 좌표 분리 */
export function jitterCoordForFarmKey(
  value: number,
  farmKey: FarmKey,
  axis: "lat" | "lng"
): number {
  const id = farmKeyId(farmKey);
  let seed = 0;
  for (let i = 0; i < id.length; i++) {
    seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  }
  const sign = axis === "lat" ? 1 : -1;
  const slot = (seed * 17 + (axis === "lat" ? 0 : 53)) % 360;
  const delta = ((slot - 180) / 10000) * sign;
  return value + delta;
}

export function farmNoFromLsind(lsindRegistNo: string): number | null {
  const m = /^FARM(\d+)$/i.exec(lsindRegistNo.trim());
  return m ? Number(m[1]) : null;
}

export function locationKey(fk: FarmKey): string {
  return `${fk.lsindRegistNo}/${fk.itemCode}`;
}
