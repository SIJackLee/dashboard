/**
 * detail-panel 통합 추이 — 기본 OFF.
 * `.env.local`에 NEXT_PUBLIC_UNIFIED_BARN_TREND=1 일 때만 마운트.
 */
export function isUnifiedBarnTrendEnabled(): boolean {
  return process.env.NEXT_PUBLIC_UNIFIED_BARN_TREND === "1";
}
