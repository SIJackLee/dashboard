import type { BarnMeta } from "@/lib/data/barn-meta";
import type { BarnLayoutPrefs } from "@/lib/data/barn-meta";
import {
  barnCatalogKey,
  compareCatalogEntries,
  defaultBarnLabel,
  entryFromParts,
  isValidFarmKey,
  parseBarnCatalogKey,
  type BarnCatalogEntry,
} from "@/lib/data/barn-catalog";
import {
  buildGridSlots,
  gridKey,
  pickNextGridSlot,
  resolveGridDimensionsWithLayouts,
  type GridPos,
} from "@/lib/data/barn-grid";
import { farmKeyEq, type FarmKey } from "@/lib/data/farm-key";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import type { BarnMapSnapshot, BarnReading, ControllerStatus } from "@/lib/data/iot";

function avg(nums: (number | null)[]): number | null {
  const v = nums.filter((n): n is number => n !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

const STATUS_RANK: Record<ControllerStatus, number> = {
  normal: 0,
  caution: 1,
  offline: 2,
};

function worstStatus(statuses: ControllerStatus[]): ControllerStatus {
  if (statuses.length === 0) return "offline";
  return statuses.reduce((w, s) =>
    STATUS_RANK[s] > STATUS_RANK[w] ? s : w
  );
}

function catalogFromReadings(readings: BarnReading[]): BarnCatalogEntry[] {
  const map = new Map<string, BarnCatalogEntry>();
  for (const r of readings) {
    if (!r.stallTyCode || !isValidFarmKey(r.farmKey)) continue;
    const key = barnCatalogKey(r.farmKey, r.moduleUid, r.stallTyCode);
    if (!map.has(key)) {
      map.set(key, entryFromParts(r.farmKey, r.moduleUid, r.stallTyCode));
    }
  }
  return [...map.values()];
}

function metaForEntry(
  entry: BarnCatalogEntry,
  grid: GridPos,
  alias: string | undefined
): BarnMeta {
  return {
    id: entry.catalogKey,
    farmKey: entry.farmKey,
    moduleUid: entry.moduleUid,
    stallNo: entry.stallTyCode,
    name: alias?.trim() || defaultBarnLabel(entry),
    grid,
    type: "barn",
  };
}

function readingsForSpGroup(
  readings: BarnReading[],
  entry: BarnCatalogEntry
): BarnReading[] {
  const ty = normalizeStallTyCode(entry.stallTyCode);
  return readings.filter(
    (r) =>
      farmKeyEq(r.farmKey, entry.farmKey) &&
      r.moduleUid === entry.moduleUid &&
      normalizeStallTyCode(r.stallTyCode) === ty
  );
}

function isValidSavedGrid(
  grid: GridPos,
  cols: number,
  rows: number
): boolean {
  return (
    grid.col >= 1 &&
    grid.row >= 1 &&
    grid.col <= cols &&
    grid.row <= rows
  );
}

export type BarnMapBuildResult = {
  snapshots: BarnMapSnapshot[];
  /** 최초 자동 배치·신규 SP — DB에 저장할 좌표 */
  layoutsToPersist: Record<string, { col: number; row: number }>;
};

/** Admin multi-farm — 선택 farm catalog/layout만 buildAutoBarnMap에 전달 */
export function filterBarnLayoutPrefsForFarm(
  prefs: BarnLayoutPrefs,
  farmKey: FarmKey
): BarnLayoutPrefs {
  const layouts: BarnLayoutPrefs["layouts"] = {};
  for (const [key, grid] of Object.entries(prefs.layouts)) {
    const parsed = parseBarnCatalogKey(key);
    if (parsed && farmKeyEq(parsed.farmKey, farmKey)) {
      layouts[key] = grid;
    }
  }
  const aliases: BarnLayoutPrefs["aliases"] = {};
  for (const [key, alias] of Object.entries(prefs.aliases)) {
    const parsed = parseBarnCatalogKey(key);
    if (parsed && farmKeyEq(parsed.farmKey, farmKey)) {
      aliases[key] = alias;
    }
  }
  const legacyBarns = prefs.legacyBarns.filter((b) =>
    farmKeyEq(b.farmKey, farmKey)
  );
  return { layouts, aliases, legacyBarns };
}

/** LIVE readings + layout prefs — SP(축사유형) 단위 지도 스냅샷 */
export function buildAutoBarnMap(
  readings: BarnReading[],
  layoutPrefs: BarnLayoutPrefs
): BarnMapBuildResult {
  const validReadings = readings.filter((r) => isValidFarmKey(r.farmKey));
  // 기본: LIVE 데이터가 있는 SP만 표시. layout prefs는 좌표/별칭만 사용.
  const catalog = catalogFromReadings(validReadings);

  if (catalog.length === 0) {
    return { snapshots: [], layoutsToPersist: {} };
  }

  const { cols, rows } = resolveGridDimensionsWithLayouts(
    catalog.length,
    layoutPrefs.layouts
  );
  const orderedSlots = buildGridSlots(cols, rows);
  const usedSlots = new Set<string>();
  const layoutsToPersist: Record<string, { col: number; row: number }> = {};
  const placed: BarnMeta[] = [];
  let autoSlotIndex = 0;

  const snapshots: BarnMapSnapshot[] = catalog.map((entry) => {
    const saved = layoutPrefs.layouts[entry.catalogKey];
    let grid: GridPos;

    if (saved && isValidSavedGrid(saved, cols, rows)) {
      grid = { col: saved.col, row: saved.row };
    } else {
      while (
        autoSlotIndex < orderedSlots.length &&
        usedSlots.has(
          gridKey(orderedSlots[autoSlotIndex].col, orderedSlots[autoSlotIndex].row)
        )
      ) {
        autoSlotIndex++;
      }
      grid =
        orderedSlots[autoSlotIndex] ??
        pickNextGridSlot(placed, cols, rows);
      if (autoSlotIndex < orderedSlots.length) autoSlotIndex++;
      layoutsToPersist[entry.catalogKey] = grid;
    }

    usedSlots.add(gridKey(grid.col, grid.row));

    const meta = metaForEntry(
      entry,
      grid,
      layoutPrefs.aliases[entry.catalogKey]
    );
    placed.push(meta);

    const matched = readingsForSpGroup(validReadings, entry);
    const onlineMatched = matched.filter((r) => r.status !== "offline");
    const stallNos = new Set(
      matched.map((r) => r.stallNo).filter((s): s is string => !!s)
    );

    const latestReceived = matched.reduce<string | null>((latest, r) => {
      if (!latest) return r.receivedAt;
      return new Date(r.receivedAt) > new Date(latest) ? r.receivedAt : latest;
    }, null);

    return {
      meta,
      controllerCount: matched.length,
      stallCount: stallNos.size,
      tempC: avg(onlineMatched.map((r) => r.tempC)),
      humidityPct: avg(onlineMatched.map((r) => r.humidityPct)),
      fanSupply: avg(onlineMatched.map((r) => r.fanSupply)),
      fanExhaust: avg(onlineMatched.map((r) => r.fanExhaust)),
      fanIntake: avg(onlineMatched.map((r) => r.fanIntake)),
      status:
        matched.length > 0
          ? worstStatus(matched.map((r) => r.status))
          : "offline",
      receivedAt: latestReceived,
    };
  });

  const sorted = snapshots.sort((a, b) => {
    const ae = parseBarnCatalogKey(a.meta.id);
    const be = parseBarnCatalogKey(b.meta.id);
    if (!ae || !be) return 0;
    return compareCatalogEntries(ae, be);
  });

  return { snapshots: sorted, layoutsToPersist };
}

export function gridDimensionsForBarnMap(
  snapshots: BarnMapSnapshot[],
  layouts: Record<string, { col: number; row: number }> = {}
): { cols: number; rows: number } {
  return resolveGridDimensionsWithLayouts(
    snapshots.length || 1,
    layouts
  );
}

/** 그리드 카드에 LIVE readings가 있는지 — trend empty 문구 구분용 */
export function barnSnapshotHasLiveForSp(
  snapshots: BarnMapSnapshot[],
  stallTyCode: string
): boolean {
  const code = normalizeStallTyCode(stallTyCode);
  return snapshots.some((b) => {
    const entry = parseBarnCatalogKey(b.meta.id);
    if (!entry || normalizeStallTyCode(entry.stallTyCode) !== code) return false;
    return (
      b.controllerCount > 0 || b.tempC != null || b.humidityPct != null
    );
  });
}
