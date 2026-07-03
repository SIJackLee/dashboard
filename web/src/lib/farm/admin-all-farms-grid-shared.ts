import type { FarmKey } from "@/lib/data/farm-key";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import {
  GRID_COLS_DEFAULT,
  GRID_ROWS_DEFAULT,
} from "@/lib/data/barn-grid";

export type AdminFarmGridPanel = {
  farmKey: FarmKey;
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
};

/** @deprecated Admin 전체 보기는 farm별 gridCols/gridRows 사용 — 단일 선택과 동일 */
export function unifyAdminFarmGridDimensions(
  panels: AdminFarmGridPanel[]
): { cols: number; rows: number } {
  if (panels.length === 0) {
    return { cols: GRID_COLS_DEFAULT, rows: GRID_ROWS_DEFAULT };
  }
  return {
    cols: Math.max(GRID_COLS_DEFAULT, ...panels.map((p) => p.gridCols)),
    rows: Math.max(GRID_ROWS_DEFAULT, ...panels.map((p) => p.gridRows)),
  };
}
