/** KST(Asia/Seoul) 표시 — DB timestamptz·ISO 문자열 공통 */

export const KST_TIMEZONE = "Asia/Seoul";

const KST_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: KST_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
};

const KST_SHORT: Intl.DateTimeFormatOptions = {
  timeZone: KST_TIMEZONE,
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

export function formatKst(
  iso: string | null | undefined,
  style: "full" | "short" = "full"
): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleString("ko-KR", style === "short" ? KST_SHORT : KST_FORMAT);
}
