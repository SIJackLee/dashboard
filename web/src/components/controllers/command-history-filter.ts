import type { ThermoCommandStatus } from "@/lib/data/commands";

/** all | 개별 상태 | other(sent·applied·cancelled) */
export type CommandHistoryStatusFilter =
  | "all"
  | ThermoCommandStatus
  | "other";

const OTHER_STATUSES: readonly ThermoCommandStatus[] = [
  "sent",
  "applied",
  "cancelled",
];

/** 서버 조회용 — null이면 상태 조건 없음 */
export function statusesForCommandHistoryFilter(
  filter: CommandHistoryStatusFilter,
): ThermoCommandStatus[] | null {
  if (filter === "all") return null;
  if (filter === "other") return [...OTHER_STATUSES];
  return [filter];
}
