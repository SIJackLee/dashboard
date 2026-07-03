import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  canEditFarmScope,
  farmKeysFromAccess,
} from "@/lib/auth/farm-access";
import {
  compareFarmKey,
  farmKeyId,
  type FarmKey,
} from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import { isValidMapCoord } from "@/lib/geo/map-coords";
import {
  findRegion,
  formatAddressText,
  jitterCoordForFarmKey,
  pickRegionForFarmNo,
  farmNoFromLsind,
  type KoreaRegion,
} from "@/lib/geo/korea-regions";

export type FarmLocationRow = {
  farmKey: FarmKey;
  sido: string;
  sigungu: string;
  addressDetail: string | null;
  addressText: string;
  lat: number;
  lng: number;
  geocodeSource: string;
  updatedAt: string;
  updatedBy: string | null;
};

type DbRow = {
  lsind_regist_no: string;
  item_code: string;
  sido: string;
  sigungu: string;
  address_detail: string | null;
  address_text: string;
  lat: number;
  lng: number;
  geocode_source: string;
  updated_by: string | null;
  updated_at: string;
};

function mapRow(row: DbRow): FarmLocationRow {
  return {
    farmKey: {
      lsindRegistNo: row.lsind_regist_no,
      itemCode: row.item_code,
    },
    sido: row.sido,
    sigungu: row.sigungu,
    addressDetail: row.address_detail,
    addressText: row.address_text,
    lat: row.lat,
    lng: row.lng,
    geocodeSource: row.geocode_source,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function synthesizeDevLocation(farmKey: FarmKey): FarmLocationRow {
  const farmNo = farmNoFromLsind(farmKey.lsindRegistNo) ?? 1;
  const region = pickRegionForFarmNo(farmNo);
  const detail = `목업 ${farmNo}번 축사단지`;
  return {
    farmKey,
    sido: region.sido,
    sigungu: region.sigungu,
    addressDetail: detail,
    addressText: formatAddressText(region.sido, region.sigungu, detail),
    lat: jitterCoordForFarmKey(region.lat, farmKey, "lat"),
    lng: jitterCoordForFarmKey(region.lng, farmKey, "lng"),
    geocodeSource: "dev_synthetic",
    updatedAt: new Date().toISOString(),
    updatedBy: null,
  };
}

export async function getFarmLocations(): Promise<FarmLocationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_location")
    .select(
      "lsind_regist_no, item_code, sido, sigungu, address_detail, address_text, lat, lng, geocode_source, updated_at, updated_by"
    );

  if (!error && data && data.length > 0) {
    return (data as DbRow[])
      .map(mapRow)
      .sort((a, b) => compareFarmKey(a.farmKey, b.farmKey));
  }

  if (process.env.NODE_ENV === "development") {
    const { devSimFarmKeys } = await import("@/lib/data/admin-hub-live");
    return devSimFarmKeys()
      .map((farmKey) => synthesizeDevLocation(farmKey))
      .sort((a, b) => compareFarmKey(a.farmKey, b.farmKey));
  }

  return [];
}

export function farmLocationMap(
  rows: FarmLocationRow[]
): Map<string, FarmLocationRow> {
  const map = new Map<string, FarmLocationRow>();
  for (const row of rows) {
    map.set(`${row.farmKey.lsindRegistNo}/${row.farmKey.itemCode}`, row);
  }
  return map;
}

export type SaveFarmLocationInput = {
  farmKey: FarmKey;
  /** region_lookup path */
  sido?: string;
  sigungu?: string;
  addressDetail?: string;
  /** geocode path */
  addressText?: string;
  lat?: number;
  lng?: number;
  geocodeSource?: string;
};

export function buildLocationFromRegion(
  input: SaveFarmLocationInput,
  region: KoreaRegion,
  farmNoForJitter = 0
): Omit<DbRow, "updated_at" | "updated_by"> & {
  updated_at?: string;
  updated_by?: string | null;
} {
  const detail = input.addressDetail?.trim() || null;
  return {
    lsind_regist_no: input.farmKey.lsindRegistNo,
    item_code: input.farmKey.itemCode,
    sido: region.sido,
    sigungu: region.sigungu,
    address_detail: detail,
    address_text: formatAddressText(region.sido, region.sigungu, detail),
    lat: jitterCoordForFarmKey(region.lat, input.farmKey, "lat"),
    lng: jitterCoordForFarmKey(region.lng, input.farmKey, "lng"),
    geocode_source: "region_lookup",
  };
}

function buildLocationFromCoords(
  input: SaveFarmLocationInput
): Omit<DbRow, "updated_at" | "updated_by"> | null {
  const lat = input.lat;
  const lng = input.lng;
  if (lat == null || lng == null || !isValidMapCoord(lat, lng)) {
    return null;
  }

  const sido = input.sido?.trim();
  const sigungu = input.sigungu?.trim();
  if (!sido || !sigungu) return null;

  const detail = input.addressDetail?.trim() || null;
  const addressText =
    input.addressText?.trim() ||
    formatAddressText(sido, sigungu, detail);

  return {
    lsind_regist_no: input.farmKey.lsindRegistNo,
    item_code: input.farmKey.itemCode,
    sido,
    sigungu,
    address_detail: detail,
    address_text: addressText,
    lat,
    lng,
    geocode_source: input.geocodeSource?.trim() || "geocode_api",
  };
}

export async function saveFarmLocation(
  input: SaveFarmLocationInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  if (!canEditFarmScope(user, input.farmKey)) {
    return { ok: false, error: "forbidden" };
  }

  let row: Omit<DbRow, "updated_at" | "updated_by"> | null = null;

  if (input.lat != null && input.lng != null) {
    row = buildLocationFromCoords(input);
    if (!row) return { ok: false, error: "invalid_coords" };
  } else {
    const sido = input.sido?.trim() ?? "";
    const sigungu = input.sigungu?.trim() ?? "";
    if (!sido || !sigungu) {
      return { ok: false, error: "invalid_region" };
    }
    const region = findRegion(sido, sigungu);
    if (!region) {
      return { ok: false, error: "invalid_region" };
    }
    row = buildLocationFromRegion(
      { ...input, sido, sigungu },
      region
    );
  }

  const supabase = await createClient();
  const payload = {
    ...row,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("farm_location").upsert(payload, {
    onConflict: "lsind_regist_no,item_code",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type FarmLocationSaveResult =
  | { ok: true }
  | { ok: false; error: string; farmKey?: FarmKey };

export type FarmLocationBatchResult = {
  ok: boolean;
  saved: number;
  failed: { farmKey: FarmKey; error: string }[];
};

export async function saveFarmLocationsBatch(
  inputs: SaveFarmLocationInput[]
): Promise<FarmLocationBatchResult> {
  const failed: { farmKey: FarmKey; error: string }[] = [];
  let saved = 0;

  for (const input of inputs) {
    const result = await saveFarmLocation(input);
    if (result.ok) {
      saved += 1;
    } else {
      failed.push({ farmKey: input.farmKey, error: result.error });
    }
  }

  return { ok: failed.length === 0, saved, failed };
}

export type EditableFarmOption = {
  farmKey: FarmKey;
  label: string;
  location: FarmLocationRow | null;
  hasLiveData: boolean;
};

export async function getEditableFarmLocationOptions(): Promise<
  EditableFarmOption[]
> {
  const user = await getCurrentUser();
  if (!user) return [];

  const [locations, overviewRows] = await Promise.all([
    getFarmLocations(),
    import("@/lib/data/iot-live-fetch").then((m) => m.fetchFarmOverviewRows()),
  ]);

  const locMap = farmLocationMap(locations);
  const liveIds = new Set<string>();

  let farmKeys: FarmKey[];
  if (user.isAdmin) {
    const seen = new Map<string, FarmKey>();
    for (const r of overviewRows) {
      const fk: FarmKey = {
        lsindRegistNo: r.lsind_regist_no,
        itemCode: r.item_code,
      };
      const id = farmKeyId(fk);
      liveIds.add(id);
      if (!seen.has(id)) seen.set(id, fk);
    }
    for (const loc of locations) {
      const id = farmKeyId(loc.farmKey);
      if (!seen.has(id)) seen.set(id, loc.farmKey);
    }
    farmKeys = [...seen.values()].sort(compareFarmKey);
  } else {
    farmKeys = farmKeysFromAccess(user).filter((fk) =>
      canEditFarmScope(user, fk)
    );
    for (const fk of farmKeys) liveIds.add(farmKeyId(fk));
  }

  return farmKeys.map((farmKey) => {
    const id = farmKeyId(farmKey);
    return {
      farmKey,
      label: farmShortLabel(farmKey),
      location: locMap.get(id) ?? null,
      hasLiveData: liveIds.has(id),
    };
  });
}
