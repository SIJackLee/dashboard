import type { HealthStatus } from "@/lib/admin/health/types";
import { HEALTH_STATUS_LABEL } from "@/lib/admin/health/types";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const toneClass: Record<HealthStatus, string> = {
  ok: "border-emerald-300/50 bg-emerald-50 text-emerald-800 dark:text-emerald-400",
  warn: "border-amber-300/50 bg-amber-50 text-amber-800 dark:text-amber-400",
  critical: "border-red-300/50 bg-red-50 text-red-800 dark:text-red-400",
  unknown: "border-border bg-muted text-muted-foreground",
  not_implemented: "border-sky-300/50 bg-sky-50 text-sky-800 dark:text-sky-400",
};

const dotClass: Record<HealthStatus, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  critical: "bg-red-500",
  unknown: "bg-muted-foreground",
  not_implemented: "bg-sky-500",
};

type HealthStatusBadgeProps = {
  status: HealthStatus;
  className?: string;
  /** 모바??DAG·리스????PC badgeMd(text-xl) 미사??*/
  compact?: boolean;
};

export function HealthStatusBadge({
  status,
  className,
  compact = false,
}: HealthStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border",
        compact
          ? "gap-1 px-1.5 py-0 text-[10px] font-medium leading-tight"
          : cn("gap-2 px-2.5 py-1", dashboardUi.badgeMd),
        toneClass[status],
        className
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded-full",
          compact ? "size-1.5" : "size-2",
          dotClass[status]
        )}
        aria-hidden
      />
      {HEALTH_STATUS_LABEL[status]}
    </span>
  );
}

export function healthStatusBorderClass(status: HealthStatus): string {
  switch (status) {
    case "ok":
      return "border-emerald-500";
    case "warn":
      return "border-amber-500";
    case "critical":
      return "border-red-500";
    case "not_implemented":
      return "border-sky-500 border-dashed";
    default:
      return "border-muted-foreground";
  }
}
