/**
 * detail-panel 통합 추이 — 기본 ON.
 * 끄려면 NEXT_PUBLIC_UNIFIED_BARN_TREND=0 (또는 false/off).
 */
export function isUnifiedBarnTrendEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_UNIFIED_BARN_TREND?.trim().toLowerCase();
  if (raw == null || raw === "") return true;
  return !(raw === "0" || raw === "false" || raw === "off");
}
