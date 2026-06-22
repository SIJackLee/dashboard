import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthUsageBarProps = {
  label: string;
  used: number;
  total: number;
  tone?: "default" | "warn";
  /** SectionCard title 사용 시 라벨 숨김 */
  hideLabel?: boolean;
};

export function HealthUsageBar({
  label,
  used,
  total,
  tone = "default",
  hideLabel = false,
}: HealthUsageBarProps) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hideLabel ? null : (
          <p className={cn(dashboardTypography.sectionTitle)}>{label}</p>
        )}
        <p
          className={cn(
            dashboardTypography.meta,
            "tabular-nums",
            hideLabel ? "w-full text-right" : ""
          )}
        >
          {used} / {total}
        </p>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            tone === "warn" ? "bg-amber-500" : "bg-sky-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
