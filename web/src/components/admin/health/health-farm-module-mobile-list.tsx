"use client";

import Link from "next/link";
import type { ModuleHealthRow } from "@/lib/admin/health/types";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { HEALTH_UI } from "@/lib/admin/health/health-ui-labels";
import { farmKeyUrlSlug } from "@/lib/data/farm-key";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

function formatLastSeen(iso: string | null, ageMin: number | null): string {
  if (ageMin === null) return "—";
  if (ageMin < 1) return "1분 미만";
  return `${Math.round(ageMin)}분 전`;
}

type Props = {
  modules: ModuleHealthRow[];
};

export function HealthFarmModuleMobileList({ modules }: Props) {
  return (
    <ul className="space-y-2 lg:hidden">
      {modules.map((row) => (
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
            </div>
            <HealthStatusBadge status={row.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>last {formatLastSeen(row.lastReceivedAt, row.ageMin)}</span>
            {row.coveragePct != null ? (
              <span>coverage {row.coveragePct}%</span>
            ) : null}
            <span>{row.controllerCount}대</span>
          </div>
          {row.d11Hint ? (
            <p className="mt-1 text-xs text-muted-foreground">{row.d11Hint}</p>
          ) : null}
          <p className="mt-1 text-[10px] text-muted-foreground">{HEALTH_UI.actionHint}</p>
        </li>
      ))}
    </ul>
  );
}
