import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value?: string;
  unit?: string;
  sub?: string;
  icon?: LucideIcon;
  accent?: "default" | "emerald" | "amber" | "red" | "sky";
  compact?: boolean;
  /** 요약 스트립 등 동일 높이 셀 채우기 */
  fill?: boolean;
  className?: string;
};

const accentMap: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "text-foreground",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  sky: "text-sky-600",
};

export function StatCard({
  label,
  value = "--",
  unit,
  sub,
  icon: Icon,
  accent = "default",
  compact = false,
  fill = false,
  className,
}: StatCardProps) {
  if (compact) {
    return (
      <div className={cn(dashboardUi.statCompact, fill && "h-full", className)}>
        <div className="min-w-0">
          <p className={dashboardUi.statCompactLabel}>{label}</p>
          <p
            className={cn(
              dashboardUi.statCompactValue,
              accentMap[accent]
            )}
          >
            {value}
            {unit && (
              <span className={dashboardUi.statCompactUnit}>{unit}</span>
            )}
          </p>
          {sub && <p className={dashboardUi.statCompactSub}>{sub}</p>}
        </div>
        {Icon && (
          <Icon
            className={cn(dashboardUi.statCompactIcon, accentMap[accent])}
          />
        )}
      </div>
    );
  }

  return (
    <Card className={dashboardUi.statCard}>
      <CardContent className={dashboardUi.statCardPad}>
        <div className="min-w-0 space-y-1">
          <p className={dashboardUi.statLabel}>{label}</p>
          <p className={cn(dashboardUi.statValue, accentMap[accent])}>
            {value}
            {unit && <span className={dashboardUi.statUnit}>{unit}</span>}
          </p>
          {sub && <p className={dashboardUi.statSub}>{sub}</p>}
        </div>
        {Icon && (
          <span className={cn(dashboardUi.statIconWrap, accentMap[accent])}>
            <Icon className={dashboardUi.statIcon} />
          </span>
        )}
      </CardContent>
    </Card>
  );
}
