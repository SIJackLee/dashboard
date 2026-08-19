/** 그리드/목록/차트 투어 — FarmMapCanvas·BarnTable·HeaderTools·UnifiedBarnTrendPanel 액션. */
export type TourGridAction =
  | "expand-first"
  | "collapse"
  | "list-mode-controller"
  | "list-mode-settings"
  /** 모바일 fieldMerge — 축사 시트 컨트롤러(게이지) 페이지 */
  | "field-mobile-sheet-controller"
  /** 모바일 fieldMerge — 축사 시트 설정 페이지 */
  | "field-mobile-sheet-settings"
  /** 모바일 fieldMerge — 축사 시트 닫기 */
  | "field-mobile-sheet-close"
  | "open-header-tools"
  | "close-header-tools"
  | "chart-enter-control"
  | "chart-exit-control";
