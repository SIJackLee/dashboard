import Link from "next/link";
import type { HealthAlertEvent } from "@/lib/admin/health/types";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { formatHealthTime } from "@/lib/admin/health/format-health-time";
import { cn } from "@/lib/utils";

type HealthAlertListProps = {
  alerts: HealthAlertEvent[];
  fetchedAt: string;
};

export function HealthAlertList({ alerts, fetchedAt }: HealthAlertListProps) {
  if (alerts.length === 0) {
    return (
      <p className={cn(dashboardTypography.meta, "py-6 text-center")}>
        현재 스냅샷 기준 활성 알림 없음 · {formatHealthTime(fetchedAt)} 갱신
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className={dashboardTypography.meta}>
        스냅샷 기준 활성 알림 · {formatHealthTime(fetchedAt)} (5분 주기 · DB 이력 없음)
      </p>
      <ul className="divide-y rounded-xl border">
        {alerts.map((alert) => (
          <li key={alert.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
            <HealthStatusBadge status={alert.severity} />
            <div className="min-w-0 flex-1">
              <Link href={alert.href} className="font-medium hover:underline">
                {alert.nodeLabel}
              </Link>
              <p className={cn("mt-0.5", dashboardTypography.meta)}>{alert.message}</p>
            </div>
            {alert.d11Hint ? (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">
                {alert.d11Hint}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
