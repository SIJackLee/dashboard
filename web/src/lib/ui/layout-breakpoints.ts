/** 대시보드 compact(모바일) ↔ wide(데스크톱) 분기 — Tailwind `lg`와 동일 */
export const DASHBOARD_COMPACT_MAX_PX = 1023;

/** 모바일 레이아웃 미리보기 — 브라우저가 넓어도 이 너비로 고정 */
export const MOBILE_PREVIEW_MAX_PX = 430;

/** iPhone 14 논리 해상도 비율 (390×844) — PC 미리보기 프레임 높이 산출용 */
export const MOBILE_PREVIEW_ASPECT_W = 390;
export const MOBILE_PREVIEW_ASPECT_H = 844;

/** bottom sheet — 프레임 높이 대비 비율 (85%) */
export const MOBILE_PREVIEW_SHEET_RATIO = 0.85;

export function mobilePreviewHeightForWidth(
  widthPx: number = MOBILE_PREVIEW_MAX_PX,
): number {
  return Math.round(
    (widthPx * MOBILE_PREVIEW_ASPECT_H) / MOBILE_PREVIEW_ASPECT_W,
  );
}
