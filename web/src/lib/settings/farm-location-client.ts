import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import { regionsBySido, SIDO_LIST } from "@/lib/geo/korea-regions";

export function farmOptionId(farmKey: FarmKey): string {
  return farmKeyId(farmKey);
}

export function findOptionById(
  options: EditableFarmOption[],
  id: string
): EditableFarmOption | undefined {
  return options.find((o) => farmOptionId(o.farmKey) === id);
}

export function nextUnconfiguredOption(
  options: EditableFarmOption[],
  afterId?: string
): EditableFarmOption | undefined {
  const unconfigured = options.filter((o) => !o.location);
  if (unconfigured.length === 0) return undefined;
  if (!afterId) return unconfigured[0];
  const idx = unconfigured.findIndex((o) => farmOptionId(o.farmKey) === afterId);
  return unconfigured[idx + 1] ?? unconfigured[0];
}

export type FarmLocationFilter = "all" | "unconfigured" | "configured";

export function filterFarmOptions(
  options: EditableFarmOption[],
  filter: FarmLocationFilter,
  query: string,
  sidoFilter: string | null
): EditableFarmOption[] {
  const q = query.trim().toLowerCase();
  return options.filter((o) => {
    if (filter === "unconfigured" && o.location) return false;
    if (filter === "configured" && !o.location) return false;
    if (sidoFilter && o.location?.sido !== sidoFilter) return false;
    if (!q) return true;
    const hay = [
      o.label,
      o.farmKey.lsindRegistNo,
      o.farmKey.itemCode,
      o.location?.sido,
      o.location?.sigungu,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function summarizeFarmLocations(options: EditableFarmOption[]) {
  const configured = options.filter((o) => o.location).length;
  return {
    total: options.length,
    configured,
    unconfigured: options.length - configured,
  };
}

export type LocationDraft = {
  sido: string;
  sigungu: string;
  addressDetail: string;
};

export function draftFromOption(opt: EditableFarmOption | undefined): LocationDraft {
  if (opt?.location) {
    return {
      sido: opt.location.sido,
      sigungu: opt.location.sigungu,
      addressDetail: opt.location.addressDetail ?? "",
    };
  }
  const sido = SIDO_LIST[0] ?? "";
  const sigungu = regionsBySido().get(sido)?.[0]?.sigungu ?? "";
  return { sido, sigungu, addressDetail: "" };
}
