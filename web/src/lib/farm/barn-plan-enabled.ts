/**
 * 허브 **모델** 탭(2D 부지·건물) 출시 게이트.
 * 기본 on(Production 포함). NEXT_PUBLIC_BARN_PLAN_ENABLED 로 강제 on/off.
 */
export function barnPlanEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_BARN_PLAN_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  if (raw === "1" || raw === "true" || raw === "on") return true;
  return true;
}
