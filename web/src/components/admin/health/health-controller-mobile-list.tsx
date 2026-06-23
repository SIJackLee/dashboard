"use client";

import Link from "next/link";
import type { ControllerHealthRow } from "@/lib/admin/health/types";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { farmKeyUrlSlug } from "@/lib/data/farm-key";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

function formatLastSeen(ageMin: number | null): string {
  if (ageMin === null) return "—";
  if (ageMin < 1) return "1분 미만";
  return `${Math.round(ageMin)}분 전`;
}

type Props = {
  controllers: ControllerHealthRow[];
  limit?: number;
};

export function HealthControllerMobileList({ controllers, limit }: Props) {
  const rows = limit ? controllers.slice(0, limit) : controllers;

  if (rows.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-2 lg:hidden">
      {rows.map((row) => (
        <li key={row.id} className="rounded-xl border bg-card px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/admin/health/farm/${farmKeyUrlSlug(row.farmId)}`}
                className={cn(dashboardTypography.body, "text-sm font-semibold hover:underline")}
              >
                {row.farmLabel}
              </Link>
              <p className="text-xs text-muted-foreground">{row.moduleLabel}</p>
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                {row.controllerKey}
              </p>
            </div>
            <HealthStatusBadge status={row.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>last {formatLastSeen(row.ageMin)}</span>
            {row.d11Hint ? <span>{row.d11Hint}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
