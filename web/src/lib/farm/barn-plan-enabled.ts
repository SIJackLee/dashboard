/**
 * 허브 **모델** 탭(2D 부지·건물) 출시 게이트.
 * - Production 기본 숨김
 * - 로컬 development · Vercel Preview 기본 노출
 * - NEXT_PUBLIC_BARN_PLAN_ENABLED 로 강제 on/off
 */
export function barnPlanEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_BARN_PLAN_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  if (raw === "1" || raw === "true" || raw === "on") return true;

  const vercelEnv =
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() ||
    process.env.VERCEL_ENV?.trim() ||
    "";
  if (vercelEnv === "preview") return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}
