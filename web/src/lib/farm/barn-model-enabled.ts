/**
 * 축사 3D 모델 탭 출시 게이트.
 * DELIN과 동일: 로컬 development · Vercel Preview 기본 노출, Production 숨김.
 * NEXT_PUBLIC_BARN_MODEL_ENABLED 로 강제 on/off.
 */
export function barnModelEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_BARN_MODEL_ENABLED?.trim().toLowerCase();
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
