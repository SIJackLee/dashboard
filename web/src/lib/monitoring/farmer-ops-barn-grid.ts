import type { BarnLayoutPrefs } from "@/lib/data/barn-meta";
import {
  barnCatalogKey,
  isValidFarmKey,
  parseBarnCatalogKey,
} from "@/lib/data/barn-catalog";
import {
  buildAutoBarnMap,
  gridDimensionsForBarnMap,
} from "@/lib/data/barn-map";
import type {
  BarnMapSnapshot,
  BarnReading,
  ControllerStatus,
} from "@/lib/data/iot";
import {
  formatStallTypeLabel,
  normalizeStallTyCode,
} from "@/lib/data/stall-type";

export type FarmerOpsBarnGrid = {
  snapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  layoutsToPersist: Record<string, { col: number; row: number }>;
};

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

function avg(nums: (number | null)[]): number | null {
  const v = nums.filter((n): n is number => n !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function buildFallbackSnapshots(readings: BarnReading[]): BarnMapSnapshot[] {
  const groups = new Map<string, BarnReading[]>();

  for (const reading of readings) {
    if (!isValidFarmKey(reading.farmKey)) continue;
    const ty = normalizeStallTyCode(reading.stallTyCode);
    if (!ty || ty === "UNK") continue;
    const key = barnCatalogKey(reading.farmKey, reading.moduleUid, ty);
    const list = groups.get(key) ?? [];
    list.push(reading);
    groups.set(key, list);
  }

  const snapshots: BarnMapSnapshot[] = [];
  let col = 1;
  let row = 1;
  const maxCols = 3;

  for (const [catalogKey, matched] of groups) {
    const entry = parseBarnCatalogKey(catalogKey);
    if (!entry) continue;

    const onlineMatched = matched.filter((r) => r.status !== "offline");
    const stallNos = new Set(
      matched.map((r) => r.stallNo).filter((s): s is string => !!s)
    );
    const latestReceived = matched.reduce<string | null>((latest, r) => {
      if (!latest) return r.receivedAt;
      return new Date(r.receivedAt) > new Date(latest) ? r.receivedAt : latest;
    }, null);

    snapshots.push({
      meta: {
        id: catalogKey,
        farmKey: entry.farmKey,
        moduleUid: entry.moduleUid,
        stallNo: entry.stallTyCode,
        name: formatStallTypeLabel(entry.stallTyCode),
        grid: { col, row },
        type: "barn",
      },
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
    });

    col += 1;
    if (col > maxCols) {
      col = 1;
      row += 1;
    }
  }

  return snapshots;
}

export function resolveFarmerOpsBarnGrid(
  readings: BarnReading[],
  layoutPrefs: BarnLayoutPrefs
): FarmerOpsBarnGrid {
  const { snapshots, layoutsToPersist } = buildAutoBarnMap(readings, layoutPrefs);
  const finalSnapshots =
    snapshots.length > 0 ? snapshots : buildFallbackSnapshots(readings);
  const mergedLayouts = { ...layoutPrefs.layouts, ...layoutsToPersist };
  const gridSize = gridDimensionsForBarnMap(finalSnapshots, mergedLayouts);

  return {
    snapshots: finalSnapshots,
    gridCols: Math.max(gridSize.cols, 2),
    gridRows: Math.max(gridSize.rows, 2),
    layoutsToPersist,
  };
}
