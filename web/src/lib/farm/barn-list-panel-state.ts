import type { BarnListViewMode } from "@/lib/farm/farm-view-url";

export type BarnListPanelKind = "none" | "graph" | "settings" | "motor";

export type BarnListPanelSets = {
  graphKeys: ReadonlySet<string>;
  settingsKeys: ReadonlySet<string>;
  motorKeys: ReadonlySet<string>;
};

function toggleInSet(prev: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function removeFromSet(prev: ReadonlySet<string>, key: string): Set<string> {
  if (!prev.has(key)) return new Set(prev);
  const next = new Set(prev);
  next.delete(key);
  return next;
}

/** 컨트롤러별 그래프 toggle — 같은 카드의 설정·모터 닫음 */
export function toggleBarnListGraph(
  prev: BarnListPanelSets,
  key: string
): BarnListPanelSets {
  return {
    graphKeys: toggleInSet(prev.graphKeys, key),
    settingsKeys: removeFromSet(prev.settingsKeys, key),
    motorKeys: removeFromSet(prev.motorKeys, key),
  };
}

/** 컨트롤러별 설정 toggle — 같은 카드의 그래프·모터 닫음 */
export function toggleBarnListSettings(
  prev: BarnListPanelSets,
  key: string
): BarnListPanelSets {
  return {
    graphKeys: removeFromSet(prev.graphKeys, key),
    settingsKeys: toggleInSet(prev.settingsKeys, key),
    motorKeys: removeFromSet(prev.motorKeys, key),
  };
}

/** 컨트롤러별 모터그래프 toggle — 같은 카드의 그래프·설정 닫음 */
export function toggleBarnListMotor(
  prev: BarnListPanelSets,
  key: string
): BarnListPanelSets {
  return {
    graphKeys: removeFromSet(prev.graphKeys, key),
    settingsKeys: removeFromSet(prev.settingsKeys, key),
    motorKeys: toggleInSet(prev.motorKeys, key),
  };
}

export function panelForBarnListKey(
  key: string,
  { graphKeys, settingsKeys, motorKeys }: BarnListPanelSets
): BarnListPanelKind {
  if (graphKeys.has(key)) return "graph";
  if (settingsKeys.has(key)) return "settings";
  if (motorKeys.has(key)) return "motor";
  return "none";
}

export const EMPTY_BARN_LIST_PANEL_SETS: BarnListPanelSets = {
  graphKeys: new Set(),
  settingsKeys: new Set(),
  motorKeys: new Set(),
};

/** 툴바 기본 + 카드별 override — 그래프 패널 표시 */
export function isBarnListGraphExpanded(
  key: string,
  listMode: BarnListViewMode,
  panelSets: BarnListPanelSets
): boolean {
  if (panelSets.settingsKeys.has(key) || panelSets.motorKeys.has(key)) return false;
  if (listMode === "graph") return true;
  return panelSets.graphKeys.has(key);
}

/** 툴바 기본 + 카드별 override — 설정 패널 표시 */
export function isBarnListSettingsExpanded(
  key: string,
  listMode: BarnListViewMode,
  panelSets: BarnListPanelSets
): boolean {
  if (panelSets.settingsKeys.has(key)) return true;
  if (
    listMode === "settings" &&
    !panelSets.graphKeys.has(key) &&
    !panelSets.motorKeys.has(key)
  ) {
    return true;
  }
  return false;
}

/** 툴바 기본 + 카드별 override — 모터 패널 표시 */
export function isBarnListMotorExpanded(
  key: string,
  listMode: BarnListViewMode,
  panelSets: BarnListPanelSets
): boolean {
  if (panelSets.motorKeys.has(key)) return true;
  if (
    listMode === "channel" &&
    !panelSets.graphKeys.has(key) &&
    !panelSets.settingsKeys.has(key)
  ) {
    return true;
  }
  return false;
}
