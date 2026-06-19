/** /farm 지도 컨테이너 — 정사각형, 뷰포트·콘텐츠 폭에 맞춤 */
export const FARM_GEO_MAP_SHELL =
  "mx-auto aspect-square w-full max-w-[min(100%,calc(100vh-13rem))] overflow-hidden rounded-xl border bg-muted/10";

/** 모니터링 허브 지도 — 열 너비 기준 1:1, 여백 없음 */
export const FARM_GEO_MAP_HUB_SHELL =
  "relative w-full aspect-square overflow-hidden rounded-xl border bg-muted/10";

/** 레거시 — 열 전체 높이 (hub 외) */
export const FARM_GEO_MAP_COLUMN_SHELL =
  "relative h-full min-h-0 w-full overflow-hidden rounded-xl border bg-muted/10";