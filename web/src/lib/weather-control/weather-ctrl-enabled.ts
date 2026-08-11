/**
 * WEATHER_CTRL_REC_V1 — 기상 CTRL 말풍선·approve API 출시 게이트 (Phase E).
 *
 * - Production: 기본 **off** (Vercel `WEATHER_CTRL_REC_V1=true` 로 명시 on)
 * - Preview · local development: 기본 **on** (PoC 검수)
 * - `false`/`0`/`off` → 강제 off · `true`/`1`/`on` → 강제 on
 */
export function weatherCtrlRecEnabled(): boolean {
  const raw = process.env.WEATHER_CTRL_REC_V1?.trim().toLowerCase();
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
