import type { StatusTone } from "@/components/common/status-badge";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";

export type FarmHealthTier = "normal" | "warning" | "danger";

/** L0 이상상황 칩 — 정상 / 주의 / 위험 (3단계) */
export function farmHealthTier(
  farm: Pick<FarmSummaryRow, "alarmCount" | "criticalCount" | "offlineCount">
): FarmHealthTier {
  if (farm.criticalCount > 0 || farm.offlineCount > 0) return "danger";
  if (farm.alarmCount > 0) return "warning";
  return "normal";
}

export function farmHealthTierLabel(tier: FarmHealthTier): string {
  if (tier === "danger") return "위험";
  if (tier === "warning") return "주의";
  return "정상";
}

/** FarmSummaryRow → StatusBadge tone + label (Admin 지도·목록 공통) */
export function farmSummaryStatus(farm: FarmSummaryRow): {
  tone: StatusTone;
  label: string;
} {
  if (farm.offlineCount > 0) {
    return { tone: "offline", label: `오프라인 ${farm.offlineCount}` };
  }
  if (farm.alarmCount > 0) {
    return { tone: "warning", label: `알람 ${farm.alarmCount}` };
  }
  return { tone: "normal", label: "정상" };
}
