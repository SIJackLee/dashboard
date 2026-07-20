import type { HealthStatus } from "@/lib/admin/health/types";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { HEALTH_UI } from "@/lib/admin/health/health-ui-labels";
import { dashboardTypography, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  overallStatus: HealthStatus;
  impactScope?: string | null;
  compact?: boolean;
  liveUsed?: number;
  liveTotal?: number;
  liveWarn?: boolean;
};

export function HealthOverallStatus({
  overallStatus,
  impactScope,
  compact = false,
  liveUsed,
  liveTotal,
  liveWarn = false,
}: Props) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            className={cn(
              compact
                ? opsTypography.sectionTitle
                : dashboardTypography.sectionTitle,
            )}
          >
            {HEALTH_UI.systemTitle}
          </h2>
          <HealthStatusBadge status={overallStatus} />
          {liveTotal != null && liveUsed != null ? (
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 tabular-nums",
                compact ? opsTypography.meta : "text-sm",
                liveWarn
                  ? "border-amber-300/50 bg-amber-50 text-amber-800"
                  : "border-border bg-muted/40 text-muted-foreground",
              )}
              title={HEALTH_UI.liveCap}
            >
              {liveUsed}/{liveTotal}
            </span>
          ) : null}
        </div>
        {compact ? null : (
          <p className={cn(dashboardTypography.meta, "mt-1")}>
            {HEALTH_UI.systemDesc}
          </p>
        )}
        {compact || !impactScope ? null : (
          <p
            className={cn(
              compact ? opsTypography.meta : dashboardTypography.body,
              compact ? "mt-0.5" : "mt-1",
            )}
          >
            영향: <strong>{impactScope}</strong>
          </p>
        )}
      </div>
    </div>
  );
}
