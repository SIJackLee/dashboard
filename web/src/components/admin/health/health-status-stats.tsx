import type { HealthStatus } from "@/lib/admin/health/types";
import { SectionCard } from "@/components/common/section-card";
import { HEALTH_UI } from "@/lib/admin/health/health-ui-labels";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
type HealthStatusStatsProps = {
  counts: Record<HealthStatus, number>;
  /** 허브 헤더 인라인 타일 */
  variant?: "card" | "inline";
};

export function HealthStatusStats({
  counts,
  variant = "card",
}: HealthStatusStatsProps) {
  const items = [
    { label: "정상", value: counts.ok, tone: "text-emerald-700" },
    { label: "주의", value: counts.warn, tone: "text-amber-700" },
    { label: "장애", value: counts.critical, tone: "text-red-700" },
    { label: "미구현", value: counts.not_implemented, tone: "text-sky-700" },
  ];

  const tiles = (
    <div
      className={cn(
        "grid gap-2",
        variant === "inline" ? "grid-cols-4" : "grid-cols-2 lg:grid-cols-4"
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            dashboardUi.metricTile,
            variant === "inline" ? "px-2 py-1.5" : "px-4 py-3"
          )}
        >
          <p
            className={cn(
              variant === "inline" ? "text-sm text-muted-foreground" : dashboardTypography.meta
            )}
          >
            {item.label}
          </p>
          <p
            className={cn(
              variant === "inline" ? "text-xl font-semibold tabular-nums" : dashboardUi.chartValue,
              item.tone
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );

  if (variant === "inline") {
    return tiles;
  }

  return <SectionCard title={HEALTH_UI.nodeSummary}>{tiles}</SectionCard>;
}