/** KST(Asia/Seoul) 표시 — DB timestamptz·ISO 문자열 공통 */

export const KST_TIMEZONE = "Asia/Seoul";

/** Node/브라우저 ko-KR 문구 차이를 피하기 위해 formatToParts로 고정 조립 (hydration-safe). */
function formatKstParts(
  d: Date,
  opts: { includeYear: boolean; includeSecond: boolean },
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: KST_TIMEZONE,
    year: opts.includeYear ? "numeric" : undefined,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: opts.includeSecond ? "2-digit" : undefined,
    hour12: false,
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  if (opts.includeYear) {
    const year = get("year");
    if (opts.includeSecond) {
      return `${year}. ${month}. ${day}. ${hour}:${minute}:${get("second")}`;
    }
    return `${year}. ${month}. ${day}. ${hour}:${minute}`;
  }
  if (opts.includeSecond) {
    return `${month}. ${day}. ${hour}:${minute}:${get("second")}`;
  }
  return `${month}. ${day}. ${hour}:${minute}`;
}

export function formatKst(
  iso: string | null | undefined,
  style: "full" | "short" = "full"
): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return formatKstParts(d, {
    includeYear: style === "full",
    includeSecond: style === "full",
  });
}

/** KST 달력일 기준 자정(UTC ISO). offsetDays=0 오늘, -6 = 최근 7일 시작. */
export function kstDayStartIso(offsetDays = 0): string {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const base = new Date(`${dateStr}T00:00:00+09:00`);
  return new Date(base.getTime() + offsetDays * 86_400_000).toISOString();
}
