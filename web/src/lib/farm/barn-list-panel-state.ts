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
  // 모터(graph) 모드 — 설정이 열려도 그래프 유지 (스캔 후 즉시 조정)
  if (listMode === "graph") return true;
  if (panelSets.settingsKeys.has(key)) return false;
  return panelSets.graphKeys.has(key);
}

/** 모터 모드 — 게이지/채널 본문 기본 접힘. 다른 모드에서는 항상 펼침. */
export function isBarnListCardBodyCollapsed(
  key: string,
  listMode: BarnListViewMode,
  expandedKeys: ReadonlySet<string>,
): boolean {
  if (listMode !== "graph") return false;
  return !expandedKeys.has(key);
}

export function toggleBarnListCardBody(
  prev: ReadonlySet<string>,
  key: string,
): Set<string> {
  return toggleInSet(prev, key);
}

export function expandBarnListCardBody(
  prev: ReadonlySet<string>,
  key: string,
): Set<string> {
  if (prev.has(key)) return new Set(prev);
  const next = new Set(prev);
  next.add(key);
  return next;
}

/** 카드 본문 접을 때 해당 키의 설정 패널만 닫음 (그래프 keys 유지) */
export function closeBarnListSettingsForKey(
  prev: BarnListPanelSets,
  key: string,
): BarnListPanelSets {
  return {
    graphKeys: prev.graphKeys,
    settingsKeys: removeFromSet(prev.settingsKeys, key),
  };
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

/** 모바일 목록 — Graph/Set 툴바 모드에서 단일 bottom sheet + picker 사용 */
export function isBarnListMobileToolbarSheetMode(
  listMode: BarnListViewMode,
  compact: boolean,
  bulkMode: boolean,
): boolean {
  return (
    compact &&
    !bulkMode &&
    (listMode === "graph" || listMode === "settings")
  );
}

export function barnListToolbarSheetInitialPage(
  listMode: BarnListViewMode,
): ControllerMobileSheetPage {
  return listMode === "settings" ? 1 : 0;
}
