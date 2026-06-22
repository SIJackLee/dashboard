"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { HealthAlertEvent, HealthStatus } from "@/lib/admin/health/types";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { HEALTH_UI, SEVERITY_ORDER } from "@/lib/admin/health/health-ui-labels";
import { dashboardControl, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { formatHealthTime } from "@/lib/admin/health/format-health-time";
import { cn } from "@/lib/utils";

type SeverityFilter = HealthStatus | "all" | "issues";

const FILTERS: { id: SeverityFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "issues", label: "이상만" },
  { id: "critical", label: "장애" },
  { id: "warn", label: "주의" },
];

type HealthAlertListEnhancedProps = {
  alerts: HealthAlertEvent[];
  fetchedAt: string;
  onNodeOpen?: (nodeId: string) => void;
  limit?: number;
  compact?: boolean;
  /** 허브: 필터 칩 숨김(이상만 고정) */
  hideFilters?: boolean;
};

export function HealthAlertListEnhanced({
  alerts,
  fetchedAt,
  onNodeOpen,
  limit,
  compact = false,
  hideFilters = false,
}: HealthAlertListEnhancedProps) {
  const [filter, setFilter] = useState<SeverityFilter>("issues");
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    let rows = [...alerts];
    if (filter === "issues") {
      rows = rows.filter(
        (a) => a.severity === "critical" || a.severity === "warn"
      );
    } else if (filter !== "all") {
      rows = rows.filter((a) => a.severity === filter);
    }
    rows.sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    );
    return rows;
  }, [alerts, filter]);

  const visible =
    limit && !expanded ? sorted.slice(0, limit) : sorted;
  const hasMore = limit != null && sorted.length > limit && !expanded;

  if (alerts.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className={dashboardTypography.meta}>
          현재 스냅샷 기준 활성 알림 없음
        </p>
        <p className={cn(dashboardTypography.meta, "mt-1 text-emerald-700")}>
          마지막 정상 확인 · {formatHealthTime(fetchedAt)}
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {hideFilters ? (
        <p className="text-sm tabular-nums text-muted-foreground">
          {sorted.length}건 · {formatHealthTime(fetchedAt)}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                dashboardControl.buttonOutline,
                compact ? "rounded-md px-2 py-1 text-sm" : "rounded-lg px-3 py-1.5",
                filter === f.id
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : ""
              )}
            >
              {f.label}
            </button>
          ))}
          <span
            className={cn(
              compact ? "text-sm text-muted-foreground" : dashboardTypography.meta,
              "ml-auto tabular-nums"
            )}
          >
            {sorted.length}건 · {formatHealthTime(fetchedAt)}
          </span>
        </div>
      )}
      <ul className="divide-y rounded-xl border">
        {visible.length === 0 ? (
          <li
            className={cn(
              "px-4 text-center",
              compact ? "py-4 text-sm text-muted-foreground" : cn("py-6", dashboardTypography.meta)
            )}
          >
            선택한 필터에 해당하는 알림 없음
          </li>
        ) : (
          visible.map((alert) => (
            <li
              key={alert.id}
              className={cn(
                "flex flex-wrap items-start gap-2",
                compact ? "px-3 py-2" : "gap-3 px-4 py-3"
              )}
            >
              <HealthStatusBadge status={alert.severity} />
              <div className="min-w-0 flex-1">
                {onNodeOpen ? (
                  <button
                    type="button"
                    onClick={() => onNodeOpen(alert.nodeId)}
                    className="text-left font-medium hover:underline"
                  >
                    {alert.nodeLabel}
                  </button>
                ) : (
                  <Link href={alert.href} className="font-medium hover:underline">
                    {alert.nodeLabel}
                  </Link>
                )}
                <p
                  className={cn(
                    "mt-0.5",
                    compact ? "text-sm text-muted-foreground" : dashboardTypography.meta
                  )}
                >
                  {alert.message}
                </p>
              </div>
              {alert.d11Hint ? (
                <span
                  className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold"
                  title={HEALTH_UI.actionHint}
                >
                  {alert.d11Hint}
                </span>
              ) : null}
              {onNodeOpen ? (
                <button
                  type="button"
                  onClick={() => onNodeOpen(alert.nodeId)}
                  className={cn(
                    dashboardControl.buttonOutline,
                    "shrink-0 rounded-lg px-2 py-1"
                  )}
                >
                  상세
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={cn(
            dashboardControl.buttonOutline,
            "w-full rounded-lg py-1.5 text-sm"
          )}
        >
          전체 {sorted.length}건 보기
        </button>
      ) : null}
    </div>
  );
}
