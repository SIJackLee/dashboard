import type { FarmScopedPanelData } from "@/lib/farm/load-farm-scoped-panel-data";

const panelCache = new Map<string, FarmScopedPanelData>();

export function getFarmPanelCache(farmId: string): FarmScopedPanelData | undefined {
  return panelCache.get(farmId);
}

export function setFarmPanelCache(
  farmId: string,
  data: FarmScopedPanelData,
): void {
  panelCache.set(farmId, data);
}

export function clearFarmPanelCache(farmId?: string): void {
  if (farmId) panelCache.delete(farmId);
  else panelCache.clear();
}
