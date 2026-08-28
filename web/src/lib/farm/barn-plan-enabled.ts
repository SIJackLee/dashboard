/**
 * 허브 **모델** 탭(2D 부지·건물) 출시 게이트.
 * - 로컬 development · Vercel Preview: 전원 노출
 * - Production: 관리자만 (운영자·뷰어 숨김, `view=model`은 필드)
 * - NEXT_PUBLIC_BARN_PLAN_ENABLED 강제 off → 전원 숨김
 * - 강제 on은 로컬·Preview용. Production 전원 공개에는 쓰지 않음.
 */
export type BarnPlanGateOpts = {
  isAdmin?: boolean;
};

export function barnPlanEnabled(opts: BarnPlanGateOpts = {}): boolean {
  const raw = process.env.NEXT_PUBLIC_BARN_PLAN_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  if (raw === "1" || raw === "true" || raw === "on") return true;

  const vercelEnv =
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() ||
    process.env.VERCEL_ENV?.trim() ||
    "";
  if (vercelEnv === "preview") return true;
  if (process.env.NODE_ENV === "development") return true;
  return Boolean(opts.isAdmin);
}
