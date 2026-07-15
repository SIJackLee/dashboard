import type { FarmKey } from "@/lib/data/farm-key";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";

export type AdminFarmGridPanel = {
  farmKey: FarmKey;
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
};
