import { CompactColumnChart } from "@/components/common/compact-column-chart";
import type { InsertBucket } from "@/lib/admin/health/types";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthInsertRateChartProps = {
  buckets: InsertBucket[];
};

export function HealthInsertRateChart({ buckets }: HealthInsertRateChartProps) {
  const items = buckets.map((b) => ({
    label: b.label,
    value: b.count,
    title: `${b.label}: ${b.count} rows`,
  }));

  const hasZero = buckets.some((b) => b.count === 0);

  return (
    <div className="space-y-2">
      <p className={cn(dashboardTypography.sectionTitle)}>raw INSERT rate (5분 버킷)</p>
      <CompactColumnChart
        items={items}
        unit=" rows"
        height={140}
        fillWidth
        barClassName={hasZero ? "bg-amber-500" : "bg-sky-500"}
        showSummary
      />
      <p className={dashboardTypography.meta}>
        Y: rows · X: time · 0 구간 = S1/R3 후보
      </p>
    </div>
  );
}
