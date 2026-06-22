import { CompactLineChart } from "@/components/common/compact-line-chart";
import type { InsertBucket } from "@/lib/admin/health/types";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthInsertRateChartProps = {
  buckets: InsertBucket[];
  hideTitle?: boolean;
  height?: number;
  compact?: boolean;
};

export function HealthInsertRateChart({
  buckets,
  hideTitle = false,
  height = 110,
  compact = false,
}: HealthInsertRateChartProps) {
  const items = buckets.map((b) => ({
    label: b.label,
    value: b.count,
    title: `${b.label}: ${b.count} rows`,
  }));

  const hasZero = buckets.some((b) => b.count === 0);
  const tone = hasZero ? "amber" : "sky";

  return (
    <div className="space-y-2">
      {hideTitle ? null : (
        <p className={cn(dashboardTypography.sectionTitle)}>raw INSERT rate (5분 버킷)</p>
      )}
      <CompactLineChart
        items={items}
        unit=" rows"
        height={height}
        fillWidth
        tickEvery={1}
        strokeClassName={tone === "amber" ? "stroke-amber-500" : "stroke-sky-500"}
        fillClassName={tone === "amber" ? "fill-amber-500/10" : "fill-sky-500/10"}
        showSummary={!compact}
      />
      {compact ? null : (
        <p className={dashboardTypography.meta}>
          Y: rows · X: time · 0 구간 = S1/R3 후보
        </p>
      )}
    </div>
  );
}