import "server-only";

import { filterReadingsByFarmKey } from "@/lib/auth/farm-access";
import { ADMIN_HUB_MAX_FARMS } from "@/lib/data/admin-hub-live";
import { getBarnLayoutPrefs, type BarnLayoutPrefs } from "@/lib/data/barn-meta";
import {
  buildAutoBarnMap,
  filterBarnLayoutPrefsForFarm,
  gridDimensionsForBarnMap,
} from "@/lib/data/barn-map";
import type { FarmKey } from "@/lib/data/farm-key";
import { getLiveReadings } from "@/lib/data/iot";
import type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";

export type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";
export { unifyAdminFarmGridDimensions } from "@/lib/farm/admin-all-farms-grid-shared";

/** Admin 전체 농장 — farm별 축사유형 그리드 (trend·명령 제외, overview용) */
export async function loadAdminAllFarmsGridPanels(
  farmKeys: FarmKey[],
  layoutPrefs?: BarnLayoutPrefs
): Promise<AdminFarmGridPanel[]> {
  const keys = farmKeys.slice(0, ADMIN_HUB_MAX_FARMS);
  if (keys.length === 0) return [];

  const prefs = layoutPrefs ?? (await getBarnLayoutPrefs());

  const panels = await Promise.all(
    keys.map(async (farmKey) => {
      const readings = await getLiveReadings({ farmKey });
      const scopedReadings = filterReadingsByFarmKey(readings, farmKey);
      const scopedPrefs = filterBarnLayoutPrefsForFarm(prefs, farmKey);
      const { snapshots: barnSnapshots, layoutsToPersist } = buildAutoBarnMap(
        scopedReadings,
        scopedPrefs
      );
      const mergedLayouts = {
        ...scopedPrefs.layouts,
        ...layoutsToPersist,
      };
      const gridSize = gridDimensionsForBarnMap(barnSnapshots, mergedLayouts);
      return {
        farmKey,
        readings: scopedReadings,
        barnSnapshots,
        gridCols: gridSize.cols,
        gridRows: gridSize.rows,
      };
    })
  );

  return panels;
}
