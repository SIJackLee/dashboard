"use client";

import Link from "next/link";
import type { CollectorGroupHealthRow } from "@/lib/admin/health/types";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  groups: CollectorGroupHealthRow[];
  limit?: number;
  compact?: boolean;
};

export function HealthCollectorGroupMobileList({
  groups,
  limit,
  compact = false,
}: Props) {
  const rows = limit ? groups.slice(0, limit) : groups;

  if (rows.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-2 lg:hidden">
      {rows.map((row) => {
        const recent = row.insertBuckets.slice(-1)[0]?.count ?? 0;
        return (
          <li key={row.id} className="rounded-xl border bg-card px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/admin/health/group/${row.id}`}
                  className={cn(dashboardTypography.body, "text-sm font-semibold hover:underline")}
                >
                  {row.label}
                </Link>
                {!compact ? (
                  <p className="text-xs text-muted-foreground">
                    {row.farmCount}농장 · {row.moduleCount}모듈
                  </p>
                ) : null}
              </div>
              <HealthStatusBadge status={row.status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
              <span>
                이상 {row.badModuleCount}/{row.moduleCount}
              </span>
              {!compact ? <span>RS {recent}/5m</span> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
