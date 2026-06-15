import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { farmKeysFromAccess } from "@/lib/auth/farm-access";
import {
  compareFarmKey,
  farmKeyEq,
  type FarmKey,
} from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import { getLiveReadings } from "@/lib/data/iot";
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
  };
}

export async function getFarmLocations(): Promise<FarmLocationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_location")
    .select(
      "lsind_regist_no, item_code, sido, sigungu, address_detail, address_text, lat, lng, geocode_source, updated_at"
    );

  if (!error && data && data.length > 0) {
    return (data as DbRow[])
      .map(mapRow)
      .sort((a, b) => compareFarmKey(a.farmKey, b.farmKey));
  }

  if (process.env.NODE_ENV === "development") {
    const readings = await getLiveReadings();
    const seen = new Map<string, FarmKey>();
    for (const r of readings) {
      const id = `${r.farmKey.lsindRegistNo}/${r.farmKey.itemCode}`;
      if (!seen.has(id)) seen.set(id, r.farmKey);
    }
    return [...seen.values()]
      .sort(compareFarmKey)
      .map(synthesizeDevLocation);
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
  sido: string;
  sigungu: string;
  addressDetail?: string;
};

export function buildLocationFromRegion(
  input: SaveFarmLocationInput,
  region: KoreaRegion,
  farmNoForJitter = 0
): Omit<DbRow, "updated_at"> & { updated_at?: string } {
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

export async function saveFarmLocation(
  input: SaveFarmLocationInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const region = findRegion(input.sido.trim(), input.sigungu.trim());
  if (!region) {
    return { ok: false, error: "invalid_region" };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const allowed =
    user.isAdmin ||
    farmKeysFromAccess(user).some((fk) => farmKeyEq(fk, input.farmKey));
  if (!allowed) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const payload = {
    ...buildLocationFromRegion(input, region),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("farm_location").upsert(payload, {
    onConflict: "lsind_regist_no,item_code",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type EditableFarmOption = {
  farmKey: FarmKey;
  label: string;
  location: FarmLocationRow | null;
};

export async function getEditableFarmLocationOptions(): Promise<
  EditableFarmOption[]
> {
  const user = await getCurrentUser();
  if (!user) return [];

  const [locations, readings] = await Promise.all([
    getFarmLocations(),
    getLiveReadings(),
  ]);

  const locMap = farmLocationMap(locations);

  let farmKeys: FarmKey[];
  if (user.isAdmin) {
    const seen = new Map<string, FarmKey>();
    for (const r of readings) {
      const id = `${r.farmKey.lsindRegistNo}/${r.farmKey.itemCode}`;
      if (!seen.has(id)) seen.set(id, r.farmKey);
    }
    farmKeys = [...seen.values()].sort(compareFarmKey);
  } else {
    farmKeys = farmKeysFromAccess(user);
  }

  return farmKeys.map((farmKey) => {
    const id = `${farmKey.lsindRegistNo}/${farmKey.itemCode}`;
    return {
      farmKey,
      label: farmShortLabel(farmKey),
      location: locMap.get(id) ?? null,
    };
  });
}
