import type { BarnListViewMode } from "@/lib/farm/farm-view-url";

/** 모바일 시트 페이지 — 0=컨트롤러(맵 상세), 1=설정. (현장 목록은 설정 전용) */
export type ControllerMobileSheetPage = 0 | 1;

export type BarnListPanelKind = "none" | "settings";

export type BarnListPanelSets = {
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

/** 컨트롤러별 설정 toggle */
export function toggleBarnListSettings(
  prev: BarnListPanelSets,
  key: string
): BarnListPanelSets {
  return {
    settingsKeys: toggleInSet(prev.settingsKeys, key),
  };
}

export function panelForBarnListKey(
  key: string,
  { settingsKeys }: BarnListPanelSets
): BarnListPanelKind {
  if (settingsKeys.has(key)) return "settings";
  return "none";
}

export const EMPTY_BARN_LIST_PANEL_SETS: BarnListPanelSets = {
  settingsKeys: new Set(),
};

/** 카드 본문 접을 때 해당 키의 설정 패널만 닫음 */
export function closeBarnListSettingsForKey(
  prev: BarnListPanelSets,
  key: string,
): BarnListPanelSets {
  return {
    settingsKeys: removeFromSet(prev.settingsKeys, key),
  };
}

/** 모바일 sheet — panelSets에 명시된 카드만 열림 (툴바 settings 일괄 확장과 분리) */
export function isBarnListMobileSheetOpen(
  key: string,
  panelSets: BarnListPanelSets,
): boolean {
  return panelSets.settingsKeys.has(key);
}

/** 툴바 기본 + 카드별 override — 설정 패널 표시 */
export function isBarnListSettingsExpanded(
  key: string,
  listMode: BarnListViewMode,
  panelSets: BarnListPanelSets
): boolean {
  if (panelSets.settingsKeys.has(key)) return true;
  if (listMode === "settings") return true;
  return false;
}

/** 모바일 목록 — Set 툴바 모드에서 단일 bottom sheet + picker 사용 */
export function isBarnListMobileToolbarSheetMode(
  listMode: BarnListViewMode,
  compact: boolean,
  bulkMode: boolean,
): boolean {
  return compact && !bulkMode && listMode === "settings";
}
