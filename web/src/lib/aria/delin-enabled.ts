/**
 * DELIN(델린) 출시 게이트.
 * - 정식 RELEASE(그리드·목록·차트)에서는 기본 숨김
 * - 내부 프리뷰(Vercel Preview) · 로컬 development 에서는 기본 노출
 * - NEXT_PUBLIC_DELIN_ENABLED 로 강제 on/off
 */
export function delinEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_DELIN_ENABLED?.trim().toLowerCase();
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
