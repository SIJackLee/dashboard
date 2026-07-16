import type { BarnListViewMode } from "@/lib/farm/farm-view-url";

export type ControllerMobileSheetPage = 0 | 1;

export type BarnListPanelKind = "none" | "graph" | "settings";

export type BarnListPanelSets = {
  graphKeys: ReadonlySet<string>;
  settingsKeys: ReadonlySet<string>;
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

/** 컨트롤러별 그래프 toggle — 같은 카드의 설정 닫음 */
export function toggleBarnListGraph(
  prev: BarnListPanelSets,
  key: string
): BarnListPanelSets {
  return {
    graphKeys: toggleInSet(prev.graphKeys, key),
    settingsKeys: removeFromSet(prev.settingsKeys, key),
  };
}

/** 컨트롤러별 설정 toggle — 같은 카드의 그래프 닫음 */
export function toggleBarnListSettings(
  prev: BarnListPanelSets,
  key: string
): BarnListPanelSets {
  return {
    graphKeys: removeFromSet(prev.graphKeys, key),
    settingsKeys: toggleInSet(prev.settingsKeys, key),
  };
}

export function panelForBarnListKey(
  key: string,
  { graphKeys, settingsKeys }: BarnListPanelSets
): BarnListPanelKind {
  if (graphKeys.has(key)) return "graph";
  if (settingsKeys.has(key)) return "settings";
  return "none";
}

export const EMPTY_BARN_LIST_PANEL_SETS: BarnListPanelSets = {
  graphKeys: new Set(),
  settingsKeys: new Set(),
};

/** 모바일 sheet carousel — 0=컨트롤러(+compact graph) · 1=설정 */
export function setBarnListSheetPage(
  prev: BarnListPanelSets,
  key: string,
  page: ControllerMobileSheetPage,
): BarnListPanelSets {
  if (page === 0) {
    return {
      graphKeys: new Set(prev.graphKeys).add(key),
      settingsKeys: removeFromSet(prev.settingsKeys, key),
    };
  }
  return {
    graphKeys: removeFromSet(prev.graphKeys, key),
    settingsKeys: new Set(prev.settingsKeys).add(key),
  };
}

/** 툴바 기본 + 카드별 override — 그래프 패널 표시 */
export function isBarnListGraphExpanded(
  key: string,
  listMode: BarnListViewMode,
  panelSets: BarnListPanelSets
): boolean {
  if (panelSets.settingsKeys.has(key)) return false;
  if (listMode === "graph") return true;
  return panelSets.graphKeys.has(key);
}

/** 모바일 sheet — panelSets에 명시된 카드만 열림 (툴바 graph/settings 일괄 확장과 분리) */
export function isBarnListMobileSheetOpen(
  key: string,
  panelSets: BarnListPanelSets,
): boolean {
  return panelSets.graphKeys.has(key) || panelSets.settingsKeys.has(key);
}

/** 툴바 기본 + 카드별 override — 설정 패널 표시 */
export function isBarnListSettingsExpanded(
  key: string,
  listMode: BarnListViewMode,
  panelSets: BarnListPanelSets
): boolean {
  if (panelSets.settingsKeys.has(key)) return true;
  if (listMode === "settings" && !panelSets.graphKeys.has(key)) {
    return true;
  }
  return false;
}
