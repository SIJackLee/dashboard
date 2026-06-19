import type { HealthStatus } from "@/lib/admin/health/types";
import { SectionCard } from "@/components/common/section-card";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthStatusStatsProps = {
  counts: Record<HealthStatus, number>;
};

export function HealthStatusStats({ counts }: HealthStatusStatsProps) {
  const items = [
    { label: "정상 노드", value: counts.ok, tone: "text-emerald-700" },
    { label: "주의", value: counts.warn, tone: "text-amber-700" },
    { label: "장애", value: counts.critical, tone: "text-red-700" },
    { label: "미구현", value: counts.not_implemented, tone: "text-sky-700" },
  ];

  return (
    <SectionCard title="노드 상태 요약">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className={cn(dashboardUi.metricTile, "px-4 py-3")}
          >
            <p className={cn(dashboardTypography.meta)}>{item.label}</p>
            <p className={cn(dashboardUi.chartValue, item.tone)}>{item.value}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
