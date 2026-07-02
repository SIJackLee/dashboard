/** /farm 지도 컨테이너 — 정사각형, 뷰포트·콘텐츠 폭에 맞춤 */
export const FARM_GEO_MAP_SHELL =
  "mx-auto aspect-square w-full max-w-[min(100%,calc(100vh-13rem))] overflow-hidden rounded-xl border bg-muted/10";

/** 허브 지도 — 부모 높이에 맞춤 (모바일 split shell) */
export const FARM_GEO_MAP_HUB_SHELL =
  "relative h-full min-h-0 w-full overflow-hidden rounded-xl border bg-muted/10 lg:aspect-square";

/** 허브 미니맵 — region/farm 선택 후 데스크톱 좌측 상단 */
export const FARM_GEO_MAP_MINI_SHELL =
  "relative h-[7.5rem] min-h-[7.5rem] w-full shrink-0 overflow-hidden rounded-xl border bg-muted/10 sm:h-[8.5rem] sm:min-h-[8.5rem]";

/** 레거시 — 열 전체 높이 (hub 외) */
export const FARM_GEO_MAP_COLUMN_SHELL =
  "relative h-full min-h-0 w-full overflow-hidden rounded-xl border bg-muted/10";